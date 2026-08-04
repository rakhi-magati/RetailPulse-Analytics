from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.enums import AuditAction, NotificationType
from app.models.category import Category
from app.models.customer import (
    Customer,
    CustomerPurchaseSummary,
    CustomerTimeline,
)
from app.models.notification import Notification
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.services.audit_service import log_action


# ============================================================================
# Customer Purchase Summary
# ============================================================================


def _summary(
    db: Session,
    customer: Customer,
) -> CustomerPurchaseSummary:
    """
    Calculate and update the purchase summary for a customer.
    """

    sales = (
        db.query(Sale)
        .filter(
            Sale.company_id == customer.company_id,
            Sale.customer_id == customer.id,
        )
        .order_by(Sale.sale_date.asc())
        .all()
    )

    # ------------------------------------------------------------------------
    # Basic Purchase Metrics
    # ------------------------------------------------------------------------

    revenue = sum(
        (
            Decimal(str(sale.total_amount or 0))
            for sale in sales
        ),
        Decimal("0"),
    )

    quantity = sum(
        (
            int(item.quantity or 0)
            for sale in sales
            for item in sale.items
        ),
        0,
    )

    first_purchase_date = (
        sales[0].sale_date
        if sales
        else None
    )

    last_purchase_date = (
        sales[-1].sale_date
        if sales
        else None
    )

    # ------------------------------------------------------------------------
    # Purchase Frequency
    # ------------------------------------------------------------------------

    frequency = Decimal("0")

    if (
        first_purchase_date
        and last_purchase_date
    ):
        days = (
            last_purchase_date.date()
            - first_purchase_date.date()
        ).days

        months = Decimal(
            max(days / 30, 1)
        )

        frequency = (
            Decimal(len(sales))
            / months
        )

    # ------------------------------------------------------------------------
    # Get Existing Summary
    # ------------------------------------------------------------------------

    summary = customer.summary

    if summary is None:
        summary = CustomerPurchaseSummary(
            customer_id=customer.id
        )

        db.add(summary)
        db.flush()

    # ------------------------------------------------------------------------
    # Update Summary
    # ------------------------------------------------------------------------

    summary.total_orders = len(sales)

    summary.total_revenue = revenue

    summary.total_products_purchased = quantity

    summary.average_order_value = (
        revenue / len(sales)
        if sales
        else Decimal("0")
    )

    summary.purchase_frequency = frequency

    summary.first_purchase_date = (
        first_purchase_date
    )

    summary.last_purchase_date = (
        last_purchase_date
    )

    # ------------------------------------------------------------------------
    # Favorite Product
    # ------------------------------------------------------------------------

    product_row = (
        db.query(
            SaleItem.product_id,
            func.count(SaleItem.id).label("count"),
        )
        .join(
            Sale,
            Sale.id == SaleItem.sale_id,
        )
        .filter(
            Sale.company_id == customer.company_id,
            Sale.customer_id == customer.id,
        )
        .group_by(
            SaleItem.product_id
        )
        .order_by(
            func.count(
                SaleItem.id
            ).desc()
        )
        .first()
    )

    summary.favorite_product_id = (
        product_row[0]
        if product_row
        else None
    )

    # ------------------------------------------------------------------------
    # Favorite Category
    # ------------------------------------------------------------------------

    category_row = (
        db.query(
            SaleItem.category_id,
            func.count(SaleItem.id).label("count"),
        )
        .join(
            Sale,
            Sale.id == SaleItem.sale_id,
        )
        .filter(
            Sale.company_id == customer.company_id,
            Sale.customer_id == customer.id,
        )
        .group_by(
            SaleItem.category_id
        )
        .order_by(
            func.count(
                SaleItem.id
            ).desc()
        )
        .first()
    )

    summary.favorite_category_id = (
        category_row[0]
        if category_row
        else None
    )

    db.flush()

    return summary


