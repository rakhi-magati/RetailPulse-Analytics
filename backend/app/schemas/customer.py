from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class CustomerInput(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=50)
    gender: Optional[str] = None; date_of_birth: Optional[date] = None; address: Optional[str] = None
    city: Optional[str] = None; state: Optional[str] = None; country: Optional[str] = None
    customer_type: str = Field(pattern="^(RETAIL|WHOLESALE|CORPORATE)$")
    preferred_sales_channel: Optional[str] = None; status: str = Field(default="ACTIVE", pattern="^(ACTIVE|INACTIVE)$")
class CustomerCreate(CustomerInput): pass
class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None; email: Optional[EmailStr] = None; phone: Optional[str] = None; gender: Optional[str] = None; date_of_birth: Optional[date] = None; address: Optional[str] = None; city: Optional[str] = None; state: Optional[str] = None; country: Optional[str] = None; customer_type: Optional[str] = None; preferred_sales_channel: Optional[str] = None; status: Optional[str] = None
class CustomerOut(CustomerInput):
    id: int; customer_id: str; company_id: int; created_at: datetime; updated_at: Optional[datetime] = None
    total_orders: int = 0; total_revenue: Decimal = Decimal("0"); total_products_purchased: int = 0; average_order_value: Decimal = Decimal("0"); purchase_frequency: Decimal = Decimal("0"); first_purchase_date: Optional[datetime] = None; last_purchase_date: Optional[datetime] = None; segment: str = "NEW_CUSTOMER"
    model_config = ConfigDict(from_attributes=True)
class CustomerDetail(CustomerOut):
    favorite_product: Optional[str] = None; favorite_category: Optional[str] = None; recent_transactions: List[dict] = []; timeline: List[dict] = []
class CustomerDashboard(BaseModel):
    total_customers: int; active_customers: int; new_customers: int; returning_customers: int; average_customer_spend: Decimal; total_revenue: Decimal; average_purchase_frequency: Decimal
    growth: List[dict]; revenue_by_type: List[dict]; top_customers: List[dict]; location_distribution: List[dict]; spending_distribution: List[dict]
