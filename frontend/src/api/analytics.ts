import { apiClient } from "./client";
import type {
  AnalyticsDashboard,
  AnalyticsFilters,
  Granularity,
  KPIKey,
  PaymentMethodBreakdownItem,
  RevenueTrendPoint,
  SalesSummaryKPIs,
  TopCustomerItem,
  TopProductItem,
} from "../types/analytics";

function buildParams(filters: AnalyticsFilters, extra: Record<string, unknown> = {}) {
  const dateTo = filters.date_to && !filters.date_to.includes("T")
    ? `${filters.date_to}T23:59:59.999`
    : filters.date_to;
  return { ...filters, date_to: dateTo, ...extra };
}

export const analyticsApi = {
  dashboard: (filters: AnalyticsFilters, granularity: Granularity) =>
    apiClient
      .get<AnalyticsDashboard>("/analytics/dashboard", {
        params: buildParams(filters, { granularity }),
      })
      .then((res) => res.data),

  salesSummary: (filters: AnalyticsFilters) =>
    apiClient
      .get<SalesSummaryKPIs>("/analytics/sales/summary", {
        params: buildParams(filters),
      })
      .then((res) => res.data),

  salesTrend: (filters: AnalyticsFilters, granularity: Granularity) =>
    apiClient
      .get<{ granularity: string; trend: RevenueTrendPoint[] }>("/analytics/sales/trend", {
        params: buildParams(filters, { granularity }),
      })
      .then((res) => res.data),

  salesProducts: (filters: AnalyticsFilters, sortBy: "revenue" | "quantity" = "revenue", limit = 10) =>
    apiClient
      .get<{ products: TopProductItem[] }>("/analytics/sales/products", {
        params: buildParams(filters, { sort_by: sortBy, limit }),
      })
      .then((res) => res.data),

  salesCustomers: (filters: AnalyticsFilters, limit = 10) =>
    apiClient
      .get<{ customers: TopCustomerItem[] }>("/analytics/sales/customers", {
        params: buildParams(filters, { limit }),
      })
      .then((res) => res.data),

  salesPaymentMethods: (filters: AnalyticsFilters) =>
    apiClient
      .get<{ payment_methods: PaymentMethodBreakdownItem[] }>("/analytics/sales/payment-methods", {
        params: buildParams(filters),
      })
      .then((res) => res.data),

  salesExport: (format: "csv" | "pdf", filters: AnalyticsFilters, granularity: Granularity) =>
    apiClient
      .get(`/analytics/sales/export`, {
        params: buildParams(filters, { granularity, format }),
        responseType: "blob",
      })
      .then((res) => res.data as Blob),

  drillDownKpi: (kpiKey: KPIKey, filters: AnalyticsFilters) =>
    apiClient
      .get<Record<string, unknown>[]>(`/analytics/drill-down/kpi/${kpiKey}`, { params: buildParams(filters) })
      .then((res) => res.data),

  drillDownCategory: (categoryId: number, filters: AnalyticsFilters) =>
    apiClient
      .get<Record<string, unknown>[]>(`/analytics/drill-down/category/${categoryId}`, { params: buildParams(filters) })
      .then((res) => res.data),

  drillDownProduct: (productId: number, filters: AnalyticsFilters) =>
    apiClient
      .get<Record<string, unknown>[]>(`/analytics/drill-down/product/${productId}`, { params: buildParams(filters) })
      .then((res) => res.data),

  export: (
    format: "csv" | "pdf",
    filters: AnalyticsFilters,
    granularity: Granularity
  ) =>
    apiClient
      .get(`/analytics/export`, {
        params: buildParams(filters, { granularity, format }),
        responseType: "blob",
      })
      .then((res) => res.data as Blob),
};
