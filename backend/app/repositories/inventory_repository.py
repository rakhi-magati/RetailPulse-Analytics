from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.enums import StockStatus
from app.models.category import Category
from app.models.inventory import Inventory, InventoryMovement
from app.models.product import Product


def get_by_id_in_company(db: Session, inventory_id: int, company_id: int) -> Optional[Inventory]:
    """
    Fetch an inventory row but ONLY if it belongs to the given company.
    Never look up inventory by bare id anywhere a company-scoped caller
    is involved, so Company A can never touch Company B's rows.
    """
    return (
        db.query(Inventory)
        .options(joinedload(Inventory.product).joinedload(Product.category))
        .filter(Inventory.id == inventory_id, Inventory.company_id == company_id)
        .first()
    )


def get_by_product_id(db: Session, product_id: int, company_id: Optional[int] = None) -> Optional[Inventory]:
    query = db.query(Inventory).filter(Inventory.product_id == product_id)
    if company_id is not None:
        query = query.filter(Inventory.company_id == company_id)
    return query.first()


def list_filtered(
    db: Session,
    company_id: int,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    stock_status: Optional[StockStatus] = None,
    brand: Optional[str] = None,
    sort_by: str = "updated",
):
    query = (
        db.query(Inventory)
        .join(Product, Inventory.product_id == Product.id)
        .options(joinedload(Inventory.product).joinedload(Product.category))
        .filter(Inventory.company_id == company_id)
    )

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(Product.name.ilike(like), Product.sku.ilike(like)))

    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    if brand:
        query = query.filter(Product.brand.ilike(f"%{brand.strip()}%"))

    if stock_status is not None:
        query = query.filter(Inventory.stock_status == stock_status)

    if sort_by == "name":
        query = query.order_by(Product.name.asc())
    elif sort_by == "stock":
        query = query.order_by(Inventory.current_stock.asc())
    else:  # "updated" (default) => most recently updated first
        query = query.order_by(Inventory.updated_at.desc())

    return query.all()


def create(db: Session, inventory: Inventory) -> Inventory:
    db.add(inventory)
    db.commit()
    db.refresh(inventory)
    return inventory


def update(db: Session, inventory: Inventory) -> Inventory:
    db.commit()
    db.refresh(inventory)
    return inventory


def delete_by_product_id(db: Session, product_id: int) -> None:
    db.query(Inventory).filter(Inventory.product_id == product_id).delete()
    db.commit()


def add_movement(db: Session, movement: InventoryMovement) -> InventoryMovement:
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


def list_movements(
    db: Session,
    company_id: int,
    inventory_id: Optional[int] = None,
    product_id: Optional[int] = None,
):
    query = (
        db.query(InventoryMovement)
        .join(Inventory, InventoryMovement.inventory_id == Inventory.id)
        .options(joinedload(InventoryMovement.inventory).joinedload(Inventory.product))
        .filter(Inventory.company_id == company_id)
    )
    if inventory_id is not None:
        query = query.filter(InventoryMovement.inventory_id == inventory_id)
    if product_id is not None:
        query = query.filter(Inventory.product_id == product_id)
    return query.order_by(InventoryMovement.created_at.desc()).all()


def dashboard_counts(db: Session, company_id: int) -> dict:
    total_products = (
        db.query(func.count(Inventory.id)).filter(Inventory.company_id == company_id).scalar() or 0
    )
    total_quantity = (
        db.query(func.coalesce(func.sum(Inventory.current_stock), 0))
        .filter(Inventory.company_id == company_id)
        .scalar()
        or 0
    )
    low_stock = (
        db.query(func.count(Inventory.id))
        .filter(Inventory.company_id == company_id, Inventory.stock_status == StockStatus.LOW_STOCK)
        .scalar()
        or 0
    )
    out_of_stock = (
        db.query(func.count(Inventory.id))
        .filter(Inventory.company_id == company_id, Inventory.stock_status == StockStatus.OUT_OF_STOCK)
        .scalar()
        or 0
    )
    return {
        "total_products": total_products,
        "total_inventory_quantity": int(total_quantity),
        "low_stock_products": low_stock,
        "out_of_stock_products": out_of_stock,
    }


def category_breakdown(db: Session, company_id: int):
    return (
        db.query(
            Category.id,
            Category.name,
            func.coalesce(func.sum(Inventory.current_stock), 0).label("total_quantity"),
        )
        .join(Product, Product.category_id == Category.id)
        .join(Inventory, Inventory.product_id == Product.id)
        .filter(Inventory.company_id == company_id)
        .group_by(Category.id, Category.name)
        .order_by(Category.name.asc())
        .all()
    )


def stock_status_breakdown(db: Session, company_id: int):
    return (
        db.query(Inventory.stock_status, func.count(Inventory.id).label("count"))
        .filter(Inventory.company_id == company_id)
        .group_by(Inventory.stock_status)
        .all()
    )
