from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Query, Session, joinedload

from app.core.enums import PaymentMethod, SalesChannel, StockStatus
from app.models.category import Category
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.sale import Sale, SaleItem


@dataclass
class AnalyticsFilters:
    """
    Carries every supported Dashboard Filter. Sales-side aggregations honour
    every field; inventory-side aggregations only honour product/category/brand
    (stock position has no notion of a sale date, channel, or payment method).
    """

    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    product_id: Optional[int] = None
    category_id: Optional[int] = None
    brand: Optional[str] = None
    sales_channel: Optional[SalesChannel] = None
    payment_method: Optional[PaymentMethod] = None

    def is_active(self) -> bool:
        return any(
            [
                self.date_from,
                self.date_to,
                self.product_id,
                self.category_id,
                self.brand,
                self.sales_channel,
                self.payment_method,
            ]
        )


GRANULARITY_SQL = {"daily": "day", "weekly": "week", "monthly": "month"}


def trend_period(db: Session, granularity: str):
    """Return a date bucket expression for the active database dialect."""
    dialect = db.bind.dialect.name if db.bind is not None else "postgresql"

    if dialect in {"mysql", "mariadb"}:
        if granularity == "daily":
            return func.date(Sale.sale_date)
        if granularity == "weekly":
            # MySQL WEEKDAY() starts on Monday, matching PostgreSQL date_trunc('week').
            return func.subdate(func.date(Sale.sale_date), func.weekday(Sale.sale_date))
        return func.date_format(Sale.sale_date, "%Y-%m-01")

    return func.date_trunc(GRANULARITY_SQL.get(granularity, "day"), Sale.sale_date)

def filtered_sale_items_query(db: Session, company_id: int, filters: AnalyticsFilters) -> Query:
    """
    Base query joining SaleItem -> Sale -> Product, scoped to the company and
    every applicable dashboard filter. Every sales aggregation (KPIs, trends,
    top products/categories, payment/channel breakdowns) is derived from this
    single query so that "revenue" always means the same thing everywhere.
    """
    query = (
        db.query(SaleItem, Sale, Product)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
        .filter(Sale.company_id == company_id)
    )

    if filters.date_from is not None:
        query = query.filter(Sale.sale_date >= filters.date_from)
    if filters.date_to is not None:
        query = query.filter(Sale.sale_date <= filters.date_to)
    if filters.product_id is not None:
        query = query.filter(SaleItem.product_id == filters.product_id)
    if filters.category_id is not None:
        query = query.filter(SaleItem.category_id == filters.category_id)
    if filters.brand:
        query = query.filter(Product.brand.ilike(f"%{filters.brand.strip()}%"))
    if filters.sales_channel is not None:
        query = query.filter(Sale.sales_channel == filters.sales_channel)
    if filters.payment_method is not None:
        query = query.filter(Sale.payment_method == filters.payment_method)

    return query


def filtered_inventory_query(db: Session, company_id: int, filters: AnalyticsFilters) -> Query:
    """Base query joining Inventory -> Product -> Category, scoped to product/category/brand filters."""
    query = (
        db.query(Inventory, Product, Category)
        .join(Product, Inventory.product_id == Product.id)
        .join(Category, Product.category_id == Category.id)
        .filter(Inventory.company_id == company_id)
    )

    # Inventory is a current-stock snapshot. When a sales-side filter is set,
    # scope that snapshot to products that participated in the filtered sales,
    # so inventory KPIs remain consistent with every dashboard filter.
    if any((filters.date_from, filters.date_to, filters.sales_channel, filters.payment_method)):
        matching_products = (
            db.query(SaleItem.product_id)
            .join(Sale, SaleItem.sale_id == Sale.id)
            .filter(Sale.company_id == company_id)
        )
        if filters.date_from is not None:
            matching_products = matching_products.filter(Sale.sale_date >= filters.date_from)
        if filters.date_to is not None:
            matching_products = matching_products.filter(Sale.sale_date <= filters.date_to)
        if filters.sales_channel is not None:
            matching_products = matching_products.filter(Sale.sales_channel == filters.sales_channel)
        if filters.payment_method is not None:
            matching_products = matching_products.filter(Sale.payment_method == filters.payment_method)
        query = query.filter(Product.id.in_(matching_products.distinct()))

    if filters.product_id is not None:
        query = query.filter(Product.id == filters.product_id)
    if filters.category_id is not None:
        query = query.filter(Product.category_id == filters.category_id)
    if filters.brand:
        query = query.filter(Product.brand.ilike(f"%{filters.brand.strip()}%"))

    return query


# ---------------------------------------------------------------------------
# KPI Cards
# ---------------------------------------------------------------------------

