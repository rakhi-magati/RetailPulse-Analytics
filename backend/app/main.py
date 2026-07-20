from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.categories import router as categories_router
from app.api.product import router as products_router
from app.api.sales import router as sales_router
from app.api.notifications import router as notifications_router

# Create all tables (use Alembic migrations for production schema changes)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="RetailPulse Analytics API",
    description="Multi-tenant retail analytics platform - Company onboarding & authentication",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AccessLogMiddleware)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(categories_router)
app.include_router(products_router)
app.include_router(sales_router)
app.include_router(notifications_router)


@app.get("/")
def root():
    return {"message": "RetailPulse Analytics Backend Running 🚀"}


@app.get("/health")
def health():
    return {"status": "ok"}
