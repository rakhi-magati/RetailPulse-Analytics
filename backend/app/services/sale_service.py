from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.enums import AuditAction, NotificationType, PaymentMethod, SalesChannel
from app.models.notification import Notification
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.models.customer import Customer
from app.repositories import notification_repository, product_repository, sale_repository
from app.schemas.sale import SaleCreate, SaleItemCreate, SaleUpdate
from app.services import inventory_service, forecast_service
from app.services.audit_service import log_action

MAX_INVOICE_RETRIES = 5


def _generate_invoice_number(db: Session, company_id: int) -> str:
    year = datetime.now(timezone.utc).year
    sequence = sale_repository.latest_invoice_sequence(db, company_id, year) + 1
    return f"INV-{year}-{sequence:06d}"


def _load_product_for_sale(db: Session, product_id: int, company_id: int) -> Product:
    product = product_repository.get_by_id_in_company(db, product_id, company_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with id {product_id} does not exist for this company",
        )
    return product


def _deduct_stock(
    db: Session,
    items: List[SaleItemCreate],
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> None:
    """
    Validates availability for every line item first (so a multi-item sale
    either succeeds completely or fails completely), then deducts stock.
    """
    products_by_id = {}
    for item in items:
        product = _load_product_for_sale(db, item.product_id, company_id)
        already_requested = products_by_id.get(product.id)
        requested_qty = item.quantity + (already_requested[1] if already_requested else 0)
        if requested_qty > product.stock_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for '{product.name}'. "
                    f"Available: {product.stock_quantity}, requested: {requested_qty}"
                ),
            )
        products_by_id[product.id] = (product, requested_qty)

    for product, requested_qty in products_by_id.values():
        product.stock_quantity -= requested_qty
        product_repository.update(db, product)

        # Records the "Sale" movement against the Inventory module, logs the
        # INVENTORY_UPDATED audit entry, and raises Low/Out-of-Stock
        # notifications when the product crosses those thresholds.
        inventory_service.apply_sale_movement(db, product, requested_qty, actor, ip_address, browser)


def _restore_stock(
    db: Session,
    sale: Sale,
    actor: Optional[User] = None,
    ip_address: str = "unknown",
    browser: str = "unknown",
) -> None:
    """Reverses the stock deduction for every item on a sale (used on update/delete)."""
    for item in sale.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product.stock_quantity += item.quantity
            product_repository.update(db, product)
            if actor is not None:
                inventory_service.apply_sale_reversal(db, product, actor, ip_address, browser)


def _price_item(item: SaleItemCreate, product: Product) -> dict:
    # Product prices are authoritative; the request price is display-only.
    unit_price = Decimal(str(product.unit_price))
    if unit_price <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product '{product.name}' has no valid sale price")
    line_value = unit_price * item.quantity
    if item.discount > line_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discount cannot exceed total product value",
        )
    total = (line_value - item.discount) + item.tax
    return {
        "product_id": item.product_id,
        "category_id": product.category_id,
        "quantity": item.quantity,
        "unit_price": unit_price,
        "discount": item.discount,
        "tax": item.tax,
        "total": total,
    }


def create_sale(
    db: Session,
    data: SaleCreate,
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> Sale:
    if not data.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product selection is mandatory")

    customer = None
    if data.customer_id is not None:
        customer = db.query(Customer).filter(Customer.id == data.customer_id, Customer.company_id == company_id).first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer does not exist for this company")
        if customer.status != "ACTIVE":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot record a sale for an inactive customer")

    # Validate customer before changing inventory, then validate and deduct stock.
    _deduct_stock(db, data.items, company_id, actor, ip_address, browser)

    subtotal = Decimal("0")
    discount_total = Decimal("0")
    tax_total = Decimal("0")
    priced_items = []
    for item in data.items:
        product = product_repository.get_by_id_in_company(db, item.product_id, company_id)
        priced = _price_item(item, product)
        priced_items.append(priced)
        subtotal += priced["unit_price"] * item.quantity
        discount_total += item.discount
        tax_total += item.tax

    total_amount = (subtotal - discount_total) + tax_total

    invoice_number = None
    sale = None
    for attempt in range(MAX_INVOICE_RETRIES):
        invoice_number = _generate_invoice_number(db, company_id)
        sale = Sale(
            company_id=company_id,
            invoice_number=invoice_number,
            customer_name=customer.full_name if customer else data.customer_name,
            customer_id=customer.id if customer else None,
            sale_date=data.sale_date or datetime.now(timezone.utc),
            sales_channel=data.sales_channel,
            payment_method=data.payment_method,
            payment_status=data.payment_status,
            subtotal=subtotal,
            discount_total=discount_total,
            tax_total=tax_total,
            total_amount=total_amount,
            created_by=actor.id,
        )
        sale.items = [SaleItem(**fields) for fields in priced_items]
        try:
            sale = sale_repository.create(db, sale)
            break
        except IntegrityError:
            db.rollback()
            sale = None
            continue

    if sale is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not generate a unique invoice number. Please try again.",
        )

    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=AuditAction.SALE_CREATED,
        ip_address=ip_address,
        browser=browser,
        entity_name=sale.invoice_number,
    )

    forecast_service.refresh_existing_for_company(db, company_id, actor.id, ip_address, browser)
    return get_sale(db, sale.id, company_id)


