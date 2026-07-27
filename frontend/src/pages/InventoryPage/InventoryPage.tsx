import './InventoryPage.css';
import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
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
    Tooltip,
    Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import TuneIcon from "@mui/icons-material/Tune";
import HistoryIcon from "@mui/icons-material/History";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import HighlightOffOutlinedIcon from "@mui/icons-material/HighlightOffOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as ChartTooltip,
    XAxis,
    YAxis,
} from "recharts";
// import { categoriesApi } from "../../api/catalog";
// import { inventoryApi } from "../../api/inventory";
// import RoleGuard from "../../components/RoleGuard";
// import { useAuth } from "../../context/AuthContext";
// import type {
//     AdjustmentType,
//     InventoryItem,
//     StockStatus,
// } from "../../types/inventory";

// import type { AdjustmentType, InventoryItem, StockStatus } from "../../types/inventory";
import { categoriesApi } from "../../api/catalog";
import { inventoryApi } from "../../api/inventory";
import { useAuth } from "../../context/AuthContext";
import RoleGuard from "../../components/RoleGuard";
import type { AdjustmentType, StockStatus ,InventoryItem} from "../../types/inventory";

const STATUS_COLORS: Record<StockStatus, string> = {
    IN_STOCK: "#22C55E",
    LOW_STOCK: "#F59E0B",
    OUT_OF_STOCK: "#EF4444",
};

const STATUS_LABELS: Record<StockStatus, string> = {
    IN_STOCK: "In Stock",
    LOW_STOCK: "Low Stock",
    OUT_OF_STOCK: "Out of Stock",
};

const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
    STOCK_IN: "Stock In",
    STOCK_OUT: "Stock Out",
    MANUAL_ADJUSTMENT: "Manual Adjustment",
};

const MOVEMENT_LABELS: Record<string, string> = {
    SALE: "Sale",
    MANUAL_ADJUSTMENT: "Manual Adjustment",
    STOCK_ADDITION: "Stock Addition",
    STOCK_REMOVAL: "Stock Removal",
};

interface AdjustFormValues {
    adjustment_type: AdjustmentType;
    quantity: string;
    reason: string;
    remarks: string;
}

const emptyAdjustValues: AdjustFormValues = {
    adjustment_type: "STOCK_IN",
    quantity: "",
    reason: "",
    remarks: "",
};

