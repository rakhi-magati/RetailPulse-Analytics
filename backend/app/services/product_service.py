from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.enums import AuditAction, ProductStatus
from app.models.product import Product
from app.models.user import User
from app.repositories import category_repository, product_repository
from app.schemas.product import ProductCreate, ProductUpdate
from app.services.audit_service import log_action


def _ensure_category_belongs_to_company(db: Session, category_id: int, company_id: int):
    category = category_repository.get_by_id_in_company(db, category_id, company_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected category does not exist for this company",
        )
    return category


def list_products(
    db: Session,
    company_id: int,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    status_filter: Optional[ProductStatus] = None,
    brand: Optional[str] = None,
    sort_by: str = "recent",
) -> List[Product]:
    return product_repository.list_filtered(
        db,
        company_id=company_id,
        search=search,
        category_id=category_id,
        status=status_filter,
        brand=brand,
        sort_by=sort_by,
    )


def get_product(db: Session, product_id: int, company_id: int) -> Product:
    product = product_repository.get_by_id_in_company(db, product_id, company_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def create_product(
    db: Session,
    data: ProductCreate,
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> Product:
    _ensure_category_belongs_to_company(db, data.category_id, company_id)

    if product_repository.get_by_sku_in_company(db, data.sku, company_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"SKU '{data.sku}' already exists for this company",
        )

    if product_repository.get_by_name_in_category(db, data.name, data.category_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A product with this name already exists in the selected category",
        )

    product = Product(
        company_id=company_id,
        category_id=data.category_id,
        name=data.name,
        sku=data.sku,
        brand=data.brand,
        description=data.description,
        unit_price=data.unit_price,
        cost_price=data.cost_price,
        stock_quantity=data.stock_quantity,
        unit_of_measure=data.unit_of_measure,
        status=data.status,
    )
    product = product_repository.create(db, product)

    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=AuditAction.PRODUCT_CREATED,
        ip_address=ip_address,
        browser=browser,
        entity_name=product.name,
    )
    return product


def update_product(
    db: Session,
    product_id: int,
    data: ProductUpdate,
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> Product:
    product = get_product(db, product_id, company_id)

    new_category_id = data.category_id if data.category_id is not None else product.category_id
    if data.category_id is not None:
        _ensure_category_belongs_to_company(db, data.category_id, company_id)

    new_sku = data.sku if data.sku is not None else product.sku
    if data.sku is not None and data.sku.strip().upper() != product.sku.strip().upper():
        if product_repository.get_by_sku_in_company(db, new_sku, company_id, exclude_id=product.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"SKU '{new_sku}' already exists for this company",
            )

    new_name = data.name if data.name is not None else product.name
    name_or_category_changed = (
        (data.name is not None and data.name.strip().lower() != product.name.strip().lower())
        or (data.category_id is not None and data.category_id != product.category_id)
    )
    if name_or_category_changed:
        if product_repository.get_by_name_in_category(db, new_name, new_category_id, exclude_id=product.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A product with this name already exists in the selected category",
            )

    # Cross-field validation: cost price cannot exceed unit price, using
    # whichever values end up in effect after applying the partial update.
    effective_unit_price = data.unit_price if data.unit_price is not None else product.unit_price
    effective_cost_price = data.cost_price if data.cost_price is not None else product.cost_price
    if effective_cost_price > effective_unit_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cost Price cannot exceed Unit Price",
        )

    status_changed_to = None
    if data.status is not None and data.status != product.status:
        status_changed_to = data.status

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    product = product_repository.update(db, product)

    if status_changed_to is not None:
        action = (
            AuditAction.PRODUCT_ACTIVATED
            if status_changed_to == ProductStatus.ACTIVE
            else AuditAction.PRODUCT_DEACTIVATED
        )
        log_action(
            db,
            company_id=company_id,
            user_id=actor.id,
            action=action,
            ip_address=ip_address,
            browser=browser,
            entity_name=product.name,
        )
    else:
        log_action(
            db,
            company_id=company_id,
            user_id=actor.id,
            action=AuditAction.PRODUCT_UPDATED,
            ip_address=ip_address,
            browser=browser,
            entity_name=product.name,
        )

    return product


def set_product_status(
    db: Session,
    product_id: int,
    new_status: ProductStatus,
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> Product:
    product = get_product(db, product_id, company_id)

    if product.status == new_status:
        return product

    product.status = new_status
    product = product_repository.update(db, product)

    action = (
        AuditAction.PRODUCT_ACTIVATED
        if new_status == ProductStatus.ACTIVE
        else AuditAction.PRODUCT_DEACTIVATED
    )
    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=action,
        ip_address=ip_address,
        browser=browser,
        entity_name=product.name,
    )
    return product


def delete_product(
    db: Session,
    product_id: int,
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> None:
    product = get_product(db, product_id, company_id)
    name = product.name
    product_repository.delete(db, product)

    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=AuditAction.PRODUCT_DELETED,
        ip_address=ip_address,
        browser=browser,
        entity_name=name,
    )


def dashboard_summary(db: Session, company_id: int) -> dict:
    total_products = product_repository.count_by_company(db, company_id)
    active_products = product_repository.count_by_company_and_status(db, company_id, ProductStatus.ACTIVE)
    inactive_products = product_repository.count_by_company_and_status(db, company_id, ProductStatus.INACTIVE)
    total_categories = category_repository.count_by_company(db, company_id)
    return {
        "total_products": total_products,
        "active_products": active_products,
        "inactive_products": inactive_products,
        "total_categories": total_categories,
    }
