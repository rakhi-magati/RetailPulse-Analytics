from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_company_id, get_current_user, require_roles
from app.core.enums import PaymentMethod, SalesChannel, UserRole
from app.database.database import get_db
from app.models.user import User
from app.repositories.analytics_repository import AnalyticsFilters
from app.schemas.analytics import (
    AnalyticsDashboardOut,
    PaymentMethodsResponse,
    SalesSummaryKPIs,
    SalesTrendResponse,
    TopCustomersResponse,
    TopProductsResponse,
)
from app.services import analytics_service
from app.utils.request_meta import get_client_browser, get_client_ip

router = APIRouter(prefix="/analytics", tags=["Analytics Dashboard"])

ReadAccess = Depends(require_roles(UserRole.COMPANY_ADMIN, UserRole.ANALYST))


def _build_filters(
    date_from: Optional[datetime],
    date_to: Optional[datetime],
    product_id: Optional[int],
    category_id: Optional[int],
    brand: Optional[str],
    sales_channel: Optional[SalesChannel],
    payment_method: Optional[PaymentMethod],
    customer_id: Optional[int],
    customer_name: Optional[str],
) -> AnalyticsFilters:
    return AnalyticsFilters(
        date_from=date_from,
        date_to=date_to,
        product_id=product_id,
        category_id=category_id,
        brand=brand,
        sales_channel=sales_channel,
        payment_method=payment_method,
        customer_id=customer_id,
        customer_name=customer_name,
    )


def _filter_params(
    date_from: Optional[datetime] = Query(None, description="Filter records on/after this date"),
    date_to: Optional[datetime] = Query(None, description="Filter records on/before this date"),
    product_id: Optional[int] = Query(None, description="Filter by product"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    sales_channel: Optional[SalesChannel] = Query(None, description="Filter by sales channel"),
    payment_method: Optional[PaymentMethod] = Query(None, description="Filter by payment method"),
    customer_id: Optional[int] = Query(None, description="Filter by customer ID"),
    customer_name: Optional[str] = Query(None, description="Filter by customer name"),
) -> AnalyticsFilters:
    if date_from and date_to and date_from > date_to:
        # Keep validation consistent for every individual analytics endpoint,
        # not only for the combined dashboard endpoint.
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from cannot be after date_to",
        )
    return _build_filters(
        date_from, date_to, product_id, category_id, brand, sales_channel, payment_method, customer_id, customer_name
    )


@router.get("/sales/summary", response_model=SalesSummaryKPIs)
def get_sales_summary(
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    """GET /api/analytics/sales/summary: Returns Sales KPI Summary."""
    return analytics_service.get_sales_summary(db, company_id, filters)


@router.get("/sales/trend", response_model=SalesTrendResponse)
def get_sales_trend(
    granularity: str = Query("daily", description="One of: daily, weekly, monthly"),
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    """GET /api/analytics/sales/trend: Returns revenue and order trends over time."""
    return analytics_service.get_sales_trend(db, company_id, filters, granularity)


@router.get("/sales/products", response_model=TopProductsResponse)
def get_top_products(
    limit: int = Query(10, ge=1, le=100),
    sort_by: str = Query("revenue", description="Sort by revenue or quantity"),
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    """GET /api/analytics/sales/products: Returns top products by revenue or quantity sold."""
    if sort_by not in {"revenue", "quantity"}:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="sort_by must be either 'revenue' or 'quantity'",
        )
    return analytics_service.get_top_products(db, company_id, filters, limit=limit, sort_by=sort_by)


@router.get("/sales/customers", response_model=TopCustomersResponse)
def get_top_customers(
    limit: int = Query(10, ge=1, le=100),
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    """GET /api/analytics/sales/customers: Returns top customers by revenue contribution."""
    return analytics_service.get_top_customers(db, company_id, filters, limit=limit)


@router.get("/sales/payment-methods", response_model=PaymentMethodsResponse)
def get_payment_methods(
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    """GET /api/analytics/sales/payment-methods: Returns payment method breakdown."""
    return analytics_service.get_payment_methods(db, company_id, filters)


@router.get("/sales/export")
def export_sales_report(
    request: Request,
    format: str = Query(..., description="csv or pdf"),
    granularity: str = Query("daily", description="One of: daily, weekly, monthly"),
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=ReadAccess,
):
    """GET /api/analytics/sales/export: Export sales report as CSV or PDF."""
    content, media_type, filename = analytics_service.export_report(
        db,
        company_id,
        filters,
        granularity,
        format,
        actor_id=current_user.id,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/dashboard", response_model=AnalyticsDashboardOut)
def get_dashboard(
    request: Request,
    granularity: str = Query("daily", description="One of: daily, weekly, monthly"),
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=ReadAccess,
):
    return analytics_service.get_dashboard(
        db,
        company_id,
        filters,
        granularity,
        actor_id=current_user.id,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )


@router.get("/drill-down/kpi/{kpi_key}")
def drill_down_kpi(
    kpi_key: str,
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    return analytics_service.drill_down_kpi(db, company_id, kpi_key, filters)


@router.get("/drill-down/category/{target_category_id}")
def drill_down_category(
    target_category_id: int,
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    return analytics_service.drill_down_category(db, company_id, target_category_id, filters)


@router.get("/drill-down/product/{target_product_id}")
def drill_down_product(
    target_product_id: int,
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    return analytics_service.drill_down_product(db, company_id, target_product_id, filters)


@router.get("/export")
def export_report(
    request: Request,
    format: str = Query(..., description="csv or pdf"),
    granularity: str = Query("daily", description="One of: daily, weekly, monthly"),
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=ReadAccess,
):
    content, media_type, filename = analytics_service.export_report(
        db,
        company_id,
        filters,
        granularity,
        format,
        actor_id=current_user.id,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