function StatCard({
    icon,
    label,
    value,
    iconColor,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    iconColor: "primary" | "success" | "warning" | "error";
}) {
    return (
        <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                    sx={{
                        bgcolor: `${iconColor}.light`,
                        color: `${iconColor}.main`,
                        width: 46,
                        height: 46,
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </Box>
                <Box>
                    <Typography variant="body2" color="text.secondary">
                        {label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {value}
                    </Typography>
                </Box>
            </Box>
        </Paper>
    );
}

function StockStatusChip({ status }: { status: StockStatus }) {
    return (
        <Chip
            size="small"
            label={STATUS_LABELS[status]}
            sx={{
                bgcolor: `${STATUS_COLORS[status]}1A`,
                color: STATUS_COLORS[status],
                fontWeight: 600,
            }}
        />
    );
}

function InventoryPageContent() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const isAdmin = user?.role === "COMPANY_ADMIN" || user?.role === "SUPER_ADMIN";

    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<number | "">("");
    const [statusFilter, setStatusFilter] = useState<StockStatus | "">("");
    const [brandFilter, setBrandFilter] = useState("");
    const [sortBy, setSortBy] = useState<"updated" | "name" | "stock">("updated");

    const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
    const [reorderTarget, setReorderTarget] = useState<InventoryItem | null>(null);
    const [reorderLevelValue, setReorderLevelValue] = useState("");
    const [historyTarget, setHistoryTarget] = useState<InventoryItem | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const { data: categories } = useQuery({
        queryKey: ["categories"],
        queryFn: () => categoriesApi.list(),
        refetchInterval: 15000,
    });

    const { data, isLoading, isError, isFetching, dataUpdatedAt } = useQuery({
        queryKey: ["inventory", search, categoryFilter, statusFilter, brandFilter, sortBy],
        queryFn: () =>
            inventoryApi.list({
                search: search || undefined,
                category_id: categoryFilter || undefined,
                stock_status: statusFilter || undefined,
                brand: brandFilter || undefined,
                sort_by: sortBy,
            }),
        refetchInterval: 15000,
        refetchOnWindowFocus: true,
    });

    const { data: summary, isLoading: isSummaryLoading } = useQuery({
        queryKey: ["inventory-summary"],
        queryFn: inventoryApi.dashboardSummary,
        refetchInterval: 15000,
    });

    const { data: chartData } = useQuery({
        queryKey: ["inventory-charts"],
        queryFn: inventoryApi.charts,
        refetchInterval: 15000,
    });

    const { data: movements, isLoading: isMovementsLoading } = useQuery({
        queryKey: ["inventory-movements", historyTarget?.product_id],
        queryFn: () => inventoryApi.productMovements(historyTarget!.product_id),
        enabled: !!historyTarget,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
        queryClient.invalidateQueries({ queryKey: ["inventory-charts"] });
        queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
        queryClient.invalidateQueries({ queryKey: ["products"] });
    };

    const {
        control,
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<AdjustFormValues>({ defaultValues: emptyAdjustValues });

    const adjustmentType = watch("adjustment_type");

    const adjustMutation = useMutation({
        mutationFn: ({ productId, payload }: { productId: number; payload: any }) =>
            inventoryApi.adjustStock(productId, payload),
        onSuccess: () => {
            invalidate();
            closeAdjustDialog();
        },
        onError: (err: any) =>
            setErrorMessage(err?.response?.data?.detail ?? "Failed to adjust stock"),
    });

    const reorderMutation = useMutation({
        mutationFn: ({ productId, reorder_level }: { productId: number; reorder_level: number }) =>
            inventoryApi.updateReorderLevel(productId, { reorder_level }),
        onSuccess: () => {
            invalidate();
            setReorderTarget(null);
        },
        onError: (err: any) =>
            setErrorMessage(err?.response?.data?.detail ?? "Failed to update reorder level"),
    });

    const openAdjustDialog = (item: InventoryItem, type: AdjustmentType = "STOCK_IN") => {
        reset({ ...emptyAdjustValues, adjustment_type: type });
        setErrorMessage(null);
        setAdjustTarget(item);
    };

    const closeAdjustDialog = () => {
        setAdjustTarget(null);
    };

    const onSubmitAdjust = (values: AdjustFormValues) => {
        if (!adjustTarget) return;
        setErrorMessage(null);
        adjustMutation.mutate({
            productId: adjustTarget.product_id,
            payload: {
                adjustment_type: values.adjustment_type,
                quantity: Number(values.quantity),
                reason: values.reason.trim(),
                remarks: values.remarks.trim() || null,
            },
        });
    };

    const openReorderDialog = (item: InventoryItem) => {
        setErrorMessage(null);
        setReorderLevelValue(String(item.reorder_level));
        setReorderTarget(item);
    };

    const submitReorder = () => {
        if (!reorderTarget) return;
        const value = Number(reorderLevelValue);
        if (Number.isNaN(value) || value < 0) {
            setErrorMessage("Reorder level cannot be negative");
            return;
        }
        reorderMutation.mutate({ productId: reorderTarget.product_id, reorder_level: value });
    };

    const rows = useMemo(() => data ?? [], [data]);
    const categoryChart = useMemo(
        () => (chartData?.by_category ?? []).map((c) => ({ name: c.category_name, quantity: c.total_quantity })),
        [chartData]
    );
    const statusChart = useMemo(
        () =>
            (chartData?.by_stock_status ?? []).map((s) => ({
                name: STATUS_LABELS[s.stock_status],
                value: s.count,
                color: STATUS_COLORS[s.stock_status],
            })),
        [chartData]
    );

    return (
        <Box>
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                            Inventory
                        </Typography>
                        <Tooltip title={isFetching ? "Syncing latest data…" : "Live — auto-refreshes every 15s"}>
                            <Chip
                                size="small"
                                icon={
                                    <FiberManualRecordIcon
                                        sx={{
                                            fontSize: "10px !important",
                                            color: isFetching ? "warning.main" : "success.main",
                                        }}
                                    />
                                }
                                label={isFetching ? "Syncing…" : "Live"}
                                variant="outlined"
                                sx={{ fontWeight: 600 }}
                            />
                        </Tooltip>
                    </Box>
                    <Typography variant="body1" color="text.secondary">
                        Track stock levels, movements, and reorder alerts across your catalog.
                        {dataUpdatedAt ? ` Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}.` : ""}
                    </Typography>
                </Box>
            </Box>

            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isSummaryLoading ? (
                        <Skeleton variant="rounded" height={86} />
                    ) : (
                        <StatCard
                            icon={<Inventory2OutlinedIcon />}
                            label="Total Products"
                            value={summary?.total_products ?? 0}
                            iconColor="primary"
                        />
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isSummaryLoading ? (
                        <Skeleton variant="rounded" height={86} />
                    ) : (
                        <StatCard
                            icon={<Inventory2Icon />}
                            label="Total Inventory Quantity"
                            value={summary?.total_inventory_quantity ?? 0}
                            iconColor="primary"
                        />
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isSummaryLoading ? (
                        <Skeleton variant="rounded" height={86} />
                    ) : (
                        <StatCard
                            icon={<WarningAmberOutlinedIcon />}
                            label="Low Stock Products"
                            value={summary?.low_stock_products ?? 0}
                            iconColor="warning"
                        />
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isSummaryLoading ? (
                        <Skeleton variant="rounded" height={86} />
                    ) : (
                        <StatCard
                            icon={<HighlightOffOutlinedIcon />}
                            label="Out of Stock Products"
                            value={summary?.out_of_stock_products ?? 0}
                            iconColor="error"
                        />
                    )}
                </Grid>
            </Grid>

            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 7 }}>
                    <Paper variant="outlined" sx={{ p: 3, height: "100%" }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Inventory by Category
                        </Typography>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={categoryChart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F5" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <ChartTooltip />
                                <Bar dataKey="quantity" fill="#4F46E5" radius={[6, 6, 0, 0]} name="Quantity" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                    <Paper variant="outlined" sx={{ p: 3, height: "100%" }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Stock Status Distribution
                        </Typography>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={statusChart}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={2}
                                >
                                    {statusChart.map((entry) => (
                                        <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                </Pie>
                                <ChartTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap", mt: 1 }}>
                            {statusChart.map((s) => (
                                <Box key={s.name} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.color }} />
                                    <Typography variant="caption" color="text.secondary">
                                        {s.name} ({s.value})
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search name or SKU..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Select
                            fullWidth
                            size="small"
                            displayEmpty
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value as number | "")}
                        >
                            <MenuItem value="">All Categories</MenuItem>
                            {(categories ?? []).map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                    {c.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 6, md: 2 }}>
                        <Select
                            fullWidth
                            size="small"
                            displayEmpty
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StockStatus | "")}
                        >
                            <MenuItem value="">All Status</MenuItem>
                            <MenuItem value="IN_STOCK">In Stock</MenuItem>
                            <MenuItem value="LOW_STOCK">Low Stock</MenuItem>
                            <MenuItem value="OUT_OF_STOCK">Out of Stock</MenuItem>
                        </Select>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 6, md: 2 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Brand"
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                        <Select
                            fullWidth
                            size="small"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        >
                            <MenuItem value="updated">Recently Updated</MenuItem>
                            <MenuItem value="name">Product Name</MenuItem>
                            <MenuItem value="stock">Current Stock</MenuItem>
                        </Select>
                    </Grid>
                </Grid>
            </Paper>

            <Paper variant="outlined">
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Product Name</TableCell>
                                <TableCell>SKU</TableCell>
                                <TableCell>Category</TableCell>
                                <TableCell>Brand</TableCell>
                                <TableCell align="right">Current Stock</TableCell>
                                <TableCell align="right">Reserved</TableCell>
                                <TableCell align="right">Available</TableCell>
                                <TableCell align="right">Reorder Level</TableCell>
                                <TableCell align="center">Status</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading &&
                                [1, 2, 3].map((i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={10}>
                                            <Skeleton height={32} />
                                        </TableCell>
                                    </TableRow>
                                ))}

                            {isError && (
                                <TableRow>
                                    <TableCell colSpan={10}>
                                        <Alert severity="error">Couldn't load inventory.</Alert>
                                    </TableCell>
                                </TableRow>
                            )}

                            {!isLoading && !isError && rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={10}>
                                        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                                            No inventory records found. Try adjusting your filters.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}

                            {rows.map((item) => (
                                <TableRow key={item.id} hover>
                                    <TableCell sx={{ fontWeight: 600 }}>{item.product?.name ?? "—"}</TableCell>
                                    <TableCell>
                                        <Chip size="small" label={item.product?.sku ?? "—"} variant="outlined" />
                                    </TableCell>
                                    <TableCell>{item.category?.name ?? "—"}</TableCell>
                                    <TableCell>{item.product?.brand || "—"}</TableCell>
                                    <TableCell align="right">{item.current_stock}</TableCell>
                                    <TableCell align="right">{item.reserved_stock}</TableCell>
                                    <TableCell align="right">{item.available_stock}</TableCell>
                                    <TableCell align="right">{item.reorder_level}</TableCell>
                                    <TableCell align="center">
                                        <StockStatusChip status={item.stock_status} />
                                    </TableCell>
                                    <TableCell align="right">
                                        {isAdmin && (
                                            <>
                                                <Tooltip title="Add stock">
                                                    <IconButton
                                                        size="small"
                                                        color="success"
                                                        onClick={() => openAdjustDialog(item, "STOCK_IN")}
                                                    >
                                                        <AddCircleOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Remove stock">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => openAdjustDialog(item, "STOCK_OUT")}
                                                    >
                                                        <RemoveCircleOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Set reorder level">
                                                    <IconButton size="small" onClick={() => openReorderDialog(item)}>
                                                        <TuneIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                        <Tooltip title="Movement history">
                                            <IconButton size="small" onClick={() => setHistoryTarget(item)}>
                                                <HistoryIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Stock adjustment dialog */}
            <Dialog open={!!adjustTarget} onClose={closeAdjustDialog} fullWidth maxWidth="sm">
                <form onSubmit={handleSubmit(onSubmitAdjust)}>
                    <DialogTitle>Adjust Stock — {adjustTarget?.product?.name}</DialogTitle>
                    <DialogContent sx={{ pt: 1 }}>
                        {errorMessage && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {errorMessage}
                            </Alert>
                        )}
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Current stock: <strong>{adjustTarget?.current_stock}</strong> · Available:{" "}
                            <strong>{adjustTarget?.available_stock}</strong>
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid size={12}>
                                <Controller
                                    control={control}
                                    name="adjustment_type"
                                    render={({ field }) => (
                                        <Select fullWidth {...field}>
                                            {(Object.keys(ADJUSTMENT_LABELS) as AdjustmentType[]).map((type) => (
                                                <MenuItem key={type} value={type}>
                                                    {ADJUSTMENT_LABELS[type]}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    )}
                                />
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    label={
                                        adjustmentType === "MANUAL_ADJUSTMENT"
                                            ? "Corrected Stock Quantity"
                                            : "Quantity"
                                    }
                                    type="number"
                                    fullWidth
                                    inputProps={{ min: 0, step: "1" }}
                                    {...register("quantity", {
                                        required: "Quantity is mandatory",
                                        validate: (v) => Number(v) > 0 || "Adjustment quantity must be greater than zero",
                                    })}
                                    error={!!errors.quantity}
                                    helperText={errors.quantity?.message}
                                />
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    label="Reason"
                                    fullWidth
                                    placeholder="e.g. New purchase order received"
                                    {...register("reason", { required: "A reason is mandatory" })}
                                    error={!!errors.reason}
                                    helperText={errors.reason?.message}
                                />
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    label="Remarks (optional)"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    {...register("remarks")}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={closeAdjustDialog}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={adjustMutation.isPending}>
                            Save Adjustment
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Reorder level dialog */}
            <Dialog open={!!reorderTarget} onClose={() => setReorderTarget(null)} fullWidth maxWidth="xs">
                <DialogTitle>Reorder Level — {reorderTarget?.product?.name}</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    {errorMessage && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {errorMessage}
                        </Alert>
                    )}
                    <TextField
                        label="Reorder Level"
                        type="number"
                        fullWidth
                        inputProps={{ min: 0, step: "1" }}
                        value={reorderLevelValue}
                        onChange={(e) => setReorderLevelValue(e.target.value)}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setReorderTarget(null)}>Cancel</Button>
                    <Button variant="contained" onClick={submitReorder} disabled={reorderMutation.isPending}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Movement history dialog */}
            <Dialog open={!!historyTarget} onClose={() => setHistoryTarget(null)} fullWidth maxWidth="md">
                <DialogTitle>Stock Movement History — {historyTarget?.product?.name}</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    {isMovementsLoading && <Skeleton height={200} />}
                    {!isMovementsLoading && (movements ?? []).length === 0 && (
                        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                            No stock movements recorded yet.
                        </Typography>
                    )}
                    {!isMovementsLoading && (movements ?? []).length > 0 && (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell align="right">Previous</TableCell>
                                        <TableCell align="right">Change</TableCell>
                                        <TableCell align="right">Updated</TableCell>
                                        <TableCell>Reason</TableCell>
                                        <TableCell>By</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(movements ?? []).map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell>{new Date(m.created_at).toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    label={MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                                                />
                                            </TableCell>
                                            <TableCell align="right">{m.previous_quantity}</TableCell>
                                            <TableCell
                                                align="right"
                                                sx={{
                                                    color: m.quantity_changed >= 0 ? "success.main" : "error.main",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {m.quantity_changed >= 0 ? "+" : ""}
                                                {m.quantity_changed}
                                            </TableCell>
                                            <TableCell align="right">{m.updated_quantity}</TableCell>
                                            <TableCell>{m.reason || "—"}</TableCell>
                                            <TableCell>{m.performed_by_name || "—"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
                <Divider />
                <DialogActions sx={{ px: 3, py: 1.5 }}>
                    <Button onClick={() => setHistoryTarget(null)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default function InventoryPage() {
    return (
        <RoleGuard allowedRoles={["COMPANY_ADMIN", "ANALYST"]}>
            <InventoryPageContent />
        </RoleGuard>
    );
}
