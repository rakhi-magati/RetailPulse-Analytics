from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.enums import ProductStatus
from app.models.product import Product


def get_by_id_in_company(db: Session, product_id: int, company_id: int) -> Optional[Product]:
    """
    Fetch a product but ONLY if it belongs to the given company.
    Never look up a product by bare id anywhere a company-scoped
    caller is involved, so Company A can never touch Company B's rows.
    """
    return (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.id == product_id, Product.company_id == company_id)
        .first()
    )


def get_by_sku_in_company(db: Session, sku: str, company_id: int, exclude_id: Optional[int] = None) -> Optional[Product]:
    query = db.query(Product).filter(
        Product.company_id == company_id,
        func.upper(Product.sku) == sku.strip().upper(),
    )
    if exclude_id is not None:
        query = query.filter(Product.id != exclude_id)
    return query.first()


def get_by_name_in_category(db: Session, name: str, category_id: int, exclude_id: Optional[int] = None) -> Optional[Product]:
    query = db.query(Product).filter(
        Product.category_id == category_id,
        func.lower(Product.name) == name.strip().lower(),
    )
    if exclude_id is not None:
        query = query.filter(Product.id != exclude_id)
    return query.first()


def list_filtered(
    db: Session,
    company_id: int,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    status: Optional[ProductStatus] = None,
    brand: Optional[str] = None,
    sort_by: str = "recent",
):
    query = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.company_id == company_id)
    )

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(like),
                Product.sku.ilike(like),
                Product.brand.ilike(like),
            )
        )

    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    if status is not None:
        query = query.filter(Product.status == status)

    if brand:
        query = query.filter(Product.brand.ilike(f"%{brand.strip()}%"))

    if sort_by == "name":
        query = query.order_by(Product.name.asc())
    elif sort_by == "price":
        query = query.order_by(Product.unit_price.asc())
    else:  # "recent" (default)
        query = query.order_by(Product.created_at.desc())

    return query.all()


def count_by_company(db: Session, company_id: int) -> int:
    return db.query(func.count(Product.id)).filter(Product.company_id == company_id).scalar() or 0


def count_by_company_and_status(db: Session, company_id: int, status: ProductStatus) -> int:
    return (
        db.query(func.count(Product.id))
        .filter(Product.company_id == company_id, Product.status == status)
        .scalar()
        or 0
    )


def create(db: Session, product: Product) -> Product:
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update(db: Session, product: Product) -> Product:
    db.commit()
    db.refresh(product)
    return product


def delete(db: Session, product: Product) -> None:
    db.delete(product)
    db.commit()
