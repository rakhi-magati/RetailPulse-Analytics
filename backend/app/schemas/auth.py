from pydantic import BaseModel, EmailStr, Field, field_validator


class CompanyRegisterSchema(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=100)
    industry: str
    company_email: EmailStr
    company_address: str
    company_phone: str

    owner_name: str
    owner_email: EmailStr

    password: str = Field(..., min_length=8)
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class LoginSchema(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenSchema(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    success: bool
    message: str
