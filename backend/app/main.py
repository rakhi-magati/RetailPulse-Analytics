from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
import logging

from app.core.config import settings
from app.database.database import Base, engine
from app.middleware.logging_middleware import AccessLogMiddleware

# Import all models so they register with Base before create_all runs
from app.models.company import Company
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.audit_log import AuditLog
from app.models.category import Category
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.notification import Notification
from app.models.inventory import Inventory, InventoryMovement
from app.models.customer import Customer, CustomerPurchaseSummary, CustomerTimeline
from app.models.demand_forecast import DemandForecast, ForecastHistory

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.categories import router as categories_router
from app.api.product import router as products_router
from app.api.sales import router as sales_router
from app.api.notifications import router as notifications_router
from app.api.inventory import router as inventory_router
from app.api.analytics import router as analytics_router
from app.api.customers import router as customers_router
from app.api.forecasts import router as forecasts_router

# Create newly introduced tables, then bring older development databases forward.
# SQLAlchemy create_all does not add columns to a table that already exists.
Base.metadata.create_all(bind=engine)


def ensure_customer_profile_schema() -> None:
    """Add Task 8 customer fields to existing development databases."""
    inspector = inspect(engine)
    if "customers" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("customers")}
    additions = {"first_name": "VARCHAR(100)", "last_name": "VARCHAR(100)", "postal_code": "VARCHAR(20)"}
    with engine.begin() as connection:
        for name, column_type in additions.items():
            if name not in columns:
                connection.execute(text(f"ALTER TABLE customers ADD COLUMN {name} {column_type} NULL"))

def ensure_customer_sales_schema() -> None:
    """Idempotently upgrade legacy sales tables for the Customers module."""
    inspector = inspect(engine)
    if "sales" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("sales")}
    with engine.begin() as connection:
        if "customer_id" not in columns:
            connection.execute(text("ALTER TABLE sales ADD COLUMN customer_id INTEGER NULL"))

    # Refresh metadata after the ALTER so repeated application starts are safe.
    indexes = {index["name"] for index in inspect(engine).get_indexes("sales")}
    if "ix_sales_customer_id" not in indexes:
        with engine.begin() as connection:
            connection.execute(text("CREATE INDEX ix_sales_customer_id ON sales (customer_id)"))


try:
    ensure_customer_profile_schema()
    ensure_customer_sales_schema()
except Exception:
    logging.getLogger("retailpulse.schema").exception(
        "Customer schema upgrade failed. The application cannot safely start."
    )
    raise

app = FastAPI(
    title="RetailPulse Analytics API",
    description="Multi-tenant retail analytics platform - Company onboarding & authentication",
    version="1.0.0",
)

# Add logging first so CORS wraps all responses, including API errors.
app.add_middleware(AccessLogMiddleware)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(categories_router)
app.include_router(products_router)
app.include_router(sales_router)
app.include_router(notifications_router)
app.include_router(inventory_router)
app.include_router(analytics_router)
app.include_router(customers_router)
app.include_router(forecasts_router)


@app.get("/")
def root():
    return {"message": "RetailPulse Analytics Backend Running Ã°Å¸Å¡â‚¬"}


@app.get("/health")
def health():
    return {"status": "ok"}
# Wrap the completed FastAPI app so CORS headers are included even when an
# unexpected server exception produces a 500 response.
app = CORSMiddleware(
    app=app,
    allow_origins=[settings.FRONTEND_ORIGIN, "http://127.0.0.1:5173"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
