from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_company_id, get_current_user, require_roles
from app.core.enums import PaymentMethod, SalesChannel, UserRole
from app.database.database import get_db
from app.models.user import User
from app.schemas.sale import (
    SaleCreate,
    SaleListOut,
    SaleOut,
    SalesDashboardSummary,
    SaleUpdate,
)
from app.services import sale_service
from app.utils.request_meta import get_client_browser, get_client_ip

router = APIRouter(prefix="/sales", tags=["Sales"])

# Sales Management is available to Company Admins and Analysts.
SalesAccess = Depends(require_roles(UserRole.COMPANY_ADMIN, UserRole.ANALYST))


@router.get("", response_model=List[SaleListOut])
def list_sales(
    search: Optional[str] = Query(None, description="Search by invoice number, customer name, or product name"),
    date_from: Optional[datetime] = Query(None, description="Filter sales on/after this date"),
    date_to: Optional[datetime] = Query(None, description="Filter sales on/before this date"),
    category_id: Optional[int] = Query(None, description="Filter by product category"),
    sales_channel: Optional[SalesChannel] = Query(None, description="Filter by sales channel"),
    payment_method: Optional[PaymentMethod] = Query(None, description="Filter by payment method"),
    sort_by: str = Query("date", description="One of: date, invoice_number, total_amount"),
    sort_dir: str = Query("desc", description="asc or desc"),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=SalesAccess,
):
    sales = sale_service.list_sales(
        db,
        company_id=company_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        sales_channel=sales_channel,
        payment_method=payment_method,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return [sale_service.serialize_sale_list_item(s) for s in sales]


@router.get("/dashboard-summary", response_model=SalesDashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=SalesAccess,
):
    """Summary cards: Total Sales, Total Revenue, Total Orders, Average Order Value."""
    return sale_service.dashboard_summary(db, company_id)


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=SalesAccess,
):
    sale = sale_service.get_sale(db, sale_id, company_id)
    return sale_service.serialize_sale(sale)


@router.post("", response_model=SaleOut, status_code=201)
def create_sale(
    payload: SaleCreate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=SalesAccess,
):
    sale = sale_service.create_sale(
        db,
        payload,
        company_id,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
    return sale_service.serialize_sale(sale)


@router.put("/{sale_id}", response_model=SaleOut)
def update_sale(
    sale_id: int,
    payload: SaleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=SalesAccess,
):
    sale = sale_service.update_sale(
        db,
        sale_id,
        payload,
        company_id,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
    return sale_service.serialize_sale(sale)


@router.delete("/{sale_id}", status_code=204)
def delete_sale(
    sale_id: int,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=SalesAccess,
):
    sale_service.delete_sale(
        db,
        sale_id,
        company_id,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
    return None
