from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator

class ForecastGenerateRequest(BaseModel):
    forecast_period: str = Field(..., pattern="^(7d|30d|90d|custom)$")
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    @model_validator(mode="after")
    def validate_custom_range(self):
        if self.forecast_period == "custom":
            if not self.date_from or not self.date_to:
                raise ValueError("date_from and date_to are required for a custom forecast")
            if self.date_to < self.date_from:
                raise ValueError("date_to cannot be before date_from")
        return self

class ForecastProductOut(BaseModel):
    id: int; product_id: int; product_name: str; category_id: int; category_name: str
    brand: Optional[str] = None; current_stock: int; reorder_level: int; historical_sales: int
    predicted_demand: int; forecast_period: str; period_start: date; period_end: date
    confidence_score: float; accuracy: float; growth_percentage: float; recommendation: str; generated_at: datetime

class ForecastCategoryOut(BaseModel):
    category_id: int; category_name: str; total_historical_sales: int; predicted_demand: int; expected_growth_percentage: float

class ForecastDashboardOut(BaseModel):
    kpis: dict; products: List[ForecastProductOut]; categories: List[ForecastCategoryOut]
    historical_vs_forecast: List[dict]; product_demand_trend: List[dict]; category_demand_trend: List[dict]
    top_predicted_products: List[dict]; seasonal_sales_pattern: List[dict]