def serialize_sale(sale: Sale) -> dict:
    """Builds a SaleOut-shaped dict, filling in product/category names for each item."""
    return {
        "id": sale.id,
        "company_id": sale.company_id,
        "invoice_number": sale.invoice_number,
        "customer_name": sale.customer_name,
        "customer_id": sale.customer_id,
        "sale_date": sale.sale_date,
        "sales_channel": sale.sales_channel,
        "payment_method": sale.payment_method,
        "payment_status": sale.payment_status,
        "subtotal": sale.subtotal,
        "discount_total": sale.discount_total,
        "tax_total": sale.tax_total,
        "total_amount": sale.total_amount,
        "created_by": sale.created_by,
        "created_by_name": sale.creator.name if sale.creator else None,
        "created_at": sale.created_at,
        "updated_at": sale.updated_at,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else None,
                "sku": item.product.sku if item.product else None,
                "category_id": item.category_id,
                "category_name": item.category.name if item.category else None,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "discount": item.discount,
                "tax": item.tax,
                "total": item.total,
            }
            for item in sale.items
        ],
    }


def serialize_sale_list_item(sale: Sale) -> dict:
    product_names = [item.product.name for item in sale.items if item.product]
    summary = ", ".join(product_names[:2])
    if len(product_names) > 2:
        summary += f" +{len(product_names) - 2} more"

    return {
        "id": sale.id,
        "invoice_number": sale.invoice_number,
        "customer_name": sale.customer_name,
        "customer_id": sale.customer_id,
        "sale_date": sale.sale_date,
        "sales_channel": sale.sales_channel,
        "payment_method": sale.payment_method,
        "payment_status": sale.payment_status,
        "total_amount": sale.total_amount,
        "item_count": len(sale.items),
        "product_summary": summary or None,
    }


def get_sale(db: Session, sale_id: int, company_id: int) -> Sale:
    sale = sale_repository.get_by_id_in_company(db, sale_id, company_id)
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    return sale


def list_sales(
    db: Session,
    company_id: int,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    category_id: Optional[int] = None,
    sales_channel: Optional[SalesChannel] = None,
    payment_method: Optional[PaymentMethod] = None,
    payment_status: Optional[str] = None,
    sort_by: str = "date",
    sort_dir: str = "desc",
) -> List[Sale]:
    return sale_repository.list_filtered(
        db,
        company_id=company_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        sales_channel=sales_channel,
        payment_method=payment_method,
        payment_status=payment_status,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )


def update_sale(
    db: Session,
    sale_id: int,
    data: SaleUpdate,
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> Sale:
    sale = get_sale(db, sale_id, company_id)

    if data.customer_name is not None:
        sale.customer_name = data.customer_name
    if data.sale_date is not None:
        sale.sale_date = data.sale_date
    if data.customer_id is not None:
        customer = db.query(Customer).filter(Customer.id == data.customer_id, Customer.company_id == company_id).first()
        if not customer: raise HTTPException(status_code=400, detail="Customer does not exist for this company")
        sale.customer_id, sale.customer_name = customer.id, customer.full_name
    if data.sales_channel is not None:
        sale.sales_channel = data.sales_channel
    if data.payment_method is not None:
        sale.payment_method = data.payment_method
    if data.payment_status is not None:
        sale.payment_status = data.payment_status

    if data.items is not None:
        # Reverse the previous stock deduction, then re-validate and
        # re-deduct against the new set of line items.
        _restore_stock(db, sale, actor=actor, ip_address=ip_address, browser=browser)

        _deduct_stock(db, data.items, company_id, actor, ip_address, browser)

        subtotal = Decimal("0")
        discount_total = Decimal("0")
        tax_total = Decimal("0")
        priced_items = []
        for item in data.items:
            product = product_repository.get_by_id_in_company(db, item.product_id, company_id)
            priced = _price_item(item, product)
            priced_items.append(priced)
            subtotal += priced["unit_price"] * item.quantity
            discount_total += item.discount
            tax_total += item.tax

        sale.items = [SaleItem(**fields) for fields in priced_items]
        sale.subtotal = subtotal
        sale.discount_total = discount_total
        sale.tax_total = tax_total
        sale.total_amount = (subtotal - discount_total) + tax_total

    sale = sale_repository.update(db, sale)

    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=AuditAction.SALE_UPDATED,
        ip_address=ip_address,
        browser=browser,
        entity_name=sale.invoice_number,
    )

    forecast_service.refresh_existing_for_company(db, company_id, actor.id, ip_address, browser)
    return get_sale(db, sale.id, company_id)


def delete_sale(
    db: Session,
    sale_id: int,
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> None:
    sale = get_sale(db, sale_id, company_id)
    invoice_number = sale.invoice_number

    _restore_stock(db, sale, actor=actor, ip_address=ip_address, browser=browser)

    sale_repository.delete(db, sale)

    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=AuditAction.SALE_DELETED,
        ip_address=ip_address,
        browser=browser,
        entity_name=invoice_number,
    )
    forecast_service.refresh_existing_for_company(db, company_id, actor.id, ip_address, browser)


def dashboard_summary(db: Session, company_id: int) -> dict:
    total_orders = sale_repository.count_by_company(db, company_id)
    total_revenue = Decimal(str(sale_repository.sum_revenue(db, company_id)))
    total_sales = sale_repository.sum_items_sold(db, company_id)
    average_order_value = (total_revenue / total_orders) if total_orders else Decimal("0")

    return {
        "total_sales": total_sales,
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "average_order_value": average_order_value,
    }
