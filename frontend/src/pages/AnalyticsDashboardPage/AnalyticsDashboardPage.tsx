import './AnalyticsDashboardPage.css';
import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    MenuItem,
    Paper,
    Select,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import HighlightOffOutlinedIcon from "@mui/icons-material/HighlightOffOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as ChartTooltip,
    XAxis,
    YAxis,
} from "recharts";

import { analyticsApi } from "../../api/analytics";
import { categoriesApi, productsApi } from "../../api/catalog";
import RoleGuard from "../../components/RoleGuard";

import type { PaymentMethod, SalesChannel } from "../../types/sales";
import type { AnalyticsFilters, Granularity, KPIKey } from "../../types/analytics";

const CHART_COLORS = ["#4F46E5", "#22C55E", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

const STOCK_STATUS_COLORS: Record<string, string> = {
    IN_STOCK: "#22C55E",
    LOW_STOCK: "#F59E0B",
    OUT_OF_STOCK: "#EF4444",
};

const CHANNEL_LABELS: Record<SalesChannel, string> = {
    RETAIL_STORE: "Retail Store",
    ONLINE_STORE: "Online Store",
    MARKETPLACE: "Marketplace",
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
    CASH: "Cash",
    CARD: "Card",
    UPI: "UPI",
    BANK_TRANSFER: "Bank Transfer",
};

function formatCurrency(value: number | string | undefined | null) {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatNumber(value: number | undefined | null) {
    return new Intl.NumberFormat("en-US").format(Number(value ?? 0));
}

function formatPeriod(period: string, granularity: Granularity) {
    const d = dayjs(period);
    if (!d.isValid()) return period;
    if (granularity === "monthly") return d.format("MMM YYYY");
    return d.format("MMM D");
}

interface DrillDownState {
    open: boolean;
    title: string;
    kind: "kpi" | "category" | "product" | null;
    key: string | number | null;
}

const emptyDrillDown: DrillDownState = { open: false, title: "", kind: null, key: null };

function KpiCard({
    icon,
    label,
    value,
    color,
    onClick,
    loading,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: "primary" | "success" | "warning" | "error" | "info";
    onClick: () => void;
    loading?: boolean;
}) {
    if (loading) return <Skeleton variant="rounded" height={92} />;
    return (
        <Paper
            variant="outlined"
            onClick={onClick}
            sx={{
                p: 2.25,
                height: "100%",
                cursor: "pointer",
                transition: "box-shadow .15s, transform .15s",
                "&:hover": { boxShadow: 3, transform: "translateY(-2px)" },
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
                <Box
                    sx={{
                        bgcolor: `${color}.light`,
                        color: `${color}.main`,
                        width: 42,
                        height: 42,
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" noWrap>
                        {label}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
                        {value}
                    </Typography>
                </Box>
            </Box>
        </Paper>
    );
}

function getCategoryId(entry: unknown): number | null {
    if (typeof entry !== "object" || entry === null || !("categoryId" in entry)) return null;
    const categoryId = (entry as { categoryId?: unknown }).categoryId;
    return typeof categoryId === "number" ? categoryId : null;
}

function EmptyState({ message }: { message: string }) {
    return (
        <Box className="analytics-dashboard-empty-state">
            <Typography variant="body2" color="text.secondary">
                {message}
            </Typography>
        </Box>
    );
}

export default function AnalyticsDashboardPage() {
    const [filters, setFilters] = useState<AnalyticsFilters>({});
    const [draftFilters, setDraftFilters] = useState<AnalyticsFilters>({});
    const [granularity, setGranularity] = useState<Granularity>("daily");
    const [drillDown, setDrillDown] = useState<DrillDownState>(emptyDrillDown);
    const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

    const { data: categories } = useQuery({
        queryKey: ["categories-brief"],
        queryFn: () => categoriesApi.list(),
    });
    const { data: products } = useQuery({
        queryKey: ["products-brief"],
        queryFn: () => productsApi.list(),
    });

    const {
        data: dashboard,
        isLoading,
        isFetching,
        isError,
        dataUpdatedAt,
        refetch,
    } = useQuery({
        queryKey: ["analytics-dashboard", filters, granularity],
        queryFn: () => analyticsApi.dashboard(filters, granularity),
        // Keep the live dashboard current after sales or inventory changes.
        refetchInterval: 30_000,
        refetchIntervalInBackground: false,
    });

    const drillDownQuery = useQuery({
        queryKey: ["analytics-drilldown", drillDown, filters],
        queryFn: async () => {
            if (drillDown.kind === "kpi") return analyticsApi.drillDownKpi(drillDown.key as KPIKey, filters);
            if (drillDown.kind === "category") return analyticsApi.drillDownCategory(drillDown.key as number, filters);
            if (drillDown.kind === "product") return analyticsApi.drillDownProduct(drillDown.key as number, filters);
            return [];
        },
        enabled: drillDown.open && drillDown.kind !== null,
    });

    const openKpiDrillDown = (key: KPIKey, title: string) =>
        setDrillDown({ open: true, title, kind: "kpi", key });
    const openCategoryDrillDown = (categoryId: number | null, title: string) => {
        if (categoryId == null) return;
        setDrillDown({ open: true, title, kind: "category", key: categoryId });
    };
    const openProductDrillDown = (productId: number, title: string) =>
        setDrillDown({ open: true, title, kind: "product", key: productId });

    const applyFilters = () => setFilters(draftFilters);
    const resetFilters = () => {
        setDraftFilters({});
        setFilters({});
    };

    const handleExport = async (format: "csv" | "pdf") => {
        setExporting(format);
        try {
            const blob = await analyticsApi.export(format, filters, granularity);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `analytics-report.${format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } finally {
            setExporting(null);
        }
    };

    const revenueTrendData = useMemo(
        () =>
            (dashboard?.revenue_trend ?? []).map((p) => ({
                ...p,
                label: formatPeriod(p.period, granularity),
            })),
        [dashboard, granularity]
    );

    const salesTrendData = useMemo(
        () =>
            (dashboard?.sales_trend ?? []).map((p) => ({
                ...p,
                label: formatPeriod(p.period, granularity),
            })),
        [dashboard, granularity]
    );

    const categoryPieData = useMemo(
        () =>
            (dashboard?.top_categories ?? []).map((c, idx) => ({
                name: c.category_name,
                value: c.revenue,
                categoryId: c.category_id,
                color: CHART_COLORS[idx % CHART_COLORS.length],
            })),
        [dashboard]
    );

    const paymentPieData = useMemo(
        () =>
            (dashboard?.by_payment_method ?? []).map((p, idx) => ({
                name: PAYMENT_LABELS[p.payment_method] ?? p.payment_method,
                value: p.revenue,
                color: CHART_COLORS[idx % CHART_COLORS.length],
            })),
        [dashboard]
    );

    const channelBarData = useMemo(
        () =>
            (dashboard?.by_channel ?? []).map((c) => ({
                name: CHANNEL_LABELS[c.sales_channel] ?? c.sales_channel,
                revenue: c.revenue,
            })),
        [dashboard]
    );

    const inventoryDistData = useMemo(
        () =>
            (dashboard?.inventory_distribution ?? []).map((c, idx) => ({
                name: c.category_name,
                value: c.total_quantity,
                categoryId: c.category_id,
                color: CHART_COLORS[idx % CHART_COLORS.length],
            })),
        [dashboard]
    );

    const stockStatusData = useMemo(
        () =>
            (dashboard?.stock_status_summary ?? []).map((s) => ({
                name: s.stock_status.replace("_", " "),
                value: s.count,
                color: STOCK_STATUS_COLORS[s.stock_status] ?? "#999",
            })),
        [dashboard]
    );

    const inventoryValueData = useMemo(
        () =>
            (dashboard?.inventory_value_by_category ?? []).map((c) => ({
                name: c.category_name,
                value: c.inventory_value,
            })),
        [dashboard]
    );

    const kpis = dashboard?.kpis;

    return (
        <RoleGuard
            allowedRoles={["COMPANY_ADMIN", "ANALYST"]}
            fallback={<Alert severity="warning">Analytics Dashboard is available to Company Admins and Analysts only.</Alert>}
        >
            <Box className="analytics-dashboard-page">
                {/* Header */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", sm: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", sm: "row" },
                        gap: 2,
                        mb: 3,
                    }}
                >
                    <Box>
                        <Box className="analytics-dashboard-title-row">
                            <Typography variant="h4" className="analytics-dashboard-title">
                                Analytics Dashboard
                            </Typography>
                            {isFetching && !isLoading && (
                                <Chip size="small" label="Refreshing…" color="primary" variant="outlined" />
                            )}
                        </Box>
                        <Typography variant="body1" color="text.secondary">
                            Business KPIs, sales analytics, and inventory analytics for your company.
                            {dataUpdatedAt ? ` Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}.` : ""}
                        </Typography>
                    </Box>
                    <Box className="analytics-dashboard-actions">
                        <Tooltip title="Refresh dashboard">
                            <Button
                                variant="outlined"
                                startIcon={<RefreshIcon />}
                                onClick={() => refetch()}
                                disabled={isFetching}
                            >
                                Refresh
                            </Button>
                        </Tooltip>
                        <Button
                            variant="outlined"
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={() => handleExport("csv")}
                            disabled={exporting !== null}
                        >
                            {exporting === "csv" ? "Exporting…" : "Export CSV"}
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={() => handleExport("pdf")}
                            disabled={exporting !== null}
                        >
                            {exporting === "pdf" ? "Exporting…" : "Export PDF"}
                        </Button>
                    </Box>
                </Box>

                {/* Filters */}
                <Paper variant="outlined" className="analytics-dashboard-filters">
                    <Box className="analytics-dashboard-filter-heading">
                        <FilterAltOutlinedIcon fontSize="small" color="action" />
                        <Typography variant="subtitle1" className="analytics-dashboard-filter-title">
                            Dashboard Filters
                        </Typography>
                    </Box>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <TextField
                                label="From"
                                type="date"
                                size="small"
                                fullWidth
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={draftFilters.date_from ?? ""}
                                onChange={(e) => setDraftFilters((f) => ({ ...f, date_from: e.target.value || undefined }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <TextField
                                label="To"
                                type="date"
                                size="small"
                                fullWidth
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={draftFilters.date_to ?? ""}
                                onChange={(e) => setDraftFilters((f) => ({ ...f, date_to: e.target.value || undefined }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <Select
                                size="small"
                                fullWidth
                                displayEmpty
                                value={draftFilters.category_id ?? ""}
                                onChange={(e) =>
                                    setDraftFilters((f) => ({
                                        ...f,
                                        category_id: String(e.target.value) === "" ? undefined : Number(e.target.value),
                                    }))
                                }
                            >
                                <MenuItem value="">All Categories</MenuItem>
                                {(categories ?? []).map((c) => (
                                    <MenuItem key={c.id} value={c.id}>
                                        {c.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <Select
                                size="small"
                                fullWidth
                                displayEmpty
                                value={draftFilters.product_id ?? ""}
                                onChange={(e) =>
                                    setDraftFilters((f) => ({
                                        ...f,
                                        product_id: String(e.target.value) === "" ? undefined : Number(e.target.value),
                                    }))
                                }
                            >
                                <MenuItem value="">All Products</MenuItem>
                                {(products ?? []).map((p) => (
                                    <MenuItem key={p.id} value={p.id}>
                                        {p.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <TextField
                                label="Brand"
                                size="small"
                                fullWidth
                                value={draftFilters.brand ?? ""}
                                onChange={(e) => setDraftFilters((f) => ({ ...f, brand: e.target.value || undefined }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <Select
                                size="small"
                                fullWidth
                                displayEmpty
                                value={draftFilters.sales_channel ?? ""}
                                onChange={(e) =>
                                    setDraftFilters((f) => ({
                                        ...f,
                                        sales_channel: (e.target.value || undefined) as SalesChannel | undefined,
                                    }))
                                }
                            >
                                <MenuItem value="">All Channels</MenuItem>
                                {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                                    <MenuItem key={value} value={value}>
                                        {label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <Select
                                size="small"
                                fullWidth
                                displayEmpty
                                value={draftFilters.payment_method ?? ""}
                                onChange={(e) =>
                                    setDraftFilters((f) => ({
                                        ...f,
                                        payment_method: (e.target.value || undefined) as PaymentMethod | undefined,
                                    }))
                                }
                            >
                                <MenuItem value="">All Payment Methods</MenuItem>
                                {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                                    <MenuItem key={value} value={value}>
                                        {label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={granularity}
                                onChange={(_, val) => val && setGranularity(val)}
                                fullWidth
                            >
                                <ToggleButton value="daily">Daily</ToggleButton>
                                <ToggleButton value="weekly">Weekly</ToggleButton>
                                <ToggleButton value="monthly">Monthly</ToggleButton>
                            </ToggleButtonGroup>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <Box sx={{ display: "flex", gap: 1, height: "100%" }}>
                                <Button variant="contained" fullWidth onClick={applyFilters}>
                                    Apply
                                </Button>
                                <Tooltip title="Reset filters">
                                    <IconButton onClick={resetFilters}>
                                        <RestartAltIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>

                {isError && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        Couldn't load the analytics dashboard. Try refreshing.
                    </Alert>
                )}

                {/* KPI Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <KpiCard
                            icon={<PaidOutlinedIcon />}
                            label="Total Revenue"
                            value={formatCurrency(kpis?.total_revenue)}
                            color="primary"
                            loading={isLoading}
                            onClick={() => openKpiDrillDown("revenue", "Total Revenue — Sales")}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <KpiCard
                            icon={<ReceiptLongOutlinedIcon />}
                            label="Total Orders"
                            value={formatNumber(kpis?.total_orders)}
                            color="info"
                            loading={isLoading}
                            onClick={() => openKpiDrillDown("orders", "Total Orders")}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <KpiCard
                            icon={<ShoppingBagOutlinedIcon />}
                            label="Total Products Sold"
                            value={formatNumber(kpis?.total_products_sold)}
                            color="success"
                            loading={isLoading}
                            onClick={() => openKpiDrillDown("products_sold", "Total Products Sold")}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <KpiCard
                            icon={<TrendingUpIcon />}
                            label="Average Order Value"
                            value={formatCurrency(kpis?.average_order_value)}
                            color="primary"
                            loading={isLoading}
                            onClick={() => openKpiDrillDown("average_order_value", "Average Order Value — Sales")}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <KpiCard
                            icon={<WarehouseOutlinedIcon />}
                            label="Total Inventory Value"
                            value={formatCurrency(kpis?.total_inventory_value)}
                            color="info"
                            loading={isLoading}
                            onClick={() => openKpiDrillDown("inventory_value", "Total Inventory Value")}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <KpiCard
                            icon={<WarningAmberOutlinedIcon />}
                            label="Low Stock Products"
                            value={formatNumber(kpis?.low_stock_products)}
                            color="warning"
                            loading={isLoading}
                            onClick={() => openKpiDrillDown("low_stock_products", "Low Stock Products")}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <KpiCard
                            icon={<HighlightOffOutlinedIcon />}
                            label="Out of Stock Products"
                            value={formatNumber(kpis?.out_of_stock_products)}
                            color="error"
                            loading={isLoading}
                            onClick={() => openKpiDrillDown("out_of_stock_products", "Out of Stock Products")}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <KpiCard
                            icon={<CategoryOutlinedIcon />}
                            label="Total Categories"
                            value={formatNumber(kpis?.total_categories)}
                            color="success"
                            loading={isLoading}
                            onClick={() => openKpiDrillDown("total_categories", "Categories")}
                        />
                    </Grid>
                </Grid>

                {/* Sales Analytics */}
                <Typography variant="h6" className="analytics-dashboard-section-title">
                    Sales Analytics
                </Typography>
                <Grid container spacing={3} className="analytics-dashboard-grid">
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Revenue Trend
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={260} />
                            ) : revenueTrendData.length === 0 ? (
                                <EmptyState message="No revenue data for the selected filters." />
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={revenueTrendData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F5" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <ChartTooltip formatter={(value) => formatCurrency(Array.isArray(value) ? value[0] : value)} />
                                        <Line type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2.5} dot={false} name="Revenue" />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Sales Trend
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={260} />
                            ) : salesTrendData.length === 0 ? (
                                <EmptyState message="No sales data for the selected filters." />
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={salesTrendData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F5" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <ChartTooltip />
                                        <Bar dataKey="quantity_sold" fill="#22C55E" radius={[6, 6, 0, 0]} name="Units Sold" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                <Grid container spacing={3} className="analytics-dashboard-grid">
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Top 10 Best Selling Products
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={280} />
                            ) : (dashboard?.top_products?.length ?? 0) === 0 ? (
                                <EmptyState message="No product sales for the selected filters." />
                            ) : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Product</TableCell>
                                                <TableCell>Category</TableCell>
                                                <TableCell align="right">Units Sold</TableCell>
                                                <TableCell align="right">Revenue</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dashboard!.top_products.map((p) => (
                                                <TableRow
                                                    key={p.product_id}
                                                    hover
                                                    className="analytics-dashboard-clickable-row"
                                                    onClick={() => openProductDrillDown(p.product_id, `Transactions — ${p.product_name}`)}
                                                >
                                                    <TableCell>{p.product_name}</TableCell>
                                                    <TableCell>{p.category_name ?? "-"}</TableCell>
                                                    <TableCell align="right">{formatNumber(p.quantity_sold)}</TableCell>
                                                    <TableCell align="right">{formatCurrency(p.revenue)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Top Performing Categories
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={260} />
                            ) : categoryPieData.length === 0 ? (
                                <EmptyState message="No category sales for the selected filters." />
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie
                                            data={categoryPieData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={55}
                                            outerRadius={90}
                                            paddingAngle={2}
                                            onClick={(entry) => openCategoryDrillDown(getCategoryId(entry), `Products — ${entry.name}`)}
                                            className="analytics-dashboard-clickable-chart"
                                        >
                                            {categoryPieData.map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <ChartTooltip formatter={(value) => formatCurrency(Array.isArray(value) ? value[0] : value)} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                <Grid container spacing={3} className="analytics-dashboard-grid">
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Sales by Payment Method
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={240} />
                            ) : paymentPieData.length === 0 ? (
                                <EmptyState message="No sales data for the selected filters." />
                            ) : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie data={paymentPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                                            {paymentPieData.map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <ChartTooltip formatter={(value) => formatCurrency(Array.isArray(value) ? value[0] : value)} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Sales by Sales Channel
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={240} />
                            ) : channelBarData.length === 0 ? (
                                <EmptyState message="No sales data for the selected filters." />
                            ) : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={channelBarData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F5" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <ChartTooltip formatter={(value) => formatCurrency(Array.isArray(value) ? value[0] : value)} />
                                        <Bar dataKey="revenue" fill="#0EA5E9" radius={[6, 6, 0, 0]} name="Revenue" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                {/* Inventory Analytics */}
                <Typography variant="h6" className="analytics-dashboard-section-title">
                    Inventory Analytics
                </Typography>
                <Grid container spacing={3} className="analytics-dashboard-grid">
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Inventory Distribution by Category
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={240} />
                            ) : inventoryDistData.length === 0 ? (
                                <EmptyState message="No inventory data for the selected filters." />
                            ) : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie
                                            data={inventoryDistData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={50}
                                            outerRadius={85}
                                            paddingAngle={2}
                                            onClick={(entry) => openCategoryDrillDown(getCategoryId(entry), `Products — ${entry.name}`)}
                                            className="analytics-dashboard-clickable-chart"
                                        >
                                            {inventoryDistData.map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <ChartTooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Stock Status Summary
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={240} />
                            ) : stockStatusData.length === 0 ? (
                                <EmptyState message="No inventory data for the selected filters." />
                            ) : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie data={stockStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                                            {stockStatusData.map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <ChartTooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                <Grid container spacing={3} className="analytics-dashboard-grid">
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Top Low Stock Products
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={240} />
                            ) : (dashboard?.low_stock_products?.length ?? 0) === 0 ? (
                                <EmptyState message="No products are currently low on stock." />
                            ) : (
                                <TableContainer className="analytics-dashboard-scroll-table">
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Product</TableCell>
                                                <TableCell align="right">Available</TableCell>
                                                <TableCell align="right">Reorder Level</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dashboard!.low_stock_products.map((p) => (
                                                <TableRow
                                                    key={p.product_id}
                                                    hover
                                                    className="analytics-dashboard-clickable-row"
                                                    onClick={() => openProductDrillDown(p.product_id, `Transactions — ${p.product_name}`)}
                                                >
                                                    <TableCell>{p.product_name}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" label={p.available_stock} color="warning" variant="outlined" />
                                                    </TableCell>
                                                    <TableCell align="right">{p.reorder_level}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Out of Stock Products
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={240} />
                            ) : (dashboard?.out_of_stock_products?.length ?? 0) === 0 ? (
                                <EmptyState message="No products are currently out of stock." />
                            ) : (
                                <TableContainer className="analytics-dashboard-scroll-table">
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Product</TableCell>
                                                <TableCell>SKU</TableCell>
                                                <TableCell>Category</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dashboard!.out_of_stock_products.map((p) => (
                                                <TableRow
                                                    key={p.product_id}
                                                    hover
                                                    className="analytics-dashboard-clickable-row"
                                                    onClick={() => openProductDrillDown(p.product_id, `Transactions — ${p.product_name}`)}
                                                >
                                                    <TableCell>{p.product_name}</TableCell>
                                                    <TableCell>{p.sku}</TableCell>
                                                    <TableCell>{p.category_name ?? "-"}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                <Grid container spacing={3} className="analytics-dashboard-grid">
                    <Grid size={{ xs: 12 }}>
                        <Paper variant="outlined" className="analytics-dashboard-card">
                            <Typography variant="subtitle1" className="analytics-dashboard-card-title">
                                Inventory Value by Category
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="rounded" height={260} />
                            ) : inventoryValueData.length === 0 ? (
                                <EmptyState message="No inventory data for the selected filters." />
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={inventoryValueData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F5" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <ChartTooltip formatter={(value) => formatCurrency(Array.isArray(value) ? value[0] : value)} />
                                        <Bar dataKey="value" fill="#8B5CF6" radius={[6, 6, 0, 0]} name="Inventory Value" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                {/* Drill-down dialog */}
                <Dialog
                    open={drillDown.open}
                    onClose={() => setDrillDown(emptyDrillDown)}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        {drillDown.title}
                        <IconButton onClick={() => setDrillDown(emptyDrillDown)} size="small">
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </DialogTitle>
                    <Divider />
                    <DialogContent>
                        <DrillDownContent
                            loading={drillDownQuery.isLoading}
                            rows={drillDownQuery.data ?? []}
                        />
                    </DialogContent>
                </Dialog>
            </Box>
        </RoleGuard>
    );
}

function DrillDownContent({ loading, rows }: { loading: boolean; rows: Record<string, unknown>[] }) {
    if (loading) {
        return (
            <Box className="analytics-dashboard-dialog-loading">
                <Skeleton height={36} />
                <Skeleton height={36} />
                <Skeleton height={36} />
            </Box>
        );
    }

    if (rows.length === 0) {
        return <EmptyState message="No records match the selected filters." />;
    }

    const sample = rows[0];
    const isSaleRow = "invoice_number" in sample;
    const isTransactionRow = "sale_id" in sample;
    const isProductAggregateRow = "quantity_sold" in sample && "revenue" in sample;

    if (isSaleRow || isTransactionRow) {
        return (
            <TableContainer className="analytics-dashboard-drilldown-table">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Invoice</TableCell>
                            <TableCell>Customer</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Channel</TableCell>
                            <TableCell>Payment</TableCell>
                            <TableCell align="right">Total</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((r, idx) => (
                            <TableRow key={idx} hover>
                                <TableCell>{String(r.invoice_number)}</TableCell>
                                <TableCell>{String(r.customer_name)}</TableCell>
                                <TableCell>{dayjs(String(r.sale_date)).format("MMM D, YYYY")}</TableCell>
                                <TableCell>{CHANNEL_LABELS[r.sales_channel as SalesChannel] ?? String(r.sales_channel)}</TableCell>
                                <TableCell>{PAYMENT_LABELS[r.payment_method as PaymentMethod] ?? String(r.payment_method)}</TableCell>
                                <TableCell align="right">
                                    {formatCurrency(Number(r.total_amount ?? r.total ?? 0))}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }

    if (isProductAggregateRow) {
        return (
            <TableContainer className="analytics-dashboard-drilldown-table">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Product</TableCell>
                            <TableCell>SKU</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell align="right">Qty Sold</TableCell>
                            <TableCell align="right">Revenue</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((r, idx) => (
                            <TableRow key={idx} hover>
                                <TableCell>{String(r.product_name)}</TableCell>
                                <TableCell>{String(r.sku)}</TableCell>
                                <TableCell>{String(r.category_name ?? "-")}</TableCell>
                                <TableCell align="right">{formatNumber(Number(r.quantity_sold))}</TableCell>
                                <TableCell align="right">{formatCurrency(Number(r.revenue))}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }

    // Inventory-shaped rows (KPI drill-downs for inventory_value / low_stock / out_of_stock / total_categories)
    return (
        <TableContainer className="analytics-dashboard-drilldown-table">
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Available Stock</TableCell>
                        <TableCell align="right">Reorder Level</TableCell>
                        <TableCell>Status</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((r, idx) => (
                        <TableRow key={idx} hover>
                            <TableCell>{String(r.product_name)}</TableCell>
                            <TableCell>{String(r.sku)}</TableCell>
                            <TableCell>{String(r.category_name ?? "-")}</TableCell>
                            <TableCell align="right">{String(r.available_stock ?? "-")}</TableCell>
                            <TableCell align="right">{String(r.reorder_level ?? "-")}</TableCell>
                            <TableCell>
                                {r.stock_status ? (
                                    <Chip
                                        size="small"
                                        label={String(r.stock_status).replace("_", " ")}
                                        sx={{
                                            bgcolor: STOCK_STATUS_COLORS[String(r.stock_status)] ?? "#999",
                                            color: "#fff",
                                            fontWeight: 600,
                                        }}
                                    />
                                ) : (
                                    "-"
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
