from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SqlEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base
from app.core.enums import UserRole, UserStatus


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)

    email = Column(String(255), unique=True, nullable=False, index=True)

    password = Column(String(255), nullable=False)

    role = Column(
        SqlEnum(UserRole, native_enum=False, length=50),
        default=UserRole.COMPANY_ADMIN,
        nullable=False,
    )

    status = Column(
        SqlEnum(UserStatus, native_enum=False, length=20),
        default=UserStatus.ACTIVE,
        nullable=False,
    )

    last_login = Column(DateTime, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", backref="users")
