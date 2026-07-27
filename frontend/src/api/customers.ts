import { apiClient } from "./client";

export type Customer = {
    id: number;
    customer_id: string;
    full_name: string;
    email: string;
    phone: string;
    customer_type: "RETAIL" | "WHOLESALE" | "CORPORATE";
    status: "ACTIVE" | "INACTIVE";
    city?: string;
    state?: string;
    country?: string;
    created_at: string;
    total_orders: number;
    total_revenue: number;
    average_order_value: number;
    last_purchase_date?: string;
    segment: string;
};

export type CustomerInput = {
    full_name: string;
    email: string;
    phone: string;
    customer_type: "RETAIL" | "WHOLESALE" | "CORPORATE";
    status?: "ACTIVE" | "INACTIVE";
    city?: string;
    state?: string;
    country?: string;
    address?: string;
    gender?: string;
    preferred_sales_channel?: string;
};

export const customersApi = {
    list: (params?: Record<string, unknown>) =>
        apiClient
            .get<Customer[]>("/customers", { params })
            .then((response) => response.data),

    get: (id: number) =>
        apiClient
            .get<
                Customer & {
                    recent_transactions: unknown[];
                    timeline: unknown[];
                }
            >(`/customers/${id}`)
            .then((response) => response.data),

    create: (data: CustomerInput) =>
        apiClient
            .post<Customer>("/customers", data)
            .then((response) => response.data),

    update: (id: number, data: Partial<CustomerInput>) =>
        apiClient
            .put<Customer>(`/customers/${id}`, data)
            .then((response) => response.data),

    remove: (id: number) =>
        apiClient.delete(`/customers/${id}`),

    analytics: () =>
        apiClient
            .get("/customers/analytics")
            .then((response) => response.data),

    exportCsv: () =>
        apiClient
            .get("/customers/export/csv", {
                responseType: "blob",
            })
            .then((response) => response.data),
};