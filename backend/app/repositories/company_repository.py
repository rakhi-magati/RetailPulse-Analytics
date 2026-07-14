from typing import Optional

from sqlalchemy.orm import Session

from app.models.company import Company


def get_by_email(db: Session, email: str) -> Optional[Company]:
    return db.query(Company).filter(Company.email == email).first()


def get_by_id(db: Session, company_id: int) -> Optional[Company]:
    return db.query(Company).filter(Company.id == company_id).first()
