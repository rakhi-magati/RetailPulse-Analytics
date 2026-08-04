from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


# ============================================================================
# Constants
# ============================================================================

PHONE_PATTERN = r"^\+?[0-9() .-]{7,20}$"

CUSTOMER_TYPES = "^(RETAIL|WHOLESALE|CORPORATE)$"
CUSTOMER_STATUSES = "^(ACTIVE|INACTIVE)$"


# ============================================================================
# Customer Input
# ============================================================================


class CustomerInput(BaseModel):
    """
    Common customer input schema.

    Supports both:
        - first_name + last_name
        - legacy full_name
    """

    first_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    last_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    full_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    email: EmailStr

    phone: str = Field(
        min_length=7,
        max_length=50,
        pattern=PHONE_PATTERN,
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    city: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    state: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    country: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    postal_code: Optional[str] = Field(
        default=None,
        max_length=20,
    )

    gender: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    date_of_birth: Optional[date] = None

    customer_type: str = Field(
        default="RETAIL",
        pattern=CUSTOMER_TYPES,
    )

    preferred_sales_channel: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    status: str = Field(
        default="ACTIVE",
        pattern=CUSTOMER_STATUSES,
    )

    # ------------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------------

    @model_validator(mode="after")
    def validate_and_build_name(self):
        first_name = (
            self.first_name.strip()
            if self.first_name
            else ""
        )

        last_name = (
            self.last_name.strip()
            if self.last_name
            else ""
        )

        full_name = (
            self.full_name.strip()
            if self.full_name
            else ""
        )

        # New UI sends first_name + last_name
        if first_name or last_name:
            if not first_name or not last_name:
                raise ValueError(
                    "Both first name and last name are required."
                )

            self.first_name = first_name
            self.last_name = last_name
            self.full_name = (
                f"{first_name} {last_name}"
            )

            return self

        # Legacy UI sends full_name
        if full_name:
            parts = full_name.split(
                maxsplit=1
            )

            if len(parts) != 2:
                raise ValueError(
                    "Both first name and last name are required."
                )

            self.first_name = parts[0].strip()
            self.last_name = parts[1].strip()
            self.full_name = (
                f"{self.first_name} "
                f"{self.last_name}"
            )

            return self

        raise ValueError(
            "First name and last name are required."
        )

    @field_validator("phone")
    @classmethod
    def normalize_phone(
        cls,
        value: str,
    ) -> str:
        return value.strip()


# ============================================================================
# Customer Create
# ============================================================================


class CustomerCreate(CustomerInput):
    pass


# ============================================================================
# Customer Update
# ============================================================================


class CustomerUpdate(BaseModel):
    """
    Partial update schema.

    Only fields supplied by the client are updated.
    """

    first_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    last_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    full_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    email: Optional[EmailStr] = None

    phone: Optional[str] = Field(
        default=None,
        min_length=7,
        max_length=50,
        pattern=PHONE_PATTERN,
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    city: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    state: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    country: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    postal_code: Optional[str] = Field(
        default=None,
        max_length=20,
    )

    gender: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    date_of_birth: Optional[date] = None

    customer_type: Optional[str] = Field(
        default=None,
        pattern=CUSTOMER_TYPES,
    )

    preferred_sales_channel: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    status: Optional[str] = Field(
        default=None,
        pattern=CUSTOMER_STATUSES,
    )

    # ------------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------------

    @field_validator("phone")
    @classmethod
    def normalize_phone(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return None

        return value.strip()


# ============================================================================
# Customer Output
# ============================================================================


class CustomerOut(BaseModel):
    """
    Customer response schema.

    Includes customer information plus calculated purchase metrics.
    """

    id: int

    customer_id: str

    company_id: int

    full_name: str

    first_name: Optional[str] = None

    last_name: Optional[str] = None

    email: str

    phone: str

    address: Optional[str] = None

    city: Optional[str] = None

    state: Optional[str] = None

    country: Optional[str] = None

    postal_code: Optional[str] = None

    gender: Optional[str] = None

    date_of_birth: Optional[date] = None

    customer_type: str = "RETAIL"

    preferred_sales_channel: Optional[str] = None

    status: str = "ACTIVE"

    created_at: datetime

    updated_at: Optional[datetime] = None

    # ------------------------------------------------------------------------
    # Purchase Summary
    # ------------------------------------------------------------------------

    total_orders: int = 0

    total_revenue: Decimal = Decimal("0")

    total_products_purchased: int = 0

    average_order_value: Decimal = Decimal("0")

    purchase_frequency: Decimal = Decimal("0")

    first_purchase_date: Optional[datetime] = None

    last_purchase_date: Optional[datetime] = None

    # ------------------------------------------------------------------------
    # Customer Segment
    # ------------------------------------------------------------------------

    segment: str = "NEW_CUSTOMER"

    # ------------------------------------------------------------------------
    # SQLAlchemy Compatibility
    # ------------------------------------------------------------------------

    model_config = ConfigDict(
        from_attributes=True,
    )


# ============================================================================
# Customer Detail
# ============================================================================


class CustomerDetail(CustomerOut):
    """
    Detailed customer response.

    Includes favorite product/category,
    recent transactions, and timeline.
    """

    favorite_product: Optional[str] = None

    favorite_category: Optional[str] = None

    recent_transactions: List[dict] = Field(
        default_factory=list
    )

    timeline: List[dict] = Field(
        default_factory=list
    )


# ============================================================================
# Customer Dashboard
# ============================================================================


class CustomerDashboard(BaseModel):
    """
    Customer analytics dashboard response.
    """

    total_customers: int

    active_customers: int

    new_customers: int

    returning_customers: int

    average_customer_spend: Decimal

    total_revenue: Decimal

    average_purchase_frequency: Decimal

    growth: List[dict]

    revenue_by_type: List[dict]

    top_customers: List[dict]

    location_distribution: List[dict]

    spending_distribution: List[dict]