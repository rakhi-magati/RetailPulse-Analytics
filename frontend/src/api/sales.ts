import { apiClient } from "./client";
import type {
  Sale,
  SaleCreateRequest,
  SaleFilters,
  SaleListItem,
  SaleUpdateRequest,
  SalesDashboardSummary,
} from "../types/sales";

export const salesApi = {
  list: (filters: SaleFilters = {}) =>
    apiClient
      .get<SaleListItem[]>("/sales", { params: filters })
      .then((res) => res.data),

  get: (id: number) => apiClient.get<Sale>(`/sales/${id}`).then((res) => res.data),

  create: (payload: SaleCreateRequest) =>
    apiClient.post<Sale>("/sales", payload).then((res) => res.data),

  update: (id: number, payload: SaleUpdateRequest) =>
    apiClient.put<Sale>(`/sales/${id}`, payload).then((res) => res.data),

  remove: (id: number) => apiClient.delete(`/sales/${id}`),

  dashboardSummary: () =>
    apiClient
      .get<SalesDashboardSummary>("/sales/dashboard-summary")
      .then((res) => res.data),
};
