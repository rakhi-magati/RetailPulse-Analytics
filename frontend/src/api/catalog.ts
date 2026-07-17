import { apiClient } from "./client";
import type {
  Category,
  CategoryCreateRequest,
  CategoryUpdateRequest,
  DashboardSummary,
  Product,
  ProductCreateRequest,
  ProductFilters,
  ProductStatus,
  ProductUpdateRequest,
} from "../types/catalog";

export const categoriesApi = {
  list: (search?: string) =>
    apiClient
      .get<Category[]>("/categories", { params: search ? { search } : {} })
      .then((res) => res.data),

  get: (id: number) =>
    apiClient.get<Category>(`/categories/${id}`).then((res) => res.data),

  create: (payload: CategoryCreateRequest) =>
    apiClient.post<Category>("/categories", payload).then((res) => res.data),

  update: (id: number, payload: CategoryUpdateRequest) =>
    apiClient
      .put<Category>(`/categories/${id}`, payload)
      .then((res) => res.data),

  remove: (id: number) => apiClient.delete(`/categories/${id}`),
};

export const productsApi = {
  list: (filters: ProductFilters = {}) =>
    apiClient
      .get<Product[]>("/products", { params: filters })
      .then((res) => res.data),

  get: (id: number) =>
    apiClient.get<Product>(`/products/${id}`).then((res) => res.data),

  create: (payload: ProductCreateRequest) =>
    apiClient.post<Product>("/products", payload).then((res) => res.data),

  update: (id: number, payload: ProductUpdateRequest) =>
    apiClient
      .put<Product>(`/products/${id}`, payload)
      .then((res) => res.data),

  setStatus: (id: number, status: ProductStatus) =>
    apiClient
      .patch<Product>(`/products/${id}/status`, { status })
      .then((res) => res.data),

  remove: (id: number) => apiClient.delete(`/products/${id}`),

  dashboardSummary: () =>
    apiClient
      .get<DashboardSummary>("/products/dashboard-summary")
      .then((res) => res.data),
};
