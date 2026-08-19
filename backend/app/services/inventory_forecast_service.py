"""Backend demand forecast and replenishment engine.

Formula: average daily demand = units sold over the last 30 calendar days / 30.
Forecast demand = ceil(average daily demand * requested horizon).
Reorder point = ceil(average daily demand * (lead time + safety-stock days)).
Recommended quantity raises stock to forecast demand plus safety stock.
"""
from collections import defaultdict
from datetime import date, timedelta
from math import ceil
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.enums import ProductStatus
from app.models.category import Category
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.sale import Sale, SaleItem

LOOKBACK_DAYS = 30
LEAD_TIME_DAYS = 7
SAFETY_STOCK_DAYS = 3


def _risk(stock: int, daily: float, reorder_point: int, forecast: int) -> tuple[str, str, bool]:
    days = stock / daily if daily > 0 else None
    if stock <= 0:
        return "OUT_OF_STOCK", "Reorder immediately — no available stock.", True
    if daily > 0 and days is not None and days <= LEAD_TIME_DAYS:
        return "STOCKOUT_RISK", "Reorder immediately — stock may run out before delivery.", True
    if daily > 0 and stock <= reorder_point:
        return "LOW_STOCK", "Reorder soon — stock is below the reorder point.", True
    if (daily == 0 and stock > 0) or (forecast > 0 and stock > forecast * 2 + reorder_point):
        return "OVERSTOCK", "Review purchasing — inventory exceeds expected demand.", False
    return "HEALTHY", "Stock level is healthy.", False


def build_forecast(
    db: Session, company_id: int, forecast_days: int = 30, category_id: Optional[int] = None,
    product_id: Optional[int] = None, stock_risk: Optional[str] = None,
    reorder_required: Optional[bool] = None, sort_by: str = "stock_risk",
) -> dict:
    if forecast_days not in {7, 30, 90}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "forecast_days must be 7, 30, or 90")

    since = date.today() - timedelta(days=LOOKBACK_DAYS - 1)
    sales = dict(
        db.query(SaleItem.product_id, func.coalesce(func.sum(SaleItem.quantity), 0))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.company_id == company_id, Sale.sale_date >= since)
        .group_by(SaleItem.product_id).all()
    )
    query = (
        db.query(Product, Category, Inventory)
        .join(Category, Category.id == Product.category_id)
        .outerjoin(Inventory, (Inventory.product_id == Product.id) & (Inventory.company_id == company_id))
        .filter(Product.company_id == company_id, Product.status == ProductStatus.ACTIVE)
    )
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if product_id:
        query = query.filter(Product.id == product_id)

    items = []
    for product, category, inventory in query.all():
        stock = int(inventory.available_stock if inventory else product.stock_quantity or 0)
        fallback_reorder = int(product.low_stock_threshold or 0)
        units = int(sales.get(product.id, 0))
        daily = round(units / LOOKBACK_DAYS, 2)
        forecast = ceil(daily * forecast_days)
        safety = ceil(daily * SAFETY_STOCK_DAYS)
        calculated_reorder = ceil(daily * (LEAD_TIME_DAYS + SAFETY_STOCK_DAYS))
        reorder = max(fallback_reorder, calculated_reorder)
        risk, recommendation, required = _risk(stock, daily, reorder, forecast)
        target = forecast + safety
        reorder_quantity = max(0, target - stock) if required else 0
        days = round(stock / daily, 1) if daily > 0 else None
        item = {
            "product_id": product.id, "product_name": product.name, "sku": product.sku,
            "category_id": product.category_id, "category_name": category.name, "current_stock": stock,
            "average_daily_sales": daily, "forecasted_demand": forecast, "days_of_stock_remaining": days,
            "reorder_point": reorder, "safety_stock": safety,
            "recommended_reorder_quantity": reorder_quantity, "stock_risk": risk,
            "recommendation": recommendation, "reorder_required": required,
        }
        if (not stock_risk or risk == stock_risk) and (reorder_required is None or required == reorder_required):
            items.append(item)

    risk_order = {"OUT_OF_STOCK": 0, "STOCKOUT_RISK": 1, "LOW_STOCK": 2, "HEALTHY": 3, "OVERSTOCK": 4}
    sort_key = {
        "current_stock": lambda item: item["current_stock"],
        "forecasted_demand": lambda item: item["forecasted_demand"],
        "days_remaining": lambda item: item["days_of_stock_remaining"] if item["days_of_stock_remaining"] is not None else float("inf"),
        "recommended_quantity": lambda item: item["recommended_reorder_quantity"],
        "stock_risk": lambda item: risk_order[item["stock_risk"]],
    }.get(sort_by, lambda item: risk_order[item["stock_risk"]])
    items.sort(key=sort_key, reverse=sort_by in {"forecasted_demand", "recommended_quantity"})
    summary = {
        "products_requiring_reorder": sum(item["reorder_required"] for item in items),
        "products_at_stockout_risk": sum(item["stock_risk"] in {"OUT_OF_STOCK", "STOCKOUT_RISK"} for item in items),
        "overstocked_products": sum(item["stock_risk"] == "OVERSTOCK" for item in items),
        "healthy_products": sum(item["stock_risk"] == "HEALTHY" for item in items),
    }
    return {"forecast_days": forecast_days, "lead_time_days": LEAD_TIME_DAYS, "safety_stock_days": SAFETY_STOCK_DAYS, "summary": summary, "items": items}


def recommendation_detail(db: Session, company_id: int, product_id: int, forecast_days: int = 30) -> dict:
    result = build_forecast(db, company_id, forecast_days, product_id=product_id)
    if not result["items"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product or inventory record not found")
    item = result["items"][0]
    since = date.today() - timedelta(days=LOOKBACK_DAYS - 1)
    daily_rows = (
        db.query(func.date(Sale.sale_date), func.coalesce(func.sum(SaleItem.quantity), 0))
        .join(SaleItem, SaleItem.sale_id == Sale.id)
        .filter(Sale.company_id == company_id, SaleItem.product_id == product_id, Sale.sale_date >= since)
        .group_by(func.date(Sale.sale_date)).order_by(func.date(Sale.sale_date)).all()
    )
    item["projected_stock_after_forecast"] = item["current_stock"] - item["forecasted_demand"]
    item["historical_daily_demand"] = [{"date": str(day), "quantity": int(quantity)} for day, quantity in daily_rows]
    return item