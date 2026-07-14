from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False)

    industry = Column(String(255), nullable=False)

    email = Column(String(255), unique=True, nullable=False)

    address = Column(String(500), nullable=False)

    phone = Column(String(20), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())