from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User


def get_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_by_id_in_company(db: Session, user_id: int, company_id: int) -> Optional[User]:
    """
    Fetch a user but ONLY if it belongs to the given company.
    Use this (never a bare get-by-id) anywhere a company-scoped
    caller looks up a user, so Company A can never touch Company B's rows.
    """
    return (
        db.query(User)
        .filter(User.id == user_id, User.company_id == company_id)
        .first()
    )


def list_by_company(db: Session, company_id: int):
    return db.query(User).filter(User.company_id == company_id).all()
