import csv
import io
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.enums import AuditAction, StockStatus
from app.repositories import analytics_repository
from app.repositories.analytics_repository import AnalyticsFilters
from app.repositories.category_repository import get_by_id_in_company as get_category
from app.services import sale_service
from app.services.audit_service import log_action

VALID_GRANULARITIES = {"daily", "weekly", "monthly"}

def _as_date(value) -> date:
    """Normalize PostgreSQL timestamps and MySQL date/string buckets for the API schema."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])

VALID_KPI_KEYS = {
    "revenue": "sales",
    "orders": "sales",
    "products_sold": "sales",
    "average_order_value": "sales",
    "inventory_value": "inventory",
    "low_stock_products": "inventory",
    "out_of_stock_products": "inventory",
    "total_categories": "inventory",
}


def _describe_filters(filters: AnalyticsFilters) -> str:
    parts = []
    if filters.date_from:
        parts.append(f"from={filters.date_from.date()}")
    if filters.date_to:
        parts.append(f"to={filters.date_to.date()}")
    if filters.product_id:
        parts.append(f"product={filters.product_id}")
    if filters.category_id:
        parts.append(f"category={filters.category_id}")
    if filters.brand:
        parts.append(f"brand={filters.brand}")
    if filters.sales_channel:
        parts.append(f"channel={filters.sales_channel.value}")
    if filters.payment_method:
        parts.append(f"payment={filters.payment_method.value}")
    return "; ".join(parts) if parts else "none"


def get_dashboard(
    db: Session,
    company_id: int,
    filters: AnalyticsFilters,
    granularity: str,
    actor_id: int,
    ip_address: str,
    browser: str,
) -> dict:
    if granularity not in VALID_GRANULARITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"granularity must be one of {sorted(VALID_GRANULARITIES)}",
        )
    if filters.date_from and filters.date_to and filters.date_from > filters.date_to:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="date_from cannot be after date_to")

    sales_kpis = analytics_repository.sales_kpis(db, company_id, filters)
    inventory_kpis = analytics_repository.inventory_kpis(db, company_id, filters)

    total_revenue = Decimal(str(sales_kpis["total_revenue"]))
    total_orders = sales_kpis["total_orders"]
    average_order_value = (total_revenue / total_orders) if total_orders else Decimal("0")

    kpis = {
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "total_products_sold": sales_kpis["total_products_sold"],
        "average_order_value": average_order_value,
        "total_inventory_value": Decimal(str(inventory_kpis["total_inventory_value"])),
        "low_stock_products": inventory_kpis["low_stock_products"],
        "out_of_stock_products": inventory_kpis["out_of_stock_products"],
        "total_categories": inventory_kpis["total_categories"],
    }

    payload = {
        "kpis": kpis,
        "revenue_trend": [
            {"period": _as_date(row.period), "revenue": row.revenue, "orders": row.orders}
            for row in analytics_repository.revenue_trend(db, company_id, filters, granularity)
        ],
        "sales_trend": [
            {"period": _as_date(row.period), "quantity_sold": row.quantity_sold, "orders": row.orders}
            for row in analytics_repository.sales_trend(db, company_id, filters, granularity)
        ],
        "top_products": [row._asdict() for row in analytics_repository.top_products(db, company_id, filters)],
        "top_categories": [row._asdict() for row in analytics_repository.top_categories(db, company_id, filters)],
        "by_payment_method": [
            row._asdict() for row in analytics_repository.by_payment_method(db, company_id, filters)
        ],
        "by_channel": [row._asdict() for row in analytics_repository.by_channel(db, company_id, filters)],
        "inventory_distribution": [
            row._asdict() for row in analytics_repository.inventory_distribution(db, company_id, filters)
        ],
        "stock_status_summary": [
            row._asdict() for row in analytics_repository.stock_status_summary(db, company_id, filters)
        ],
        "low_stock_products": [
            row._asdict() for row in analytics_repository.low_stock_products(db, company_id, filters)
        ],
        "out_of_stock_products": [
            row._asdict() for row in analytics_repository.out_of_stock_products(db, company_id, filters)
        ],
        "inventory_value_by_category": [
            row._asdict() for row in analytics_repository.inventory_value_by_category(db, company_id, filters)
        ],
    }

    log_action(
        db,
        company_id=company_id,
        user_id=actor_id,
        action=AuditAction.DASHBOARD_VIEWED,
        ip_address=ip_address,
        browser=browser,
        entity_name="Analytics Dashboard",
    )
    if filters.is_active():
        log_action(
            db,
            company_id=company_id,
            user_id=actor_id,
            action=AuditAction.DASHBOARD_FILTERS_APPLIED,
            ip_address=ip_address,
            browser=browser,
            entity_name=_describe_filters(filters),
        )

    return payload


def drill_down_kpi(db: Session, company_id: int, kpi_key: str, filters: AnalyticsFilters):
    if kpi_key not in VALID_KPI_KEYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown KPI '{kpi_key}'. Valid values: {sorted(VALID_KPI_KEYS)}",
        )

    if VALID_KPI_KEYS[kpi_key] == "sales":
        sales = analytics_repository.kpi_sale_records(db, company_id, filters)
        return [sale_service.serialize_sale_list_item(s) for s in sales]

    status_filter = None
    if kpi_key == "low_stock_products":
        status_filter = StockStatus.LOW_STOCK
    elif kpi_key == "out_of_stock_products":
        status_filter = StockStatus.OUT_OF_STOCK

    rows = analytics_repository.kpi_inventory_records(db, company_id, filters, stock_status=status_filter)
    return [row._asdict() for row in rows]


def drill_down_category(db: Session, company_id: int, category_id: int, filters: AnalyticsFilters):
    category = get_category(db, category_id, company_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    rows = analytics_repository.category_product_drill_down(db, company_id, category_id, filters)
    return [row._asdict() for row in rows]


def drill_down_product(db: Session, company_id: int, product_id: int, filters: AnalyticsFilters):
    rows = analytics_repository.product_transactions_drill_down(db, company_id, product_id, filters)
    return [row._asdict() for row in rows]


def export_report(
    db: Session,
    company_id: int,
    filters: AnalyticsFilters,
    granularity: str,
    export_format: str,
    actor_id: int,
    ip_address: str,
    browser: str,
):
    if export_format not in {"csv", "pdf"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="format must be csv or pdf")

    dashboard = get_dashboard(db, company_id, filters, granularity, actor_id, ip_address, browser)

    log_action(
        db,
        company_id=company_id,
        user_id=actor_id,
        action=AuditAction.REPORT_EXPORTED,
        ip_address=ip_address,
        browser=browser,
        entity_name=f"Analytics Dashboard Export ({export_format.upper()})",
    )

    if export_format == "csv":
        return _build_csv(dashboard), "text/csv", "analytics-report.csv"
    return _build_pdf(dashboard), "application/pdf", "analytics-report.pdf"


def _build_csv(dashboard: dict) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["RetailPulse Analytics Report"])
    writer.writerow(["Generated At", datetime.utcnow().isoformat()])
    writer.writerow([])

    writer.writerow(["KPI Summary"])
    for key, value in dashboard["kpis"].items():
        writer.writerow([key.replace("_", " ").title(), value])
    writer.writerow([])

    writer.writerow(["Top Selling Products"])
    writer.writerow(["Product", "SKU", "Category", "Quantity Sold", "Revenue"])
    for item in dashboard["top_products"]:
        writer.writerow(
            [item["product_name"], item["sku"], item["category_name"], item["quantity_sold"], item["revenue"]]
        )
    writer.writerow([])

    writer.writerow(["Top Performing Categories"])
    writer.writerow(["Category", "Quantity Sold", "Revenue"])
    for item in dashboard["top_categories"]:
        writer.writerow([item["category_name"], item["quantity_sold"], item["revenue"]])
    writer.writerow([])

    writer.writerow(["Low Stock Products"])
    writer.writerow(["Product", "SKU", "Category", "Available Stock", "Reorder Level"])
    for item in dashboard["low_stock_products"]:
        writer.writerow(
            [item["product_name"], item["sku"], item["category_name"], item["available_stock"], item["reorder_level"]]
        )
    writer.writerow([])

    writer.writerow(["Out of Stock Products"])
    writer.writerow(["Product", "SKU", "Category"])
    for item in dashboard["out_of_stock_products"]:
        writer.writerow([item["product_name"], item["sku"], item["category_name"]])

    return buffer.getvalue().encode("utf-8")


def _build_pdf(dashboard: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = [Paragraph("RetailPulse Analytics Report", styles["Title"]), Spacer(1, 12)]

    story.append(Paragraph("KPI Summary", styles["Heading2"]))
    kpi_rows = [["Metric", "Value"]] + [
        [key.replace("_", " ").title(), str(value)] for key, value in dashboard["kpis"].items()
    ]
    story.append(_styled_table(kpi_rows))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Top Selling Products", styles["Heading2"]))
    product_rows = [["Product", "SKU", "Category", "Qty Sold", "Revenue"]] + [
        [p["product_name"], p["sku"], p["category_name"] or "-", str(p["quantity_sold"]), str(p["revenue"])]
        for p in dashboard["top_products"]
    ]
    story.append(_styled_table(product_rows))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Low Stock Products", styles["Heading2"]))
    low_stock_rows = [["Product", "SKU", "Available", "Reorder Level"]] + [
        [p["product_name"], p["sku"], str(p["available_stock"]), str(p["reorder_level"])]
        for p in dashboard["low_stock_products"]
    ]
    story.append(_styled_table(low_stock_rows))

    doc.build(story)
    return buffer.getvalue()


def _styled_table(rows: List[list]):
    from reportlab.lib import colors
    from reportlab.platypus import Table, TableStyle

    table = Table(rows, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F7FB")]),
            ]
        )
    )
    return table
