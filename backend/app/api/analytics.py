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
from app.schemas.analytics import AnalyticsDashboardOut
from app.services import analytics_service
from app.utils.request_meta import get_client_browser, get_client_ip

router = APIRouter(prefix="/analytics", tags=["Analytics Dashboard"])

# Company Admins and Analysts can view the Analytics Dashboard.
ReadAccess = Depends(require_roles(UserRole.COMPANY_ADMIN, UserRole.ANALYST))


def _build_filters(
    date_from: Optional[datetime],
    date_to: Optional[datetime],
    product_id: Optional[int],
    category_id: Optional[int],
    brand: Optional[str],
    sales_channel: Optional[SalesChannel],
    payment_method: Optional[PaymentMethod],
) -> AnalyticsFilters:
    return AnalyticsFilters(
        date_from=date_from,
        date_to=date_to,
        product_id=product_id,
        category_id=category_id,
        brand=brand,
        sales_channel=sales_channel,
        payment_method=payment_method,
    )


# Shared query-param declarations so every endpoint below exposes the exact
# same set of Dashboard Filters (Date Range, Product, Category, Brand,
# Sales Channel, Payment Method).
def _filter_params(
    date_from: Optional[datetime] = Query(None, description="Filter records on/after this date"),
    date_to: Optional[datetime] = Query(None, description="Filter records on/before this date"),
    product_id: Optional[int] = Query(None, description="Filter by product"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    sales_channel: Optional[SalesChannel] = Query(None, description="Filter by sales channel"),
    payment_method: Optional[PaymentMethod] = Query(None, description="Filter by payment method"),
) -> AnalyticsFilters:
    return _build_filters(date_from, date_to, product_id, category_id, brand, sales_channel, payment_method)


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
    """
    Returns the full Analytics Dashboard payload: KPI cards, sales analytics
    charts, and inventory analytics charts, all scoped to the current
    company and the selected filters. Also drives the manual Refresh button
    (the frontend simply re-calls this endpoint).
    """
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
    """Detailed records behind a clicked KPI card."""
    return analytics_service.drill_down_kpi(db, company_id, kpi_key, filters)


@router.get("/drill-down/category/{target_category_id}")
def drill_down_category(
    target_category_id: int,
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    """Category -> Product drill-down."""
    return analytics_service.drill_down_category(db, company_id, target_category_id, filters)


@router.get("/drill-down/product/{target_product_id}")
def drill_down_product(
    target_product_id: int,
    filters: AnalyticsFilters = Depends(_filter_params),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    """Product -> Individual Sales Transactions drill-down."""
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