# ============================================================================
# Customer Segment
# ============================================================================


def _segment(
    summary: CustomerPurchaseSummary,
) -> str:
    """
    Calculate customer segment based on
    total revenue and order count.
    """

    if (
        summary.total_revenue >= 10000
        or summary.total_orders >= 20
    ):
        return "VIP_CUSTOMER"

    if summary.total_orders >= 8:
        return "LOYAL_CUSTOMER"

    if summary.total_orders >= 2:
        return "REGULAR_CUSTOMER"

    return "NEW_CUSTOMER"


# ============================================================================
# Serialize Customer
# ============================================================================


def serialize(
    db: Session,
    customer: Customer,
    detail: bool = False,
) -> dict:
    """
    Convert Customer SQLAlchemy model into
    CustomerOut / CustomerDetail compatible dictionary.
    """

    summary = _summary(
        db,
        customer,
    )

    # ------------------------------------------------------------------------
    # Customer Fields
    # ------------------------------------------------------------------------

    result = {
        column.name: getattr(
            customer,
            column.name,
        )
        for column in Customer.__table__.columns
    }

    # ------------------------------------------------------------------------
    # Purchase Summary
    # ------------------------------------------------------------------------

    result.update(
        {
            "total_orders": (
                summary.total_orders or 0
            ),
            "total_revenue": (
                summary.total_revenue
                or Decimal("0")
            ),
            "total_products_purchased": (
                summary.total_products_purchased
                or 0
            ),
            "average_order_value": (
                summary.average_order_value
                or Decimal("0")
            ),
            "purchase_frequency": (
                summary.purchase_frequency
                or Decimal("0")
            ),
            "first_purchase_date": (
                summary.first_purchase_date
            ),
            "last_purchase_date": (
                summary.last_purchase_date
            ),
        }
    )

    # ------------------------------------------------------------------------
    # Customer Segment
    # ------------------------------------------------------------------------

    result["segment"] = _segment(
        summary
    )

    # ------------------------------------------------------------------------
    # Detailed Information
    # ------------------------------------------------------------------------

    if detail:
        # Favorite Product
        favorite_product = None

        if summary.favorite_product_id:
            favorite_product = db.get(
                Product,
                summary.favorite_product_id,
            )

        result["favorite_product"] = (
            favorite_product.name
            if favorite_product
            else None
        )

        # Favorite Category
        favorite_category = None

        if summary.favorite_category_id:
            favorite_category = db.get(
                Category,
                summary.favorite_category_id,
            )

        result["favorite_category"] = (
            favorite_category.name
            if favorite_category
            else None
        )

        # --------------------------------------------------------------------
        # Recent Transactions
        # --------------------------------------------------------------------

        recent_sales = (
            db.query(Sale)
            .filter(
                Sale.company_id
                == customer.company_id,
                Sale.customer_id
                == customer.id,
            )
            .order_by(
                Sale.sale_date.desc()
            )
            .limit(10)
            .all()
        )

        result["recent_transactions"] = [
            {
                "id": sale.id,
                "invoice_number": (
                    sale.invoice_number
                ),
                "date": sale.sale_date,
                "amount": (
                    sale.total_amount
                    or Decimal("0")
                ),
                "payment_method": (
                    sale.payment_method
                ),
            }
            for sale in recent_sales
        ]

        # --------------------------------------------------------------------
        # Customer Timeline
        # --------------------------------------------------------------------

        timeline = (
            db.query(CustomerTimeline)
            .filter(
                CustomerTimeline.customer_id
                == customer.id
            )
            .order_by(
                CustomerTimeline.created_at.desc()
            )
            .limit(30)
            .all()
        )

        result["timeline"] = [
            {
                "id": event.id,
                "event_type": event.event_type,
                "description": event.description,
                "created_at": event.created_at,
            }
            for event in timeline
        ]

    return result


# ============================================================================
# Create Customer
# ============================================================================


