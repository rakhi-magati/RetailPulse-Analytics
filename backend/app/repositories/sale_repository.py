from datetime import datetime
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.enums import PaymentMethod, SalesChannel
from app.models.product import Product
from app.models.sale import Sale, SaleItem


def get_by_id_in_company(db: Session, sale_id: int, company_id: int) -> Optional[Sale]:
    """
    Fetch a sale but ONLY if it belongs to the given company, mirroring the
    tenant-isolation pattern used for products/categories.
    """
    return (
        db.query(Sale)
        .options(
            joinedload(Sale.items).joinedload(SaleItem.product),
            joinedload(Sale.items).joinedload(SaleItem.category),
            joinedload(Sale.creator),
        )
        .filter(Sale.id == sale_id, Sale.company_id == company_id)
        .first()
    )


def get_by_invoice_in_company(db: Session, invoice_number: str, company_id: int, exclude_id: Optional[int] = None) -> Optional[Sale]:
    query = db.query(Sale).filter(
        Sale.company_id == company_id,
        Sale.invoice_number == invoice_number,
    )
    if exclude_id is not None:
        query = query.filter(Sale.id != exclude_id)
    return query.first()


def latest_invoice_sequence(db: Session, company_id: int, year: int) -> int:
    """
    Returns the highest sequence number already used for this company's
    invoices in the given year (e.g. INV-2026-000042 -> 42), or 0 if none.
    """
    prefix = f"INV-{year}-"
    latest = (
        db.query(Sale.invoice_number)
        .filter(Sale.company_id == company_id, Sale.invoice_number.like(f"{prefix}%"))
        .order_by(Sale.invoice_number.desc())
        .first()
    )
    if not latest:
        return 0
    try:
        return int(latest[0].split("-")[-1])
    except (ValueError, IndexError):
        return 0


def list_filtered(
    db: Session,
    company_id: int,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    category_id: Optional[int] = None,
    sales_channel: Optional[SalesChannel] = None,
    payment_method: Optional[PaymentMethod] = None,
    sort_by: str = "date",
    sort_dir: str = "desc",
):
    query = (
        db.query(Sale)
        .options(joinedload(Sale.items).joinedload(SaleItem.product))
        .filter(Sale.company_id == company_id)
    )

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Sale.invoice_number.ilike(like),
                Sale.customer_name.ilike(like),
                Sale.items.any(SaleItem.product.has(Product.name.ilike(like))),
            )
        )

    if date_from is not None:
        query = query.filter(Sale.sale_date >= date_from)

    if date_to is not None:
        query = query.filter(Sale.sale_date <= date_to)

    if category_id is not None:
        query = query.filter(Sale.items.any(SaleItem.category_id == category_id))

    if sales_channel is not None:
        query = query.filter(Sale.sales_channel == sales_channel)

    if payment_method is not None:
        query = query.filter(Sale.payment_method == payment_method)

    query = query.distinct()

    sort_column = {
        "date": Sale.sale_date,
        "invoice_number": Sale.invoice_number,
        "total_amount": Sale.total_amount,
    }.get(sort_by, Sale.sale_date)

    query = query.order_by(sort_column.asc() if sort_dir == "asc" else sort_column.desc())

    return query.all()


def count_by_company(db: Session, company_id: int) -> int:
    return db.query(func.count(Sale.id)).filter(Sale.company_id == company_id).scalar() or 0


def sum_revenue(db: Session, company_id: int) -> float:
    return db.query(func.coalesce(func.sum(Sale.total_amount), 0)).filter(Sale.company_id == company_id).scalar() or 0


def sum_items_sold(db: Session, company_id: int) -> int:
    return (
        db.query(func.coalesce(func.sum(SaleItem.quantity), 0))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.company_id == company_id)
        .scalar()
        or 0
    )


def create(db: Session, sale: Sale) -> Sale:
    db.add(sale)
    db.commit()
    db.refresh(sale)
    return sale


def update(db: Session, sale: Sale) -> Sale:
    db.commit()
    db.refresh(sale)
    return sale


def delete(db: Session, sale: Sale) -> None:
    db.delete(sale)
    db.commit()
