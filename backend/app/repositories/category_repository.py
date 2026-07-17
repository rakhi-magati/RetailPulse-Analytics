from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product


def get_by_id_in_company(db: Session, category_id: int, company_id: int) -> Optional[Category]:
    """
    Fetch a category but ONLY if it belongs to the given company.
    Never look up a category by bare id anywhere a company-scoped
    caller is involved, so Company A can never touch Company B's rows.
    """
    return (
        db.query(Category)
        .filter(Category.id == category_id, Category.company_id == company_id)
        .first()
    )


def get_by_name_in_company(db: Session, name: str, company_id: int, exclude_id: Optional[int] = None) -> Optional[Category]:
    query = db.query(Category).filter(
        Category.company_id == company_id,
        func.lower(Category.name) == name.strip().lower(),
    )
    if exclude_id is not None:
        query = query.filter(Category.id != exclude_id)
    return query.first()


def list_with_product_counts(
    db: Session,
    company_id: int,
    search: Optional[str] = None,
):
    """
    Returns a list of (Category, product_count) tuples, scoped to the company.
    """
    query = (
        db.query(Category, func.count(Product.id).label("product_count"))
        .outerjoin(Product, Product.category_id == Category.id)
        .filter(Category.company_id == company_id)
    )

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(Category.name.ilike(like))

    query = query.group_by(Category.id).order_by(Category.name.asc())
    return query.all()


def count_by_company(db: Session, company_id: int) -> int:
    return db.query(func.count(Category.id)).filter(Category.company_id == company_id).scalar() or 0


def create(db: Session, category: Category) -> Category:
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update(db: Session, category: Category) -> Category:
    db.commit()
    db.refresh(category)
    return category


def delete(db: Session, category: Category) -> None:
    db.delete(category)
    db.commit()


def product_count(db: Session, category_id: int) -> int:
    return db.query(func.count(Product.id)).filter(Product.category_id == category_id).scalar() or 0
