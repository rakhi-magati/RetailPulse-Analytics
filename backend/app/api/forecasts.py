from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.auth.dependencies import get_current_company_id, get_current_user, require_roles
from app.core.enums import UserRole
from app.database.database import get_db
from app.models.user import User
from app.schemas.forecast import ForecastDashboardOut, ForecastGenerateRequest
from app.services import forecast_service
from app.utils.request_meta import get_client_browser, get_client_ip

router = APIRouter(prefix="/forecasts", tags=["Demand Forecasting"])
ReadAccess = Depends(require_roles(UserRole.COMPANY_ADMIN, UserRole.ANALYST))
AdminOnly = Depends(require_roles(UserRole.COMPANY_ADMIN))

@router.post("/generate")
def generate_forecasts(payload: ForecastGenerateRequest, request: Request, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id), current_user: User = Depends(get_current_user), _=AdminOnly):
    return forecast_service.generate(db, company_id, payload.forecast_period, payload.date_from, payload.date_to, current_user.id, get_client_ip(request), get_client_browser(request))

@router.post("/refresh")
def refresh_forecasts(payload: ForecastGenerateRequest, request: Request, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id), current_user: User = Depends(get_current_user), _=AdminOnly):
    return forecast_service.generate(db, company_id, payload.forecast_period, payload.date_from, payload.date_to, current_user.id, get_client_ip(request), get_client_browser(request), refresh=True)

@router.get("/dashboard", response_model=ForecastDashboardOut)
def forecast_dashboard(forecast_period: str = Query("30d", pattern="^(7d|30d|90d|custom)$"), date_from: Optional[date] = None, date_to: Optional[date] = None, product_id: Optional[int] = None, category_id: Optional[int] = None, brand: Optional[str] = None, sort_by: str = Query("predicted_demand", pattern="^(predicted_demand|lowest_stock|growth|accuracy)$"), db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id), _=ReadAccess):
    return forecast_service.dashboard(db, company_id, forecast_period, date_from, date_to, product_id, category_id, brand, sort_by)

@router.get("/export")
def export_forecast(report_type: str = Query(..., pattern="^(demand|product|category)$"), forecast_period: str = Query("30d", pattern="^(7d|30d|90d|custom)$"), date_from: Optional[date] = None, date_to: Optional[date] = None, request: Request = None, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id), current_user: User = Depends(get_current_user), _=ReadAccess):
    report_type = "pdf" if report_type == "product" else report_type
    content, media_type, filename = forecast_service.export_report(db, company_id, forecast_period, report_type, date_from, date_to, current_user.id, get_client_ip(request), get_client_browser(request))
    return Response(content, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{filename}"'})

