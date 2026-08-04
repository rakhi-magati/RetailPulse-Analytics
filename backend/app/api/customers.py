from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

import csv
import io

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    get_current_company_id,
    get_current_user,
    require_roles,
)
from app.core.enums import AuditAction, UserRole
from app.database.database import get_db
from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerDashboard,
    CustomerDetail,
    CustomerOut,
    CustomerUpdate,
)
from app.services import customer_service
from app.services.audit_service import log_action
from app.utils.request_meta import (
    get_client_browser,
    get_client_ip,
)


router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
)


Access = Depends(
    require_roles(
        UserRole.COMPANY_ADMIN,
        UserRole.ANALYST,
    )
)


# ---------------------------------------------------------------------------
# List Customers
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=list[CustomerOut],
)
def list_customers(
    search: Optional[str] = None,
    customer_type: Optional[str] = None,
    segment: Optional[str] = None,
    status: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    country: Optional[str] = None,
    registered_from: Optional[datetime] = None,
    registered_to: Optional[datetime] = None,
    sort_by: str = "name",
    sort_dir: str = "asc",
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=Access,
):
    query = (
        db.query(Customer)
        .filter(Customer.company_id == company_id)
    )

    # Search
    if search:
        search_value = f"%{search.strip()}%"

        query = query.filter(
            (Customer.full_name.ilike(search_value))
            | (Customer.customer_id.ilike(search_value))
            | (Customer.email.ilike(search_value))
            | (Customer.phone.ilike(search_value))
        )

    # Filters
    filters = (
        (Customer.customer_type, customer_type),
        (Customer.status, status),
        (Customer.city, city),
        (Customer.state, state),
        (Customer.country, country),
    )

    for field, value in filters:
        if value:
            query = query.filter(field == value)

    # Registration date filters
    if registered_from:
        query = query.filter(
            Customer.created_at >= registered_from
        )

    if registered_to:
        query = query.filter(
            Customer.created_at <= registered_to
        )

    # Validate sort direction
    sort_direction = (
        "desc" if sort_dir.lower() == "desc" else "asc"
    )

    # Database-level sorting
    sort_column = {
        "name": Customer.full_name,
        "customer_since": Customer.created_at,
    }.get(
        sort_by,
        Customer.full_name,
    )

    if sort_direction == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    customers = query.all()

    # Serialize customers
    result = [
        customer_service.serialize(db, customer)
        for customer in customers
    ]

    # Segment is calculated in the service layer,
    # so filter after serialization.
    if segment:
        result = [
            customer
            for customer in result
            if customer.get("segment") == segment
        ]

    # Calculated-field sorting
    if sort_by in {
        "total_spend",
        "total_orders",
        "last_purchase",
    }:

        def sort_key(customer):
            if sort_by == "total_spend":
                return Decimal(
                    str(
                        customer.get(
                            "total_revenue",
                            0,
                        )
                    )
                )

            if sort_by == "total_orders":
                return customer.get(
                    "total_orders",
                    0,
                )

            last_purchase = customer.get(
                "last_purchase_date"
            )

            if not last_purchase:
                return datetime.min.replace(
                    tzinfo=timezone.utc
                )

            return last_purchase

        result.sort(
            key=sort_key,
            reverse=sort_direction == "desc",
        )

    return result


# ---------------------------------------------------------------------------
# Create Customer
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=CustomerOut,
    status_code=201,
)
def create_customer(
    data: CustomerCreate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    user: User = Depends(get_current_user),
    _=Access,
):
    customer = customer_service.create(
        db=db,
        data=data,
        company_id=company_id,
        user=user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )

    return customer_service.serialize(
        db,
        customer,
    )


# ---------------------------------------------------------------------------
# Customer Analytics
# ---------------------------------------------------------------------------


