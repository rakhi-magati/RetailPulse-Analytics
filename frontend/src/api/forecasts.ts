import { apiClient } from "./client";
import type { ForecastDashboard, ForecastPeriod, ForecastRequest } from "../types/forecast";
export const forecastApi = {
  dashboard: (params: { forecast_period: ForecastPeriod; date_from?: string; date_to?: string; product_id?: number; category_id?: number; brand?: string; sort_by?: string }) => apiClient.get<ForecastDashboard>("/forecasts/dashboard", { params }).then(r => r.data),
  generate: (payload: ForecastRequest) => apiClient.post("/forecasts/generate", payload).then(r => r.data),
  refresh: (payload: ForecastRequest) => apiClient.post("/forecasts/refresh", payload).then(r => r.data),
  export: (report_type: "demand" | "product" | "category", payload: ForecastRequest) => apiClient.get("/forecasts/export", { params: { report_type, ...payload }, responseType: "blob" }).then(r => r.data as Blob),
};

