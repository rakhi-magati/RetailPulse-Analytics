from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_company_id, get_current_user, require_roles
from app.core.enums import StockStatus, UserRole
from app.database.database import get_db
from app.models.user import User
from app.schemas.inventory import (
    InventoryCharts,
    InventoryDashboardSummary,
    InventoryMovementOut,
    InventoryOut,
    ReorderLevelUpdate,
    StockAdjustmentCreate,
    InventoryForecastResponse,
    InventoryForecastDetail,
)
from app.services import inventory_service, inventory_forecast_service
from app.utils.request_meta import get_client_browser, get_client_ip

router = APIRouter(prefix="/inventory", tags=["Inventory"])

# Company Admins and Analysts can view; only Admins can mutate stock.
ReadAccess = Depends(require_roles(UserRole.COMPANY_ADMIN, UserRole.ANALYST))
AdminOnly = Depends(require_roles(UserRole.COMPANY_ADMIN))


@router.get("", response_model=List[InventoryOut])
def list_inventory(
    search: Optional[str] = Query(None, description="Search by product name or SKU"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    stock_status: Optional[StockStatus] = Query(None, description="Filter by stock status"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    sort_by: str = Query("updated", description="One of: name, stock, updated"),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    return inventory_service.list_inventory(
        db,
        company_id=company_id,
        search=search,
        category_id=category_id,
        stock_status=stock_status,
        brand=brand,
        sort_by=sort_by,
    )


@router.get("/forecast", response_model=InventoryForecastResponse)
def inventory_forecast(
    forecast_days: int = Query(30, description="Forecast horizon: 7, 30, or 90 days"),
    category_id: Optional[int] = None,
    product_id: Optional[int] = None,
    stock_risk: Optional[str] = Query(None, pattern="^(OUT_OF_STOCK|STOCKOUT_RISK|LOW_STOCK|HEALTHY|OVERSTOCK)$"),
    reorder_required: Optional[bool] = None,
    sort_by: str = Query("stock_risk", pattern="^(current_stock|forecasted_demand|days_remaining|recommended_quantity|stock_risk)$"),
    db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id), _=ReadAccess,
):
    return inventory_forecast_service.build_forecast(
        db, company_id, forecast_days, category_id, product_id, stock_risk, reorder_required, sort_by
    )


@router.get("/recommendations", response_model=InventoryForecastResponse)
def inventory_recommendations(
    forecast_days: int = Query(30), category_id: Optional[int] = None,
    stock_risk: Optional[str] = None, reorder_required: Optional[bool] = None,
    db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id), _=ReadAccess,
):
    return inventory_forecast_service.build_forecast(
        db, company_id, forecast_days, category_id, None, stock_risk, reorder_required, "stock_risk"
    )


@router.get("/recommendations/{product_id}", response_model=InventoryForecastDetail)
def inventory_recommendation_detail(
    product_id: int, forecast_days: int = Query(30), db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id), _=ReadAccess,
):
    return inventory_forecast_service.recommendation_detail(db, company_id, product_id, forecast_days)

@router.get("/dashboard-summary", response_model=InventoryDashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    return inventory_service.dashboard_summary(db, company_id)


@router.get("/charts", response_model=InventoryCharts)
def get_charts(
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    return inventory_service.charts(db, company_id)


@router.get("/movements", response_model=List[InventoryMovementOut])
def list_all_movements(
    product_id: Optional[int] = Query(None, description="Filter movement history by product"),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    movements = inventory_service.list_movements(db, company_id, product_id=product_id)
    return [inventory_service.serialize_movement(m) for m in movements]


@router.get("/product/{product_id}", response_model=InventoryOut)
def get_product_inventory(
    product_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    return inventory_service.get_inventory(db, product_id, company_id)


@router.get("/product/{product_id}/movements", response_model=List[InventoryMovementOut])
def get_product_movements(
    product_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=ReadAccess,
):
    movements = inventory_service.list_movements(db, company_id, product_id=product_id)
    return [inventory_service.serialize_movement(m) for m in movements]


@router.post("/product/{product_id}/adjust", response_model=InventoryOut)
def adjust_stock(
    product_id: int,
    payload: StockAdjustmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=AdminOnly,
):
    """Add stock, remove stock, or apply a manual stock-count adjustment."""
    return inventory_service.adjust_stock(
        db,
        product_id,
        company_id,
        payload,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )


@router.patch("/product/{product_id}/reorder-level", response_model=InventoryOut)
def update_reorder_level(
    product_id: int,
    payload: ReorderLevelUpdate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=AdminOnly,
):
    return inventory_service.update_reorder_level(
        db,
        product_id,
        company_id,
        payload,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
