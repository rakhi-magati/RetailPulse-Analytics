from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_company_id, get_current_user, require_roles
from app.core.enums import ProductStatus, UserRole
from app.database.database import get_db
from app.models.user import User
from app.schemas.product import (
    DashboardSummary,
    ProductCreate,
    ProductOut,
    ProductStatusUpdate,
    ProductUpdate,
)
from app.services import product_service
from app.utils.request_meta import get_client_browser, get_client_ip

router = APIRouter(prefix="/products", tags=["Products"])

# Product creation/editing/deletion is an Admin-only capability.
AdminOnly = Depends(require_roles(UserRole.COMPANY_ADMIN))
# Read-only product browsing is also needed by Analysts recording sales.
ReadAccess = Depends(require_roles(UserRole.COMPANY_ADMIN, UserRole.ANALYST))


@router.get("", response_model=List[ProductOut])
def list_products(
    search: Optional[str] = Query(None, description="Search by product name, SKU, or brand"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    status_filter: Optional[ProductStatus] = Query(None, alias="status", description="Filter by product status"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    sort_by: str = Query("recent", description="One of: name, price, recent"),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    return product_service.list_products(
        db,
        company_id=company_id,
        search=search,
        category_id=category_id,
        status_filter=status_filter,
        brand=brand,
        sort_by=sort_by,
    )


@router.get("/dashboard-summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=AdminOnly,
):
    """Summary cards: Total Products, Active Products, Inactive Products, Total Categories."""
    return product_service.dashboard_summary(db, company_id)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    return product_service.get_product(db, product_id, company_id)


@router.post("", response_model=ProductOut, status_code=201)
def create_product(
    payload: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=AdminOnly,
):
    return product_service.create_product(
        db,
        payload,
        company_id,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=AdminOnly,
):
    return product_service.update_product(
        db,
        product_id,
        payload,
        company_id,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )


@router.patch("/{product_id}/status", response_model=ProductOut)
def set_product_status(
    product_id: int,
    payload: ProductStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=AdminOnly,
):
    """Dedicated enable/disable endpoint (Product Activated / Product Deactivated audit events)."""
    return product_service.set_product_status(
        db,
        product_id,
        payload.status,
        company_id,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=AdminOnly,
):
    product_service.delete_product(
        db,
        product_id,
        company_id,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
    return None