def create(
    db: Session,
    data,
    company_id: int,
    actor,
    ip: str,
    browser: str,
) -> Customer:
    """
    Create a new customer.
    """

    # ------------------------------------------------------------------------
    # Email Duplicate Check
    # ------------------------------------------------------------------------

    existing_email = (
        db.query(Customer)
        .filter(
            Customer.company_id == company_id,
            Customer.email == str(data.email),
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A customer with this email "
                "already exists."
            ),
        )

    # ------------------------------------------------------------------------
    # Phone Duplicate Check
    # ------------------------------------------------------------------------

    existing_phone = (
        db.query(Customer)
        .filter(
            Customer.company_id == company_id,
            Customer.phone == data.phone,
        )
        .first()
    )

    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A customer with this phone "
                "number already exists."
            ),
        )

    # ------------------------------------------------------------------------
    # Customer ID
    # ------------------------------------------------------------------------

    customer_count = (
        db.query(Customer)
        .filter(
            Customer.company_id == company_id
        )
        .count()
    )

    customer_id = (
        f"CUST-"
        f"{datetime.now(timezone.utc).year}-"
        f"{customer_count + 1:06d}"
    )

    # ------------------------------------------------------------------------
    # Create Customer
    # ------------------------------------------------------------------------

    customer_data = data.model_dump()

    customer = Customer(
        company_id=company_id,
        customer_id=customer_id,
        **customer_data,
    )

    db.add(customer)

    db.flush()

    # ------------------------------------------------------------------------
    # Timeline
    # ------------------------------------------------------------------------

    timeline = CustomerTimeline(
        customer_id=customer.id,
        event_type="REGISTERED",
        description="Customer registered",
    )

    db.add(timeline)

    # ------------------------------------------------------------------------
    # Notification
    # ------------------------------------------------------------------------

    notification = Notification(
        company_id=company_id,
        type=NotificationType.CUSTOMER_REGISTERED,
        message=(
            f"New customer registered: "
            f"{customer.full_name}"
        ),
    )

    db.add(notification)

    # ------------------------------------------------------------------------
    # Audit Log
    # ------------------------------------------------------------------------

    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=AuditAction.CUSTOMER_CREATED,
        ip_address=ip,
        browser=browser,
        entity_name=customer.full_name,
    )

    db.commit()

    db.refresh(customer)

    return customer


# ============================================================================
# Get Customer
# ============================================================================


def get(
    db: Session,
    id: int,
    company: int,
) -> Customer:
    """
    Get customer belonging to the current company.
    """

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == id,
            Customer.company_id == company,
        )
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    return customer


# ============================================================================
# Update Customer
# ============================================================================