def sales_kpis(db: Session, company_id: int, filters: AnalyticsFilters) -> dict:
    base = filtered_sale_items_query(db, company_id, filters)

    total_revenue = base.with_entities(func.coalesce(func.sum(SaleItem.total), 0)).scalar() or 0
    total_products_sold = base.with_entities(func.coalesce(func.sum(SaleItem.quantity), 0)).scalar() or 0
    total_orders = base.with_entities(func.count(func.distinct(Sale.id))).scalar() or 0

    return {
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "total_products_sold": total_products_sold,
    }


def inventory_kpis(db: Session, company_id: int, filters: AnalyticsFilters) -> dict:
    base = filtered_inventory_query(db, company_id, filters)

    total_inventory_value = (
        base.with_entities(func.coalesce(func.sum(Inventory.current_stock * Product.unit_price), 0)).scalar() or 0
    )
    low_stock_products = base.filter(Inventory.stock_status == StockStatus.LOW_STOCK).with_entities(
        func.count(Inventory.id)
    ).scalar() or 0
    out_of_stock_products = filtered_inventory_query(db, company_id, filters).filter(
        Inventory.stock_status == StockStatus.OUT_OF_STOCK
    ).with_entities(func.count(Inventory.id)).scalar() or 0
    total_categories = filtered_inventory_query(db, company_id, filters).with_entities(
        func.count(func.distinct(Category.id))
    ).scalar() or 0

    return {
        "total_inventory_value": total_inventory_value,
        "low_stock_products": low_stock_products,
        "out_of_stock_products": out_of_stock_products,
        "total_categories": total_categories,
    }


# ---------------------------------------------------------------------------
# Sales Analytics
# ---------------------------------------------------------------------------

def revenue_trend(db: Session, company_id: int, filters: AnalyticsFilters, granularity: str):
    period = trend_period(db, granularity)
    base = filtered_sale_items_query(db, company_id, filters)
    return (
        base.with_entities(
            period.label("period"),
            func.coalesce(func.sum(SaleItem.total), 0).label("revenue"),
            func.count(func.distinct(Sale.id)).label("orders"),
        )
        .group_by(period)
        .order_by(period.asc())
        .all()
    )


def sales_trend(db: Session, company_id: int, filters: AnalyticsFilters, granularity: str):
    period = trend_period(db, granularity)
    base = filtered_sale_items_query(db, company_id, filters)
    return (
        base.with_entities(
            period.label("period"),
            func.coalesce(func.sum(SaleItem.quantity), 0).label("quantity_sold"),
            func.count(func.distinct(Sale.id)).label("orders"),
        )
        .group_by(period)
        .order_by(period.asc())
        .all()
    )


def top_products(db: Session, company_id: int, filters: AnalyticsFilters, limit: int = 10):
    base = filtered_sale_items_query(db, company_id, filters)
    return (
        base.with_entities(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.sku.label("sku"),
            Category.name.label("category_name"),
            func.coalesce(func.sum(SaleItem.quantity), 0).label("quantity_sold"),
            func.coalesce(func.sum(SaleItem.total), 0).label("revenue"),
        )
        .join(Category, Product.category_id == Category.id)
        .group_by(Product.id, Product.name, Product.sku, Category.name)
        .order_by(func.coalesce(func.sum(SaleItem.total), 0).desc())
        .limit(limit)
        .all()
    )


def top_categories(db: Session, company_id: int, filters: AnalyticsFilters):
    base = filtered_sale_items_query(db, company_id, filters)
    return (
        base.with_entities(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.coalesce(func.sum(SaleItem.quantity), 0).label("quantity_sold"),
            func.coalesce(func.sum(SaleItem.total), 0).label("revenue"),
        )
        .join(Category, Product.category_id == Category.id)
        .group_by(Category.id, Category.name)
        .order_by(func.coalesce(func.sum(SaleItem.total), 0).desc())
        .all()
    )


def by_payment_method(db: Session, company_id: int, filters: AnalyticsFilters):
    base = filtered_sale_items_query(db, company_id, filters)
    return (
        base.with_entities(
            Sale.payment_method.label("payment_method"),
            func.coalesce(func.sum(SaleItem.total), 0).label("revenue"),
            func.count(func.distinct(Sale.id)).label("orders"),
        )
        .group_by(Sale.payment_method)
        .order_by(func.coalesce(func.sum(SaleItem.total), 0).desc())
        .all()
    )


