from datetime import date
from sqlalchemy.orm import Session, joinedload
from app.models.demand_forecast import DemandForecast

def list_for_period(db: Session, company_id: int, forecast_period: str, period_start: date, period_end: date):
    return db.query(DemandForecast).options(joinedload(DemandForecast.product), joinedload(DemandForecast.category), joinedload(DemandForecast.history)).filter(
        DemandForecast.company_id == company_id, DemandForecast.forecast_period == forecast_period,
        DemandForecast.period_start == period_start, DemandForecast.period_end == period_end).all()

def get_existing(db: Session, company_id: int, product_id: int, forecast_period: str, period_start: date, period_end: date):
    return db.query(DemandForecast).filter(DemandForecast.company_id == company_id, DemandForecast.product_id == product_id,
        DemandForecast.forecast_period == forecast_period, DemandForecast.period_start == period_start, DemandForecast.period_end == period_end).first()

