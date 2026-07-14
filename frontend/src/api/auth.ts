import { apiClient } from "./client";
import type {
  ApiMessageResponse,
  ChangePasswordRequest,
  CompanyRegisterRequest,
  LoginRequest,
  TokenResponse,
  UserProfile,
} from "../types/auth";

export const authApi = {
  register: (payload: CompanyRegisterRequest) =>
    apiClient
      .post<ApiMessageResponse>("/auth/register", payload)
      .then((res) => res.data),

  login: (payload: LoginRequest) =>
    apiClient
      .post<TokenResponse>("/auth/login", payload)
      .then((res) => res.data),

  logout: (refreshToken: string) =>
    apiClient
      .post<ApiMessageResponse>("/auth/logout", {
        refresh_token: refreshToken,
      })
      .then((res) => res.data),

  me: () => apiClient.get<UserProfile>("/auth/me").then((res) => res.data),

  changePassword: (payload: ChangePasswordRequest) =>
    apiClient
      .post<ApiMessageResponse>("/auth/change-password", payload)
      .then((res) => res.data),
};

export const usersApi = {
  listCompanyUsers: () =>
    apiClient.get<UserProfile[]>("/users").then((res) => res.data),
};