def by_channel(db: Session, company_id: int, filters: AnalyticsFilters):
    base = filtered_sale_items_query(db, company_id, filters)
    return (
        base.with_entities(
            Sale.sales_channel.label("sales_channel"),
            func.coalesce(func.sum(SaleItem.total), 0).label("revenue"),
            func.count(func.distinct(Sale.id)).label("orders"),
        )
        .group_by(Sale.sales_channel)
        .order_by(func.coalesce(func.sum(SaleItem.total), 0).desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Inventory Analytics
# ---------------------------------------------------------------------------

def inventory_distribution(db: Session, company_id: int, filters: AnalyticsFilters):
    base = filtered_inventory_query(db, company_id, filters)
    return (
        base.with_entities(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.coalesce(func.sum(Inventory.current_stock), 0).label("total_quantity"),
            func.count(func.distinct(Product.id)).label("product_count"),
        )
        .group_by(Category.id, Category.name)
        .order_by(Category.name.asc())
        .all()
    )


def stock_status_summary(db: Session, company_id: int, filters: AnalyticsFilters):
    base = filtered_inventory_query(db, company_id, filters)
    return (
        base.with_entities(Inventory.stock_status.label("stock_status"), func.count(Inventory.id).label("count"))
        .group_by(Inventory.stock_status)
        .all()
    )


def low_stock_products(db: Session, company_id: int, filters: AnalyticsFilters, limit: int = 20):
    base = filtered_inventory_query(db, company_id, filters)
    return (
        base.filter(Inventory.stock_status == StockStatus.LOW_STOCK)
        .with_entities(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.sku.label("sku"),
            Category.name.label("category_name"),
            Inventory.available_stock.label("available_stock"),
            Inventory.reorder_level.label("reorder_level"),
        )
        .order_by(Inventory.available_stock.asc())
        .limit(limit)
        .all()
    )


def out_of_stock_products(db: Session, company_id: int, filters: AnalyticsFilters, limit: int = 20):
    base = filtered_inventory_query(db, company_id, filters)
    return (
        base.filter(Inventory.stock_status == StockStatus.OUT_OF_STOCK)
        .with_entities(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.sku.label("sku"),
            Category.name.label("category_name"),
        )
        .order_by(Product.name.asc())
        .limit(limit)
        .all()
    )


def inventory_value_by_category(db: Session, company_id: int, filters: AnalyticsFilters):
    base = filtered_inventory_query(db, company_id, filters)
    return (
        base.with_entities(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.coalesce(func.sum(Inventory.current_stock * Product.unit_price), 0).label("inventory_value"),
        )
        .group_by(Category.id, Category.name)
        .order_by(func.coalesce(func.sum(Inventory.current_stock * Product.unit_price), 0).desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Drill-down
# ---------------------------------------------------------------------------

def category_product_drill_down(db: Session, company_id: int, category_id: int, filters: AnalyticsFilters):
    scoped = AnalyticsFilters(**{**filters.__dict__, "category_id": category_id})
    return top_products(db, company_id, scoped, limit=1000)


def product_transactions_drill_down(db: Session, company_id: int, product_id: int, filters: AnalyticsFilters):
    scoped = AnalyticsFilters(**{**filters.__dict__, "product_id": product_id})
    base = filtered_sale_items_query(db, company_id, scoped)
    return (
        base.with_entities(
            Sale.id.label("sale_id"),
            Sale.invoice_number.label("invoice_number"),
            Sale.customer_name.label("customer_name"),
            Sale.sale_date.label("sale_date"),
            Sale.sales_channel.label("sales_channel"),
            Sale.payment_method.label("payment_method"),
            SaleItem.quantity.label("quantity"),
            SaleItem.unit_price.label("unit_price"),
            SaleItem.total.label("total"),
        )
        .order_by(Sale.sale_date.desc())
        .all()
    )


def kpi_sale_records(db: Session, company_id: int, filters: AnalyticsFilters, limit: int = 200):
    base = filtered_sale_items_query(db, company_id, filters)
    sale_ids = [row[0] for row in base.with_entities(func.distinct(Sale.id)).limit(limit).all()]
    if not sale_ids:
        return []
    return (
        db.query(Sale)
        .options(joinedload(Sale.items).joinedload(SaleItem.product))
        .filter(Sale.id.in_(sale_ids))
        .order_by(Sale.sale_date.desc())
        .all()
    )


def kpi_inventory_records(
    db: Session,
    company_id: int,
    filters: AnalyticsFilters,
    stock_status: Optional[StockStatus] = None,
    limit: int = 200,
):
    base = filtered_inventory_query(db, company_id, filters)
    if stock_status is not None:
        base = base.filter(Inventory.stock_status == stock_status)
    return (
        base.with_entities(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.sku.label("sku"),
            Category.name.label("category_name"),
            Inventory.current_stock.label("current_stock"),
            Inventory.available_stock.label("available_stock"),
            Inventory.reorder_level.label("reorder_level"),
            Inventory.stock_status.label("stock_status"),
        )
        .order_by(Product.name.asc())
        .limit(limit)
        .all()
    )
