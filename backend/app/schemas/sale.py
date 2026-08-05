from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.enums import PaymentMethod, SalesChannel


# ---------------------------------------------------------------------------
# Sale Items
# ---------------------------------------------------------------------------

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0, description="Quantity sold must be greater than zero")
    unit_price: Decimal = Field(..., gt=0, description="Unit price must be greater than zero")
    discount: Decimal = Field(0, ge=0, description="Discount applied on the line item")
    tax: Decimal = Field(0, ge=0, description="Tax cannot be negative")

    @model_validator(mode="after")
    def discount_within_bounds(self):
        line_value = self.unit_price * self.quantity
        if self.discount > line_value:
            raise ValueError("Discount cannot exceed total product value")
        return self


class SaleItemOut(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
    category_id: int
    category_name: Optional[str] = None
    quantity: int
    unit_price: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Sales
# ---------------------------------------------------------------------------

class SaleBase(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_id: int = Field(..., gt=0)
    sale_date: Optional[datetime] = None
    sales_channel: SalesChannel
    payment_method: PaymentMethod
    payment_status: str = Field("PAID", pattern="^(PAID|PENDING|PARTIAL|FAILED)$")
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("customer_name")
    @classmethod
    def customer_name_must_not_be_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Customer name is mandatory")
        return v


class SaleCreate(SaleBase):
    items: List[SaleItemCreate] = Field(..., min_length=1, description="At least one product line is required")

    @field_validator("items")
    @classmethod
    def items_must_not_be_empty(cls, v):
        if not v:
            raise ValueError("Product selection is mandatory")
        return v


class SaleUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, min_length=1, max_length=255)
    customer_id: Optional[int] = None
    sale_date: Optional[datetime] = None
    sales_channel: Optional[SalesChannel] = None
    payment_method: Optional[PaymentMethod] = None
    payment_status: Optional[str] = Field(None, pattern="^(PAID|PENDING|PARTIAL|FAILED)$")
    notes: Optional[str] = Field(None, max_length=1000)
    items: Optional[List[SaleItemCreate]] = Field(None, min_length=1)

    @field_validator("customer_name")
    @classmethod
    def customer_name_must_not_be_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Customer name is mandatory")
        return v

    @field_validator("items")
    @classmethod
    def items_must_not_be_empty(cls, v):
        if v is not None and not v:
            raise ValueError("Product selection is mandatory")
        return v


class SaleOut(BaseModel):
    id: int
    company_id: int
    invoice_number: str
    customer_name: str
    customer_id: Optional[int] = None
    sale_date: datetime
    sales_channel: SalesChannel
    payment_method: PaymentMethod
    payment_status: str = Field("PAID", pattern="^(PAID|PENDING|PARTIAL|FAILED)$")
    notes: Optional[str] = None
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total_amount: Decimal
    created_by: int
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[SaleItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class SaleListOut(BaseModel):
    id: int
    invoice_number: str
    customer_name: str
    customer_id: Optional[int] = None
    sale_date: datetime
    sales_channel: SalesChannel
    payment_method: PaymentMethod
    payment_status: str = Field("PAID", pattern="^(PAID|PENDING|PARTIAL|FAILED)$")
    total_amount: Decimal
    item_count: int
    product_summary: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SalesDashboardSummary(BaseModel):
    total_sales: int
    total_revenue: Decimal
    total_orders: int
    average_order_value: Decimal
