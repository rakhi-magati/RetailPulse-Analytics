from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base


class DataImport(Base):
    __tablename__ = "data_imports"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    import_type = Column(String(20), nullable=False)
    filename = Column(String(255), nullable=False)
    source_csv = Column(Text, nullable=False)
    total_records = Column(Integer, nullable=False, default=0)
    valid_records = Column(Integer, nullable=False, default=0)
    successful_records = Column(Integer, nullable=False, default=0)
    failed_records = Column(Integer, nullable=False, default=0)
    duplicate_records = Column(Integer, nullable=False, default=0)
    status = Column(String(30), nullable=False, default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    uploader = relationship("User")
    errors = relationship("DataImportError", back_populates="data_import", cascade="all, delete-orphan")


class DataImportError(Base):
    __tablename__ = "data_import_errors"
    id = Column(Integer, primary_key=True)
    import_id = Column(Integer, ForeignKey("data_imports.id"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    row_data = Column(Text, nullable=False)
    error_type = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    data_import = relationship("DataImport", back_populates="errors")