@router.get(
    "/analytics",
    response_model=CustomerDashboard,
)
def customer_analytics(
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=Access,
):
    customers = (
        db.query(Customer)
        .filter(Customer.company_id == company_id)
        .all()
    )

    rows = [
        customer_service.serialize(db, customer)
        for customer in customers
    ]

    now = datetime.now(timezone.utc)

    current_month = now.replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    # -----------------------------------------------------------------------
    # Basic Metrics
    # -----------------------------------------------------------------------

    total_customers = len(rows)

    active_customers = sum(
        customer.get("status") == "ACTIVE"
        for customer in rows
    )

    new_customers = sum(
        customer.get("created_at") >= current_month
        for customer in rows
        if customer.get("created_at")
    )

    returning_customers = sum(
        customer.get("total_orders", 0) > 1
        for customer in rows
    )

    total_revenue = sum(
        (
            Decimal(
                str(
                    customer.get(
                        "total_revenue",
                        0,
                    )
                )
            )
            for customer in rows
        ),
        Decimal("0"),
    )

    total_orders = sum(
        customer.get("total_orders", 0)
        for customer in rows
    )

    average_customer_spend = (
        total_revenue / total_customers
        if total_customers
        else Decimal("0")
    )

    average_purchase_frequency = (
        sum(
            (
                Decimal(
                    str(
                        customer.get(
                            "purchase_frequency",
                            0,
                        )
                    )
                )
                for customer in rows
            ),
            Decimal("0"),
        )
        / total_customers
        if total_customers
        else Decimal("0")
    )

    # -----------------------------------------------------------------------
    # Revenue By Customer Type
    # -----------------------------------------------------------------------

    revenue_by_type: dict[str, Decimal] = {}

    # -----------------------------------------------------------------------
    # Customer Location Distribution
    # -----------------------------------------------------------------------

    location_distribution: dict[str, int] = {}

    # -----------------------------------------------------------------------
    # Spending Distribution
    # -----------------------------------------------------------------------

    spending_distribution = {
        "No purchases": 0,
        "Low (< $500)": 0,
        "Medium ($500-$2k)": 0,
        "High ($2k+)": 0,
    }

    for customer in rows:
        customer_type = (
            customer.get("customer_type")
            or "Unspecified"
        )

        customer_revenue = Decimal(
            str(
                customer.get(
                    "total_revenue",
                    0,
                )
            )
        )

        revenue_by_type[customer_type] = (
            revenue_by_type.get(
                customer_type,
                Decimal("0"),
            )
            + customer_revenue
        )

        country = (
            customer.get("country")
            or "Unspecified"
        )

        location_distribution[country] = (
            location_distribution.get(
                country,
                0,
            )
            + 1
        )

        total_customer_orders = customer.get(
            "total_orders",
            0,
        )

        if total_customer_orders == 0:
            spending_distribution[
                "No purchases"
            ] += 1

        elif customer_revenue < 500:
            spending_distribution[
                "Low (< $500)"
            ] += 1

        elif customer_revenue < 2000:
            spending_distribution[
                "Medium ($500-$2k)"
            ] += 1

        else:
            spending_distribution[
                "High ($2k+)"
            ] += 1

    # -----------------------------------------------------------------------
    # Customer Growth - Last 6 Months
    # -----------------------------------------------------------------------

    growth = []

    for offset in range(5, -1, -1):
        month_start = (
            current_month - timedelta(
                days=offset * 30
            )
        ).replace(day=1)

        next_month = (
            month_start + timedelta(days=32)
        ).replace(day=1)

        customers_count = sum(
            1
            for customer in rows
            if customer.get("created_at")
            and month_start
            <= customer["created_at"]
            < next_month
        )

        growth.append(
            {
                "month": month_start.strftime(
                    "%b %Y"
                ),
                "customers": customers_count,
            }
        )

    # -----------------------------------------------------------------------
    # Top Customers
    # -----------------------------------------------------------------------

    top_customers = sorted(
        [
            {
                "name": customer.get(
                    "full_name",
                    "",
                ),
                "revenue": customer.get(
                    "total_revenue",
                    0,
                ),
                "orders": customer.get(
                    "total_orders",
                    0,
                ),
                "segment": customer.get(
                    "segment",
                    "",
                ),
            }
            for customer in rows
        ],
        key=lambda customer: customer["revenue"],
        reverse=True,
    )[:10]

    # -----------------------------------------------------------------------
    # Response
    # -----------------------------------------------------------------------

    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "new_customers": new_customers,
        "returning_customers": returning_customers,
        "average_customer_spend": average_customer_spend,
        "total_revenue": total_revenue,
        "average_purchase_frequency": (
            average_purchase_frequency
        ),
        "growth": growth,
        "revenue_by_type": [
            {
                "name": name,
                "value": value,
            }
            for name, value in revenue_by_type.items()
        ],
        "top_customers": top_customers,
        "location_distribution": [
            {
                "name": name,
                "value": value,
            }
            for name, value in location_distribution.items()
        ],
        "spending_distribution": [
            {
                "name": name,
                "value": value,
            }
            for name, value in spending_distribution.items()
        ],
    }


# ---------------------------------------------------------------------------
# Export Customers CSV
# ---------------------------------------------------------------------------


@router.get(
    "/export/csv"
)
def export_customers_csv(
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    user: User = Depends(get_current_user),
    _=Access,
):
    output = io.StringIO()

    writer = csv.writer(output)

    writer.writerow(
        [
            "Customer ID",
            "Name",
            "Email",
            "Phone",
            "Type",
            "Status",
            "Orders",
            "Revenue",
            "Segment",
        ]
    )

    customers = (
        db.query(Customer)
        .filter(
            Customer.company_id == company_id
        )
        .all()
    )

    for customer in customers:
        data = customer_service.serialize(
            db,
            customer,
        )

        writer.writerow(
            [
                data.get("customer_id"),
                data.get("full_name"),
                data.get("email"),
                data.get("phone"),
                data.get("customer_type"),
                data.get("status"),
                data.get("total_orders"),
                data.get("total_revenue"),
                data.get("segment"),
            ]
        )

    log_action(
        db,
        company_id=company_id,
        user_id=user.id,
        action=AuditAction.CUSTOMER_EXPORTED,
        entity_name="Customer CSV",
    )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                "attachment; "
                "filename=customers.csv"
            )
        },
    )


# ---------------------------------------------------------------------------
# Customer Details
# ---------------------------------------------------------------------------


@router.get(
    "/{customer_id}",
    response_model=CustomerDetail,
)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=Access,
):
    customer = customer_service.get(
        db,
        customer_id,
        company_id,
    )

    return customer_service.serialize(
        db,
        customer,
        True,
    )


# ---------------------------------------------------------------------------
# Update Customer
# ---------------------------------------------------------------------------


@router.put(
    "/{customer_id}",
    response_model=CustomerOut,
)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    user: User = Depends(get_current_user),
    _=Access,
):
    customer = customer_service.update(
        db=db,
        customer_id=customer_id,
        data=data,
        company_id=company_id,
        user=user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )

    return customer_service.serialize(
        db,
        customer,
    )


# ---------------------------------------------------------------------------
# Delete / Deactivate Customer
# ---------------------------------------------------------------------------


@router.delete(
    "/{customer_id}",
    status_code=204,
)
def delete_customer(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    user: User = Depends(get_current_user),
    _=Access,
):
    customer_service.delete(
        db=db,
        customer_id=customer_id,
        company_id=company_id,
        user=user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )

    return None