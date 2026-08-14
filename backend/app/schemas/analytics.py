from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.core.enums import PaymentMethod, SalesChannel, StockStatus


# ---------------------------------------------------------------------------
# KPI Cards
# ---------------------------------------------------------------------------

class AnalyticsKPIs(BaseModel):
    total_revenue: Decimal
    total_orders: int
    total_products_sold: int
    average_order_value: Decimal
    total_inventory_value: Decimal
    low_stock_products: int
    out_of_stock_products: int
    total_categories: int
    total_discount: Decimal = Decimal(0)
    total_tax: Decimal = Decimal(0)


class SalesSummaryKPIs(BaseModel):
    total_revenue: Decimal
    total_orders: int
    average_order_value: Decimal
    total_products_sold: int
    total_discount: Decimal
    total_tax: Decimal


# ---------------------------------------------------------------------------
# Sales Analytics
# ---------------------------------------------------------------------------

class RevenueTrendPoint(BaseModel):
    period: date
    revenue: Decimal
    orders: int


class SalesTrendPoint(BaseModel):
    period: date
    quantity_sold: int
    orders: int


class TopProductItem(BaseModel):
    product_id: int
    product_name: str
    sku: str
    category_name: Optional[str] = None
    quantity_sold: int
    revenue: Decimal


class TopCategoryItem(BaseModel):
    category_id: Optional[int] = None
    category_name: str
    quantity_sold: int
    revenue: Decimal


class TopCustomerItem(BaseModel):
    customer_name: str
    orders: int
    total_spend: Decimal
    average_order_value: Decimal


class PaymentMethodBreakdownItem(BaseModel):
    payment_method: PaymentMethod
    revenue: Decimal
    orders: int


class ChannelBreakdownItem(BaseModel):
    sales_channel: SalesChannel
    revenue: Decimal
    orders: int


class SalesTrendResponse(BaseModel):
    granularity: str
    trend: List[RevenueTrendPoint]


class TopProductsResponse(BaseModel):
    products: List[TopProductItem]


class TopCustomersResponse(BaseModel):
    customers: List[TopCustomerItem]


class PaymentMethodsResponse(BaseModel):
    payment_methods: List[PaymentMethodBreakdownItem]


# ---------------------------------------------------------------------------
# Inventory Analytics
# ---------------------------------------------------------------------------

class InventoryDistributionItem(BaseModel):
    category_id: Optional[int] = None
    category_name: str
    total_quantity: int
    product_count: int


class StockStatusSummaryItem(BaseModel):
    stock_status: StockStatus
    count: int


class LowStockItem(BaseModel):
    product_id: int
    product_name: str
    sku: str
    category_name: Optional[str] = None
    available_stock: int
    reorder_level: int


class OutOfStockItem(BaseModel):
    product_id: int
    product_name: str
    sku: str
    category_name: Optional[str] = None


class InventoryValueByCategoryItem(BaseModel):
    category_id: Optional[int] = None
    category_name: str
    inventory_value: Decimal


# ---------------------------------------------------------------------------
# Full dashboard payload
# ---------------------------------------------------------------------------

class AnalyticsDashboardOut(BaseModel):
    kpis: AnalyticsKPIs
    revenue_trend: List[RevenueTrendPoint]
    sales_trend: List[SalesTrendPoint]
    top_products: List[TopProductItem]
    top_categories: List[TopCategoryItem]
    by_payment_method: List[PaymentMethodBreakdownItem]
    by_channel: List[ChannelBreakdownItem]
    inventory_distribution: List[InventoryDistributionItem]
    stock_status_summary: List[StockStatusSummaryItem]
    low_stock_products: List[LowStockItem]
    out_of_stock_products: List[OutOfStockItem]
    inventory_value_by_category: List[InventoryValueByCategoryItem]
    top_customers: List[TopCustomerItem] = []


# ---------------------------------------------------------------------------
# Drill-down
# ---------------------------------------------------------------------------

class SaleTransactionDrillDown(BaseModel):
    sale_id: int
    invoice_number: str
    customer_name: str
    sale_date: datetime
    sales_channel: SalesChannel
    payment_method: PaymentMethod
    quantity: int
    unit_price: Decimal
    total: Decimal

    model_config = ConfigDict(from_attributes=True)


class InventoryDrillDownItem(BaseModel):
    product_id: int
    product_name: str
    sku: str
    category_name: Optional[str] = None
    current_stock: int
    available_stock: int
    reorder_level: int
    stock_status: StockStatus

    model_config = ConfigDict(from_attributes=True)
