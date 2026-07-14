export type UserRole = "SUPER_ADMIN" | "COMPANY_ADMIN" | "ANALYST" | "VIEWER";

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface CompanyBrief {
  id: number;
  name: string;
  industry: string;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  last_login: string | null;
  created_at: string;
  company: CompanyBrief;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CompanyRegisterRequest {
  company_name: string;
  industry: string;
  company_email: string;
  company_address: string;
  company_phone: string;
  owner_name: string;
  owner_email: string;
  password: string;
  confirm_password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ApiMessageResponse {
  success: boolean;
  message: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
}
