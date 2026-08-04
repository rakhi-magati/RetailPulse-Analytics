import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from math import ceil
from typing import Optional
from fastapi import HTTPException, status
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.enums import AuditAction, NotificationType, ProductStatus
from app.models.demand_forecast import DemandForecast, ForecastHistory
from app.models.inventory import Inventory
from app.models.notification import Notification
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.repositories import forecast_repository
from app.services.audit_service import log_action

PERIOD_DAYS = {"7d": 7, "30d": 30, "90d": 90}

def resolve_period(period: str, date_from: Optional[date] = None, date_to: Optional[date] = None):
    start = date_from or date.today()
    if period == "custom":
        if not date_to: raise HTTPException(400, "date_to is required for a custom forecast")
        return start, date_to
    if period not in PERIOD_DAYS: raise HTTPException(400, "forecast_period must be 7d, 30d, 90d, or custom")
    return start, start + timedelta(days=PERIOD_DAYS[period] - 1)

def _sales_by_product(db: Session, company_id: int, since: date):
    return dict(db.query(SaleItem.product_id, func.coalesce(func.sum(SaleItem.quantity), 0)).join(Sale).filter(
        Sale.company_id == company_id, Sale.sale_date >= since).group_by(SaleItem.product_id).all())

def _prediction(db: Session, company_id: int, product_id: int, days: int):
    lookback = max(28, min(180, days * 2))
    today = date.today()
    total = int(_sales_by_product(db, company_id, today - timedelta(days=lookback)).get(product_id, 0))
    recent = int(_sales_by_product(db, company_id, today - timedelta(days=lookback // 2)).get(product_id, 0))
    previous = max(total - recent, 0)
    daily = total / lookback
    recent_daily = recent / (lookback / 2)
    previous_daily = previous / (lookback / 2)
    trend = 1 + max(-0.35, min(0.50, (recent_daily - previous_daily) / max(previous_daily, 1)))
    predicted = max(0, ceil(daily * days * trend))
    confidence = min(95, max(45, 55 + min(35, total * 2) - min(20, abs(recent_daily - previous_daily) * 8)))
    accuracy = max(0, min(100, 100 - abs(daily - recent_daily) / max(recent_daily, 1) * 100))
    return total, predicted, round(confidence, 2), round(accuracy, 2)

def generate(db: Session, company_id: int, period: str, date_from: Optional[date], date_to: Optional[date], actor_id: int, ip_address: str, browser: str, refresh: bool = False):
    period_start, period_end = resolve_period(period, date_from, date_to)
    days = (period_end - period_start).days + 1
    historical_count = db.query(SaleItem.id).join(Sale).filter(Sale.company_id == company_id).count()
    if not historical_count: raise HTTPException(status.HTTP_400_BAD_REQUEST, "Forecast generation requires historical sales data")
    products = db.query(Product).filter(Product.company_id == company_id, Product.status == ProductStatus.ACTIVE).all()
    created = 0
    for product in products:
        historical, predicted, confidence, accuracy = _prediction(db, company_id, product.id, days)
        existing = forecast_repository.get_existing(db, company_id, product.id, period, period_start, period_end)
        if existing and not refresh: continue
        if existing:
            existing.category_id, existing.predicted_demand, existing.confidence_score = product.category_id, predicted, confidence
            existing.generated_at = datetime.now(timezone.utc)
            forecast = existing
        else:
            forecast = DemandForecast(company_id=company_id, product_id=product.id, category_id=product.category_id,
                forecast_period=period, period_start=period_start, period_end=period_end, predicted_demand=predicted, confidence_score=confidence)
            db.add(forecast); db.flush(); created += 1
        db.add(ForecastHistory(forecast_id=forecast.id, historical_sales=historical, prediction=predicted, accuracy=accuracy))
    db.commit()
    action = AuditAction.FORECAST_REFRESHED if refresh else AuditAction.FORECAST_GENERATED
    log_action(db, company_id, actor_id, action, ip_address, browser, f"{period} ({period_start} to {period_end})")
    _notify_and_log_recommendations(db, company_id, period, period_start, period_end, actor_id, ip_address, browser)
    return {"message": "Forecast refreshed" if refresh else "Forecast generated", "created": created, "forecast_period": period, "period_start": period_start, "period_end": period_end}

def _recommendation(stock, reorder, predicted):
    if predicted > stock: return "Immediate Restock Required" if stock <= reorder else "Reorder Soon"
    if stock > max(predicted * 3, reorder * 3): return "Overstock Risk"
    return "Stock Level Healthy"

def _notify_and_log_recommendations(db, company_id, period, start, end, actor_id, ip, browser):
    forecasts = forecast_repository.list_for_period(db, company_id, period, start, end)
    for f in forecasts:
        product = f.product; inventory = db.query(Inventory).filter(Inventory.product_id == f.product_id, Inventory.company_id == company_id).first()
        stock = inventory.available_stock if inventory else product.stock_quantity
        reorder = inventory.reorder_level if inventory else product.low_stock_threshold
        recommendation = _recommendation(stock, reorder, f.predicted_demand)
        if recommendation in {"Immediate Restock Required", "Reorder Soon"}:
            message = f"Forecast alert: {product.name} has {stock} available but predicted demand is {f.predicted_demand}."
            exists = db.query(Notification.id).filter(Notification.company_id == company_id, Notification.product_id == product.id, Notification.type == NotificationType.FORECAST_ALERT, Notification.message == message, Notification.is_read.is_(False)).first()
            if not exists: db.add(Notification(company_id=company_id, product_id=product.id, type=NotificationType.FORECAST_ALERT, message=message))
    db.commit()
    log_action(db, company_id, actor_id, AuditAction.INVENTORY_RECOMMENDATION_GENERATED, ip, browser, f"{period} recommendations")

def dashboard(db, company_id, period, date_from=None, date_to=None, product_id=None, category_id=None, brand=None, sort_by="predicted_demand"):
    start, end = resolve_period(period, date_from, date_to)
    forecasts = forecast_repository.list_for_period(db, company_id, period, start, end)
    rows = []
    for f in forecasts:
        p = f.product
        if product_id and p.id != product_id: continue
        if category_id and p.category_id != category_id: continue
        if brand and (p.brand or "").lower() != brand.lower(): continue
        inv = db.query(Inventory).filter(Inventory.company_id == company_id, Inventory.product_id == p.id).first()
        stock, reorder = (inv.available_stock, inv.reorder_level) if inv else (p.stock_quantity, p.low_stock_threshold)
        history = f.history[-1] if f.history else None
        historical = history.historical_sales if history else 0; accuracy = float(history.accuracy) if history else 0
        growth = round((f.predicted_demand - historical) / max(historical, 1) * 100, 1)
        rows.append({"id":f.id,"product_id":p.id,"product_name":p.name,"category_id":p.category_id,"category_name":f.category.name,"brand":p.brand,"current_stock":stock,"reorder_level":reorder,"historical_sales":historical,"predicted_demand":f.predicted_demand,"forecast_period":period,"period_start":start,"period_end":end,"confidence_score":float(f.confidence_score),"accuracy":accuracy,"growth_percentage":growth,"recommendation":_recommendation(stock,reorder,f.predicted_demand),"generated_at":f.generated_at})
    sorters = {"predicted_demand": lambda r:r["predicted_demand"], "lowest_stock":lambda r:r["current_stock"], "growth":lambda r:r["growth_percentage"], "accuracy":lambda r:r["accuracy"]}
    rows.sort(key=sorters.get(sort_by, sorters["predicted_demand"]), reverse=sort_by != "lowest_stock")
    grouped = defaultdict(lambda: {"total_historical_sales":0,"predicted_demand":0,"category_name":""})
    for r in rows:
        g=grouped[r["category_id"]]; g["category_name"]=r["category_name"]; g["total_historical_sales"]+=r["historical_sales"]; g["predicted_demand"]+=r["predicted_demand"]
    categories=[{"category_id":k,"category_name":v["category_name"],"total_historical_sales":v["total_historical_sales"],"predicted_demand":v["predicted_demand"],"expected_growth_percentage":round((v["predicted_demand"]-v["total_historical_sales"])/max(v["total_historical_sales"],1)*100,1)} for k,v in grouped.items()]
    kpis={"total_predicted_demand":sum(r["predicted_demand"] for r in rows),"products_expected_to_run_out":sum(r["predicted_demand"]>r["current_stock"] for r in rows),"high_growth_products":sum(r["growth_percentage"]>=20 for r in rows),"slow_moving_products":sum(r["predicted_demand"]<=r["reorder_level"] for r in rows),"forecast_accuracy":round(sum(r["accuracy"] for r in rows)/len(rows),1) if rows else 0}
    historical_vs_forecast=[{"product_name":r["product_name"],"historical_sales":r["historical_sales"],"predicted_demand":r["predicted_demand"]} for r in rows]
    seasonal=_seasonal(db, company_id)
    return {"kpis":kpis,"products":rows,"categories":categories,"historical_vs_forecast":historical_vs_forecast,"product_demand_trend":historical_vs_forecast,"category_demand_trend":categories,"top_predicted_products":[{"product_name":r["product_name"],"predicted_demand":r["predicted_demand"]} for r in rows[:10]],"seasonal_sales_pattern":seasonal}

def _seasonal(db, company_id):
    values = db.query(func.extract("month", Sale.sale_date), func.coalesce(func.sum(SaleItem.quantity),0)).join(SaleItem).filter(Sale.company_id==company_id).group_by(func.extract("month", Sale.sale_date)).all()
    return [{"month": datetime(2000,int(month),1).strftime("%b"), "sales":int(qty)} for month,qty in values]

def export_report(db, company_id, period, report_type, date_from, date_to, actor_id, ip, browser):
    data=dashboard(db,company_id,period,date_from,date_to)
    if report_type == "pdf":
        out=io.BytesIO(); pdf=canvas.Canvas(out,pagesize=A4); pdf.setTitle("Product Forecast Report"); pdf.drawString(48,800,"RetailPulse Product Forecast Report")
        y=770
        for row in data["products"][:35]: pdf.drawString(48,y,f"{row['product_name']}: predicted {row['predicted_demand']} | stock {row['current_stock']} | {row['recommendation']}"); y-=20
        pdf.save(); content=out.getvalue(); media="application/pdf"; filename="product-forecast-report.pdf"
    else:
        out=io.StringIO(); writer=csv.writer(out); rows=data["categories"] if report_type=="category" else data["products"]
        writer.writerow(rows[0].keys() if rows else [])
        for row in rows: writer.writerow(row.values())
        content=out.getvalue().encode(); media="text/csv"; filename=f"{report_type}-forecast-report.csv"
    log_action(db,company_id,actor_id,AuditAction.FORECAST_EXPORTED,ip,browser,f"{report_type} {period}")
    return content,media,filename


def refresh_existing_for_company(db: Session, company_id: int, actor_id: int, ip_address: str = "system", browser: str = "system"):
    """Refresh every saved company forecast after sales are recorded or corrected."""
    saved = db.query(DemandForecast.forecast_period, DemandForecast.period_start, DemandForecast.period_end).filter(DemandForecast.company_id == company_id).distinct().all()
    for period, start, end in saved:
        generate(db, company_id, period, start if period == "custom" else None, end if period == "custom" else None, actor_id, ip_address, browser, refresh=True)
