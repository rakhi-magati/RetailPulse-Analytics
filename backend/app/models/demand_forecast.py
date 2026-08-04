from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base


class DemandForecast(Base):
    __tablename__ = "demand_forecasts"
    __table_args__ = (UniqueConstraint("company_id", "product_id", "forecast_period", "period_start", "period_end", name="uq_forecast_company_product_period"),)
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True)
    forecast_period = Column(String(30), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    predicted_demand = Column(Integer, nullable=False)
    confidence_score = Column(Numeric(5, 2), nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    company = relationship("Company")
    product = relationship("Product")
    category = relationship("Category")
    history = relationship("ForecastHistory", back_populates="forecast", cascade="all, delete-orphan")


class ForecastHistory(Base):
    __tablename__ = "forecast_history"
    id = Column(Integer, primary_key=True, index=True)
    forecast_id = Column(Integer, ForeignKey("demand_forecasts.id", ondelete="CASCADE"), nullable=False, index=True)
    historical_sales = Column(Integer, nullable=False)
    prediction = Column(Integer, nullable=False)
    accuracy = Column(Numeric(5, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    forecast = relationship("DemandForecast", back_populates="history")