def update(
    db: Session,
    id: int,
    data,
    company: int,
    actor,
    ip: str,
    browser: str,
) -> Customer:
    """
    Update an existing customer.
    """

    customer = get(
        db,
        id,
        company,
    )

    changes = data.model_dump(
        exclude_unset=True
    )

    # ------------------------------------------------------------------------
    # Email Duplicate Check
    # ------------------------------------------------------------------------

    if "email" in changes:
        existing_email = (
            db.query(Customer)
            .filter(
                Customer.company_id == company,
                Customer.id != id,
                Customer.email
                == str(changes["email"]),
            )
            .first()
        )

        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A customer with this email "
                    "already exists."
                ),
            )

    # ------------------------------------------------------------------------
    # Phone Duplicate Check
    # ------------------------------------------------------------------------

    if "phone" in changes:
        existing_phone = (
            db.query(Customer)
            .filter(
                Customer.company_id == company,
                Customer.id != id,
                Customer.phone
                == changes["phone"],
            )
            .first()
        )

        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A customer with this phone "
                    "number already exists."
                ),
            )

    # ------------------------------------------------------------------------
    # Previous Status
    # ------------------------------------------------------------------------

    previous_status = customer.status

    # ------------------------------------------------------------------------
    # Apply Changes
    # ------------------------------------------------------------------------

    for key, value in changes.items():
        setattr(
            customer,
            key,
            value,
        )

    # ------------------------------------------------------------------------
    # Synchronize Names
    # ------------------------------------------------------------------------

    if (
        "first_name" in changes
        or "last_name" in changes
    ):
        first_name = (
            customer.first_name or ""
        ).strip()

        last_name = (
            customer.last_name or ""
        ).strip()

        if not first_name or not last_name:
            raise HTTPException(
                status_code=(
                    status.HTTP_422_UNPROCESSABLE_ENTITY
                ),
                detail=(
                    "Both first name and last name "
                    "are required."
                ),
            )

        customer.first_name = first_name
        customer.last_name = last_name

        customer.full_name = (
            f"{first_name} {last_name}"
        )

    elif (
        "full_name" in changes
        and customer.full_name
    ):
        full_name = customer.full_name.strip()

        parts = full_name.split(
            maxsplit=1
        )

        if len(parts) < 2:
            raise HTTPException(
                status_code=(
                    status.HTTP_422_UNPROCESSABLE_ENTITY
                ),
                detail=(
                    "Both first name and last name "
                    "are required."
                ),
            )

        customer.full_name = full_name
        customer.first_name = parts[0]
        customer.last_name = parts[1]

    # ------------------------------------------------------------------------
    # Determine Timeline Event
    # ------------------------------------------------------------------------

    if previous_status == customer.status:
        event_type = "PROFILE_UPDATED"

        audit_action = (
            AuditAction.CUSTOMER_UPDATED
        )

    elif customer.status == "ACTIVE":
        event_type = "REACTIVATED"

        audit_action = (
            AuditAction.CUSTOMER_ACTIVATED
        )

    else:
        event_type = "DEACTIVATED"

        audit_action = (
            AuditAction.CUSTOMER_DEACTIVATED
        )

    # ------------------------------------------------------------------------
    # Timeline
    # ------------------------------------------------------------------------

    timeline = CustomerTimeline(
        customer_id=customer.id,
        event_type=event_type,
        description=(
            f"Customer "
            f"{event_type.lower().replace('_', ' ')}"
        ),
    )

    db.add(timeline)

    # ------------------------------------------------------------------------
    # Audit
    # ------------------------------------------------------------------------

    log_action(
        db,
        company_id=company,
        user_id=actor.id,
        action=audit_action,
        ip_address=ip,
        browser=browser,
        entity_name=customer.full_name,
    )

    db.commit()

    db.refresh(customer)

    return customer


# ============================================================================
# Delete / Deactivate Customer
# ============================================================================


def delete(
    db: Session,
    id: int,
    company: int,
    actor,
    ip: str,
    browser: str,
) -> None:
    """
    Soft-delete a customer by changing status to INACTIVE.

    Historical sales are preserved.
    """

    customer = get(
        db,
        id,
        company,
    )

    # ------------------------------------------------------------------------
    # Already Inactive
    # ------------------------------------------------------------------------

    if customer.status == "INACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer is already inactive.",
        )

    # ------------------------------------------------------------------------
    # Deactivate
    # ------------------------------------------------------------------------

    customer.status = "INACTIVE"

    # ------------------------------------------------------------------------
    # Timeline
    # ------------------------------------------------------------------------

    timeline = CustomerTimeline(
        customer_id=customer.id,
        event_type="DEACTIVATED",
        description=(
            "Customer soft deleted"
        ),
    )

    db.add(timeline)

    # ------------------------------------------------------------------------
    # Audit
    # ------------------------------------------------------------------------

    log_action(
        db,
        company_id=company,
        user_id=actor.id,
        action=AuditAction.CUSTOMER_DELETED,
        ip_address=ip,
        browser=browser,
        entity_name=customer.full_name,
    )

    db.commit()