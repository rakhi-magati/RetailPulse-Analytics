import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
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
  Typography,
} from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import InsertChartOutlinedIcon from "@mui/icons-material/InsertChartOutlined";
import PieChartOutlineIcon from "@mui/icons-material/PieChartOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
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
import { customersApi } from "../../api/customers";
import RoleGuard from "../../components/RoleGuard";

import type { PaymentMethod } from "../../types/sales";
import type { AnalyticsFilters, DateRangePreset, Granularity } from "../../types/analytics";
import "./SalesAnalyticsPage.css";

const CHART_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  OTHER: "Other",
};

function formatCurrency(value: number | string | undefined | null) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(value: number | undefined | null) {
  return new Intl.NumberFormat("en-IN").format(Number(value ?? 0));
}

export default function SalesAnalyticsPage() {
  const [preset, setPreset] = useState<DateRangePreset>("this_month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedProduct, setSelectedProduct] = useState<string>("ALL");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("ALL");
  const [selectedPayment, setSelectedPayment] = useState<string>("ALL");

  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [productSortBy, setProductSortBy] = useState<"revenue" | "quantity">("revenue");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Compute active date filters from preset or custom dates
  const activeDates = useMemo(() => {
    const today = dayjs();
    switch (preset) {
      case "today":
        return {
          date_from: today.format("YYYY-MM-DD"),
          date_to: today.format("YYYY-MM-DD"),
        };
      case "last_7_days":
        return {
          date_from: today.subtract(6, "day").format("YYYY-MM-DD"),
          date_to: today.format("YYYY-MM-DD"),
        };
      case "last_30_days":
        return {
          date_from: today.subtract(29, "day").format("YYYY-MM-DD"),
          date_to: today.format("YYYY-MM-DD"),
        };
      case "this_month":
        return {
          date_from: today.startOf("month").format("YYYY-MM-DD"),
          date_to: today.format("YYYY-MM-DD"),
        };
      case "last_month":
        return {
          date_from: today.subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
          date_to: today.subtract(1, "month").endOf("month").format("YYYY-MM-DD"),
        };
      case "custom":
        return {
          date_from: customFrom || undefined,
          date_to: customTo || undefined,
        };
      default:
        return {};
    }
  }, [preset, customFrom, customTo]);

  // Combine into active AnalyticsFilters object
  const filters: AnalyticsFilters = useMemo(() => {
    const f: AnalyticsFilters = { ...activeDates };
    if (selectedCategory !== "ALL") f.category_id = Number(selectedCategory);
    if (selectedProduct !== "ALL") f.product_id = Number(selectedProduct);
    if (selectedCustomer !== "ALL") f.customer_id = Number(selectedCustomer);
    if (selectedPayment !== "ALL") f.payment_method = selectedPayment as PaymentMethod;
    return f;
  }, [activeDates, selectedCategory, selectedProduct, selectedCustomer, selectedPayment]);

  // Invalid custom ranges must never trigger partial analytics requests.
  const dateError = useMemo(() => {
    if (preset === "custom" && customFrom && customTo && dayjs(customFrom).isAfter(dayjs(customTo))) {
      return "Start date cannot be after end date.";
    }
    return null;
  }, [preset, customFrom, customTo]);

  // Fetch reference dropdown options (Cached across renders)
  const { data: categories = [] } = useQuery({
    queryKey: ["categories-dropdown"],
    queryFn: () => categoriesApi.list(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-dropdown"],
    queryFn: () => productsApi.list(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-dropdown"],
    queryFn: () => customersApi.list(),
    staleTime: 10 * 60 * 1000,
  });

  // Query 1: Sales Summary (KPI Cards)
  const {
    data: kpis,
    isLoading: kpiLoading,
    isError: kpiError,
  } = useQuery({
    queryKey: ["sales-analytics-summary", filters],
    queryFn: () => analyticsApi.salesSummary(filters),
    staleTime: 5 * 60 * 1000,
    enabled: !dateError,
  });

  // Query 2: Sales Trend (Overview Chart & Sales vs Orders)
  const {
    data: trendData,
    isLoading: trendLoading,
    isError: trendError,
  } = useQuery({
    queryKey: ["sales-analytics-trend", filters, granularity],
    queryFn: () => analyticsApi.salesTrend(filters, granularity),
    staleTime: 5 * 60 * 1000,
    enabled: !dateError,
  });

  // Query 3: Top Products
  const {
    data: productsData,
    isLoading: productsLoading,
    isError: productsError,
  } = useQuery({
    queryKey: ["sales-analytics-products", filters, productSortBy],
    queryFn: () => analyticsApi.salesProducts(filters, productSortBy, 10),
    staleTime: 5 * 60 * 1000,
    enabled: !dateError,
  });

  // Query 4: Top Customers
  const {
    data: customersData,
    isLoading: customersLoading,
    isError: customersError,
  } = useQuery({
    queryKey: ["sales-analytics-customers", filters],
    queryFn: () => analyticsApi.salesCustomers(filters, 10),
    staleTime: 5 * 60 * 1000,
    enabled: !dateError,
  });

  // Query 5: Payment Methods
  const {
    data: paymentData,
    isLoading: paymentLoading,
    isError: paymentError,
  } = useQuery({
    queryKey: ["sales-analytics-payment", filters],
    queryFn: () => analyticsApi.salesPaymentMethods(filters),
    staleTime: 5 * 60 * 1000,
    enabled: !dateError,
  });

  // Recharts needs a finite number for the slice value. API decimal fields can
  // arrive as strings, so normalize them once before passing data to the chart.
  const paymentChartData = useMemo(
    () =>
      (paymentData?.payment_methods ?? []).map((method) => ({
        ...method,
        revenue: Number(method.revenue) || 0,
        label: PAYMENT_METHOD_LABELS[method.payment_method] || method.payment_method,
      })),
    [paymentData]
  );

  const resetFilters = () => {
    setPreset("this_month");
    setCustomFrom("");
    setCustomTo("");
    setSelectedCategory("ALL");
    setSelectedProduct("ALL");
    setSelectedCustomer("ALL");
    setSelectedPayment("ALL");
  };

  const handleExport = async (format: "csv" | "pdf") => {
    if (dateError) return;
    try {
      setExportError(null);
      setExporting(format);
      const blob = await analyticsApi.salesExport(format, filters, granularity);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `sales-analytics-report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      setExportError("The report could not be exported. Please try again.");
    } finally {
      setExporting(null);
    }
  };


  return (
    <RoleGuard allowedRoles={["COMPANY_ADMIN", "ANALYST"]}>
      <Box className="sales-analytics-container">
        {/* Page Header */}
        <Box className="sales-analytics-header">
          <Box>
            <Typography variant="h4" className="sales-analytics-title">
              Sales Analytics & Business Intelligence
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Real-time sales performance, trends, product metrics, and customer insights.
            </Typography>
          </Box>

          {/* Export Actions */}
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={exporting === "csv" ? <CircularProgress size={18} /> : <FileDownloadOutlinedIcon />}
              onClick={() => handleExport("csv")}
              disabled={!!exporting}
              sx={{ borderRadius: 2 }}
            >
              Export CSV
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={exporting === "pdf" ? <CircularProgress size={18} color="inherit" /> : <FileDownloadOutlinedIcon />}
              onClick={() => handleExport("pdf")}
              disabled={!!exporting}
              sx={{ borderRadius: 2 }}
            >
              Export PDF
            </Button>
          </Box>
        </Box>

        {/* Validation Errors */}
        {exportError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setExportError(null)}>
            {exportError}
          </Alert>
        )}

        {dateError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {dateError}
          </Alert>
        )}

        {/* Global Dashboard Filters */}
        <Paper className="sales-filter-paper">
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: "text.secondary" }}>
            Date Range & Quick Presets
          </Typography>

          <Box className="preset-chip-group">
            {[
              { id: "today", label: "Today" },
              { id: "last_7_days", label: "Last 7 Days" },
              { id: "last_30_days", label: "Last 30 Days" },
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "custom", label: "Custom Range" },
            ].map((p) => (
              <Chip
                key={p.id}
                label={p.label}
                clickable
                className={`preset-chip ${preset === p.id ? "active" : ""}`}
                onClick={() => setPreset(p.id as DateRangePreset)}
                variant={preset === p.id ? "filled" : "outlined"}
              />
            ))}
          </Box>

          {preset === "custom" && (
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Start Date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="End Date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: "text.secondary" }}>
            Optional Entity Filters
          </Typography>

          <Grid container spacing={2} alignItems="center">
            {/* Category Filter */}
            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <Select
                fullWidth
                size="small"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                displayEmpty
              >
                <MenuItem value="ALL">All Categories</MenuItem>
                {categories.map((c: { id: number; name: string }) => (
                  <MenuItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </Grid>

            {/* Product Filter */}
            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <Select
                fullWidth
                size="small"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                displayEmpty
              >
                <MenuItem value="ALL">All Products</MenuItem>
                {products.map((p: { id: number; name: string }) => (
                  <MenuItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </Grid>

            {/* Customer Filter */}
            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <Select
                fullWidth
                size="small"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                displayEmpty
              >
                <MenuItem value="ALL">All Customers</MenuItem>
                {customers.map((c: { id: number; full_name: string }) => (
                  <MenuItem key={c.id} value={c.id.toString()}>
                    {c.full_name}
                  </MenuItem>
                ))}
              </Select>
            </Grid>

            {/* Payment Method Filter */}
            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <Select
                fullWidth
                size="small"
                value={selectedPayment}
                onChange={(e) => setSelectedPayment(e.target.value)}
                displayEmpty
              >
                <MenuItem value="ALL">All Payment Methods</MenuItem>
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="CARD">Card</MenuItem>
                <MenuItem value="UPI">UPI</MenuItem>
                <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
              </Select>
            </Grid>

            {/* Reset Filters */}
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                startIcon={<RestartAltIcon />}
                onClick={resetFilters}
                size="small"
              >
                Reset Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {kpiError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            Failed to load sales summary. Other analytics sections may still be available.
          </Alert>
        )}

        {/* 1. KPI Cards Section (6 Cards) */}
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {/* Card 1: Total Revenue */}
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <Paper className="kpi-card">
              <Box className="kpi-icon-wrapper" sx={{ bgcolor: "rgba(79, 70, 229, 0.1)", color: "#4F46E5" }}>
                <PaidOutlinedIcon />
              </Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Total Revenue
              </Typography>
              {kpiLoading ? (
                <Skeleton width="80%" height={32} />
              ) : (
                <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                  {formatCurrency(kpis?.total_revenue)}
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Card 2: Total Orders */}
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <Paper className="kpi-card">
              <Box className="kpi-icon-wrapper" sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#10B981" }}>
                <ReceiptLongOutlinedIcon />
              </Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Total Orders
              </Typography>
              {kpiLoading ? (
                <Skeleton width="80%" height={32} />
              ) : (
                <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                  {formatNumber(kpis?.total_orders)}
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Card 3: Average Order Value */}
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <Paper className="kpi-card">
              <Box className="kpi-icon-wrapper" sx={{ bgcolor: "rgba(245, 158, 11, 0.1)", color: "#F59E0B" }}>
                <TrendingUpIcon />
              </Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Avg Order Value
              </Typography>
              {kpiLoading ? (
                <Skeleton width="80%" height={32} />
              ) : (
                <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                  {formatCurrency(kpis?.average_order_value)}
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Card 4: Total Items Sold */}
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <Paper className="kpi-card">
              <Box className="kpi-icon-wrapper" sx={{ bgcolor: "rgba(59, 130, 246, 0.1)", color: "#3B82F6" }}>
                <ShoppingBagOutlinedIcon />
              </Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Total Items Sold
              </Typography>
              {kpiLoading ? (
                <Skeleton width="80%" height={32} />
              ) : (
                <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                  {formatNumber(kpis?.total_products_sold)}
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Card 5: Total Discount */}
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <Paper className="kpi-card">
              <Box className="kpi-icon-wrapper" sx={{ bgcolor: "rgba(236, 72, 153, 0.1)", color: "#EC4899" }}>
                <LocalOfferOutlinedIcon />
              </Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Total Discount
              </Typography>
              {kpiLoading ? (
                <Skeleton width="80%" height={32} />
              ) : (
                <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                  {formatCurrency(kpis?.total_discount)}
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Card 6: Total Tax */}
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <Paper className="kpi-card">
              <Box className="kpi-icon-wrapper" sx={{ bgcolor: "rgba(139, 92, 246, 0.1)", color: "#8B5CF6" }}>
                <AccountBalanceWalletOutlinedIcon />
              </Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Total Tax
              </Typography>
              {kpiLoading ? (
                <Skeleton width="80%" height={32} />
              ) : (
                <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                  {formatCurrency(kpis?.total_tax)}
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* 2. Sales Overview (Revenue over Time Chart) */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Paper className="chart-paper">
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Sales Overview
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Revenue performance over time
                  </Typography>
                </Box>

                <ToggleButtonGroup
                  value={granularity}
                  exclusive
                  onChange={(_, val) => val && setGranularity(val)}
                  size="small"
                >
                  <ToggleButton value="daily">Daily</ToggleButton>
                  <ToggleButton value="weekly">Weekly</ToggleButton>
                  <ToggleButton value="monthly">Monthly</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {trendLoading ? (
                <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
              ) : trendError ? (
                <Alert severity="error">Failed to load sales trend data.</Alert>
              ) : !trendData?.trend || trendData.trend.length === 0 ? (
                <Box className="empty-state-box">
                  <WarningAmberOutlinedIcon className="empty-state-icon" />
                  <Typography variant="body1">No sales data available for the selected period.</Typography>
                </Box>
              ) : (
                <Box sx={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData.trend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => `INR ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 12 }} />
                      <ChartTooltip formatter={(val: any) => [formatCurrency(val), "Revenue"]} />
                      <Line type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 7 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* 3. Sales vs Orders (Dual Axis Comparison Chart) */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper className="chart-paper">
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  Sales vs Orders
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Compare total revenue against order count
                </Typography>
              </Box>

              {trendLoading ? (
                <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
              ) : trendError ? (
                <Alert severity="error">Failed to load comparison data.</Alert>
              ) : !trendData?.trend || trendData.trend.length === 0 ? (
                <Box className="empty-state-box">
                  <InsertChartOutlinedIcon className="empty-state-icon" />
                  <Typography variant="body1">No sales data available for comparison.</Typography>
                </Box>
              ) : (
                <Box sx={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tickFormatter={(v) => `INR ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <ChartTooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} name="Revenue (INR)" />
                      <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2.5} name="Orders" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* 4. Top Performing Products & 5. Customer Revenue Analysis */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Top Performing Products */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Paper className="chart-paper">
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Top Performing Products
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Best selling products by revenue & units sold
                  </Typography>
                </Box>

                <ToggleButtonGroup
                  value={productSortBy}
                  exclusive
                  onChange={(_, val) => val && setProductSortBy(val)}
                  size="small"
                >
                  <ToggleButton value="revenue">By Revenue</ToggleButton>
                  <ToggleButton value="quantity">By Units</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {productsLoading ? (
                <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 2 }} />
              ) : productsError ? (
                <Alert severity="error">Failed to load top products.</Alert>
              ) : !productsData?.products || productsData.products.length === 0 ? (
                <Box className="empty-state-box">
                  <Typography variant="body1">No product sales data available for this period.</Typography>
                </Box>
              ) : (
                <TableContainer sx={{ maxHeight: 320 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product Name</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell align="right">Units Sold</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {productsData.products.map((p) => (
                        <TableRow key={p.product_id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{p.product_name}</TableCell>
                          <TableCell color="text.secondary">{p.sku}</TableCell>
                          <TableCell align="right">{formatNumber(p.quantity_sold)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main" }}>
                            {formatCurrency(p.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>

          {/* Customer Revenue Analysis */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper className="chart-paper">
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  Customer Revenue Analysis
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Top customers contributing the most revenue
                </Typography>
              </Box>

              {customersLoading ? (
                <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 2 }} />
              ) : customersError ? (
                <Alert severity="error">Failed to load customer analytics.</Alert>
              ) : !customersData?.customers || customersData.customers.length === 0 ? (
                <Box className="empty-state-box">
                  <PeopleOutlinedIcon className="empty-state-icon" />
                  <Typography variant="body1">No customer contributions found for this period.</Typography>
                </Box>
              ) : (
                <TableContainer sx={{ maxHeight: 320 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Customer Name</TableCell>
                        <TableCell align="right">Orders</TableCell>
                        <TableCell align="right">Total Spend</TableCell>
                        <TableCell align="right">AOV</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {customersData.customers.map((c, i) => (
                        <TableRow key={i} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{c.customer_name}</TableCell>
                          <TableCell align="right">{formatNumber(c.orders)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "#10B981" }}>
                            {formatCurrency(c.total_spend)}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(c.average_order_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* 6. Payment Method Analysis */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Paper className="chart-paper">
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  Payment Method Analysis
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Sales and transaction distribution by payment method
                </Typography>
              </Box>

              {paymentLoading ? (
                <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 2 }} />
              ) : paymentError ? (
                <Alert severity="error">Failed to load payment method data.</Alert>
              ) : !paymentData?.payment_methods || paymentData.payment_methods.length === 0 ? (
                <Box className="empty-state-box">
                  <PieChartOutlineIcon className="empty-state-icon" />
                  <Typography variant="body1">No payment transactions found for this period.</Typography>
                </Box>
              ) : (
                <Grid container spacing={3} alignItems="center">
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Box sx={{ width: "100%", height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentChartData}
                            dataKey="revenue"
                            nameKey="label"
                            isAnimationActive={false}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={4}
                          >
                            {paymentChartData.map((entry, index) => (
                              <Cell key={entry.payment_method} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <ChartTooltip formatter={(value: any) => [formatCurrency(value), "Revenue"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 12, md: 7 }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Payment Method</TableCell>
                            <TableCell align="right">Transactions</TableCell>
                            <TableCell align="right">Revenue Generated</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paymentData.payment_methods.map((pm, idx) => (
                            <TableRow key={pm.payment_method} hover>
                              <TableCell sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: "50%",
                                    bgcolor: CHART_COLORS[idx % CHART_COLORS.length],
                                  }}
                                />
                                <Typography variant="body2" fontWeight={600}>
                                  {PAYMENT_METHOD_LABELS[pm.payment_method] || pm.payment_method}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{formatNumber(pm.orders)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {formatCurrency(pm.revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                </Grid>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </RoleGuard>
  );
}
