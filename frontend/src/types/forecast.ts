export type ForecastPeriod =
    | "7d"
    | "30d"
    | "90d"
    | "custom";

export interface ForecastProduct {
    id: number;
    product_id: number;
    product_name: string;
    category_id: number;
    category_name: string;
    brand?: string;
    current_stock: number;
    reorder_level: number;
    historical_sales: number;
    predicted_demand: number;
    forecast_period: ForecastPeriod;
    period_start: string;
    period_end: string;
    confidence_score: number;
    accuracy: number;
    growth_percentage: number;
    recommendation: string;
    generated_at: string;
}

export interface ForecastCategory {
    category_id: number;
    category_name: string;
    total_historical_sales: number;
    predicted_demand: number;
    expected_growth_percentage: number;
}

export interface ForecastDashboard {
    kpis: {
        total_predicted_demand: number;
        products_expected_to_run_out: number;
        high_growth_products: number;
        slow_moving_products: number;
        forecast_accuracy: number;
    };

    products: ForecastProduct[];

    categories: ForecastCategory[];

    historical_vs_forecast: {
        product_name: string;
        historical_sales: number;
        predicted_demand: number;
    }[];

    product_demand_trend: {
        product_name: string;
        historical_sales: number;
        predicted_demand: number;
    }[];

    category_demand_trend: ForecastCategory[];

    top_predicted_products: {
        product_name: string;
        predicted_demand: number;
    }[];

    seasonal_sales_pattern: {
        month: string;
        sales: number;
    }[];
}

export interface ForecastRequest {
    forecast_period: ForecastPeriod;
    date_from?: string;
    date_to?: string;
}