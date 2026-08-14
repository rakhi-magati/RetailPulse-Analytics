import { apiClient } from "./client";

import type {
    ForecastDashboard,
    ForecastPeriod,
    ForecastRequest,
} from "../types/forecast";

export const forecastApi = {
    dashboard: (params: {
        forecast_period: ForecastPeriod;
        date_from?: string;
        date_to?: string;
        product_id?: number;
        category_id?: number;
        brand?: string;
        sort_by?: string;
    }) =>
        apiClient
            .get<ForecastDashboard>("/forecasts/dashboard", {
                params,
            })
            .then((response) => response.data),

    generate: (payload: ForecastRequest) =>
        apiClient
            .post("/forecasts/generate", payload)
            .then((response) => response.data),

    refresh: (payload: ForecastRequest) =>
        apiClient
            .post("/forecasts/refresh", payload)
            .then((response) => response.data),

    export: (
        reportType: "demand" | "product" | "category",
        payload: ForecastRequest
    ) =>
        apiClient
            .get("/forecasts/export", {
                params: {
                    report_type: reportType,
                    ...payload,
                },
                responseType: "blob",
            })
            .then((response) => response.data as Blob),
};