import './SalesPage.css';
import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
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
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { categoriesApi, productsApi } from "../../api/catalog";
import { customersApi } from "../../api/customers";
import { salesApi } from "../../api/sales";
import RoleGuard from "../../components/RoleGuard";
import type { Product } from "../../types/catalog";
// import type {
//     PaymentMethod,
//     SaleCreateRequest,
//     SaleListItem,
//     SalesChannel,
// } from "../../types/sales";

import type { PaymentMethod, PaymentStatus, Sale, SaleCreateRequest, SaleListItem, SalesChannel } from "../../types/sales";

interface ItemFormValues {
    product_id: number | "";
    quantity: string;
    discount: string;
    tax: string;
}

interface SaleFormValues {
    customer_name: string;
    customer_id: number | "";
    payment_status: PaymentStatus;
    sale_date: string;
    sales_channel: SalesChannel;
    payment_method: PaymentMethod;
    items: ItemFormValues[];
}

const emptyItem: ItemFormValues = { product_id: "", quantity: "1", discount: "0", tax: "0" };

const emptyValues: SaleFormValues = {
    customer_name: "",
    customer_id: "",
    payment_status: "PAID",
    sale_date: "",
    sales_channel: "RETAIL_STORE",
    payment_method: "CASH",
    items: [{ ...emptyItem }],
};

const channelOptions: { value: SalesChannel; label: string }[] = [
    { value: "RETAIL_STORE", label: "Retail Store" },
    { value: "ONLINE_STORE", label: "Online Store" },
    { value: "MARKETPLACE", label: "Marketplace" },
];

const paymentStatusOptions: { value: PaymentStatus; label: string }[] = [
    { value: "PAID", label: "Paid" },
    { value: "PENDING", label: "Pending" },
    { value: "PARTIAL", label: "Partial" },
    { value: "FAILED", label: "Failed" },
];

const paymentOptions: { value: PaymentMethod; label: string }[] = [
    { value: "CASH", label: "Cash" },
    { value: "CARD", label: "Card" },
    { value: "UPI", label: "UPI" },
    { value: "BANK_TRANSFER", label: "Bank Transfer" },
];

function currency(value: number) {
    return `$${Number(value).toFixed(2)}`;
}

function toDatetimeLocal(value?: string | null) {
    if (!value) return "";
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SalesPageContent() {
    const queryClient = useQueryClient();

    // Search & filter state
    const [search, setSearch] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<number | "">("");
    const [channelFilter, setChannelFilter] = useState<SalesChannel | "">("");
    const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "">("");
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | "">("");
    const [sortBy, setSortBy] = useState<"date" | "invoice_number" | "total_amount" | "customer_name">("date");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<SaleListItem | null>(null);
    const [viewTarget, setViewTarget] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SaleListItem | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const { data: customers } = useQuery({
        queryKey: ["customers"],
        queryFn: () => customersApi.list(),
    });

    const { data: categories } = useQuery({
        queryKey: ["categories"],
        queryFn: () => categoriesApi.list(),
    });

    const { data: products } = useQuery({
        queryKey: ["products"],
        queryFn: () => productsApi.list(),
    });

    const { data: summary } = useQuery({
        queryKey: ["sales-summary"],
        queryFn: () => salesApi.dashboardSummary(),
        refetchInterval: 15000,
    });

    const { data, isLoading, isError } = useQuery({
        queryKey: ["sales", search, dateFrom, dateTo, categoryFilter, channelFilter, paymentFilter, paymentStatusFilter, sortBy, sortDir],
        queryFn: () =>
            salesApi.list({
                search: search || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                category_id: categoryFilter || undefined,
                sales_channel: channelFilter || undefined,
                payment_method: paymentFilter || undefined,
                payment_status: paymentStatusFilter || undefined,
                sort_by: sortBy,
                sort_dir: sortDir,
            }),
        refetchInterval: 15000,
    });

    const { data: viewedSale, isLoading: isViewLoading } = useQuery({
        queryKey: ["sale", viewTarget],
        queryFn: () => salesApi.get(viewTarget as number),
        enabled: viewTarget != null,
    });

    const {
        control,
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<SaleFormValues>({ defaultValues: emptyValues });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = watch("items");

    const productsById = useMemo(() => {
        const map = new Map<number, Product>();
        (products ?? []).forEach((p) => map.set(p.id, p));
        return map;
    }, [products]);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["sales"] });
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] });
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["sale"] });
    };

    const toPayload = (values: SaleFormValues): SaleCreateRequest => ({
        customer_name: values.customer_name.trim(),
        customer_id: values.customer_id === "" ? null : Number(values.customer_id),
        payment_status: values.payment_status,
        sale_date: values.sale_date ? new Date(values.sale_date).toISOString() : undefined,
        sales_channel: values.sales_channel,
        payment_method: values.payment_method,
        items: values.items.map((item) => {
            const product = productsById.get(Number(item.product_id));
            return {
                product_id: Number(item.product_id),
                quantity: Number(item.quantity),
                unit_price: product ? Number(product.unit_price) : 0,
                discount: Number(item.discount || 0),
                tax: Number(item.tax || 0),
            };
        }),
    });

    const createMutation = useMutation({
        mutationFn: (payload: SaleCreateRequest) => salesApi.create(payload),
        onSuccess: () => {
            invalidate();
            closeDialog();
        },
        onError: (err: any) =>
            setErrorMessage(err?.response?.data?.detail ?? "Failed to save sale"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: SaleCreateRequest }) =>
            salesApi.update(id, payload),
        onSuccess: () => {
            invalidate();
            closeDialog();
        },
        onError: (err: any) =>
            setErrorMessage(err?.response?.data?.detail ?? "Failed to save sale"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => salesApi.remove(id),
        onSuccess: () => {
            invalidate();
            setDeleteTarget(null);
        },
        onError: (err: any) => {
            setErrorMessage(err?.response?.data?.detail ?? "Failed to delete sale");
            setDeleteTarget(null);
        },
    });

    // Dialog portals hide the page from assistive technology. Blur the trigger first so it is not left inside that hidden page.
    const releaseTriggerFocus = () => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) activeElement.blur();
    };

    const openCreateDialog = () => {
        releaseTriggerFocus();
        setEditing(null);
        reset(emptyValues);
        setErrorMessage(null);
        setDialogOpen(true);
    };

    const openEditDialog = async (row: SaleListItem) => {
        releaseTriggerFocus();
        setErrorMessage(null);
        const sale = await salesApi.get(row.id);
        setEditing(row);
        reset({
            customer_name: sale.customer_name,
            customer_id: sale.customer_id ?? "",
            payment_status: sale.payment_status,
            sale_date: toDatetimeLocal(sale.sale_date),
            sales_channel: sale.sales_channel,
            payment_method: sale.payment_method,
            items: sale.items.map((item) => ({
                product_id: item.product_id,
                quantity: String(item.quantity),
                discount: String(item.discount),
                tax: String(item.tax),
            })),
        });
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditing(null);
    };

    const onSubmit = (values: SaleFormValues) => {
        setErrorMessage(null);

        for (const item of values.items) {
            if (!item.product_id) {
                setErrorMessage("Product selection is mandatory for every line item");
                return;
            }
            if (Number(item.quantity) <= 0) {
                setErrorMessage("Quantity must be greater than zero");
                return;
            }
            const product = productsById.get(Number(item.product_id));
            if (product && Number(item.quantity) > product.stock_quantity) {
                setErrorMessage(`Requested quantity exceeds available stock for ${product.name}.`);
                return;
            }
            const lineValue = (product ? Number(product.unit_price) : 0) * Number(item.quantity);
            if (Number(item.discount || 0) > lineValue) {
                setErrorMessage("Discount cannot exceed total product value");
                return;
            }
        }

        const payload = toPayload(values);
        if (editing) {
            updateMutation.mutate({ id: editing.id, payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const rows = useMemo(() => data ?? [], [data]);
    const isSaving = createMutation.isPending || updateMutation.isPending;

    const computeLineTotal = (item: ItemFormValues) => {
        const product = productsById.get(Number(item.product_id));
        const unitPrice = product ? Number(product.unit_price) : 0;
        const qty = Number(item.quantity) || 0;
        const discount = Number(item.discount) || 0;
        const tax = Number(item.tax) || 0;
        return unitPrice * qty - discount + tax;
    };

    const billing = useMemo(() => {
        return (watchedItems ?? []).reduce((summary, item) => {
            const product = productsById.get(Number(item.product_id));
            const lineSubtotal = (Number(product?.unit_price) || 0) * (Number(item.quantity) || 0);
            const discount = Number(item.discount) || 0;
            const tax = Number(item.tax) || 0;
            return { subtotal: summary.subtotal + lineSubtotal, discount: summary.discount + discount, tax: summary.tax + tax };
        }, { subtotal: 0, discount: 0, tax: 0 });
    }, [watchedItems, productsById]);
    const formTotal = billing.subtotal - billing.discount + billing.tax;

    const exportCsv = (sale: Sale) => {
        const rows = [["Invoice Number", sale.invoice_number], ["Customer", sale.customer_name], ["Sale Date", new Date(sale.sale_date).toLocaleString()], [], ["Product", "SKU", "Quantity", "Unit Price", "Line Total"], ...sale.items.map((item) => [item.product_name ?? "", item.sku ?? "", String(item.quantity), String(item.unit_price), String(item.total)]), [], ["Subtotal", "", "", "", String(sale.subtotal)], ["Discount", "", "", "", String(sale.discount_total)], ["Tax", "", "", "", String(sale.tax_total)], ["Grand Total", "", "", "", String(sale.total_amount)]];
        const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = `${sale.invoice_number}.csv`; link.click(); URL.revokeObjectURL(url);
    };
    const exportPdf = (sale: Sale) => {
        // Do not use `noopener` here: browsers return null for that popup and no invoice can be written.
        const popup = window.open("", "_blank", "width=900,height=700");
        if (!popup) {
            setErrorMessage("The invoice window was blocked. Please allow pop-ups and try again.");
            return;
        }
        popup.document.write(`<html><head><title>${sale.invoice_number}</title><style>body{font-family:Arial;padding:32px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.total{font-weight:bold;text-align:right}</style></head><body><h1>RetailPulse Analytics</h1><h2>Invoice ${sale.invoice_number}</h2><p><b>Customer:</b> ${sale.customer_name}<br/><b>Date:</b> ${new Date(sale.sale_date).toLocaleString()}<br/><b>Payment:</b> ${sale.payment_method}</p><table><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead><tbody>${sale.items.map((item) => `<tr><td>${item.product_name ?? ""}</td><td>${item.sku ?? ""}</td><td>${item.quantity}</td><td>${currency(item.unit_price)}</td><td>${currency(item.total)}</td></tr>`).join("")}</tbody></table><p class="total">Subtotal: ${currency(sale.subtotal)}<br/>Discount: -${currency(sale.discount_total)}<br/>Tax: +${currency(sale.tax_total)}<br/>Grand Total: ${currency(sale.total_amount)}</p></body></html>`);
        popup.document.close(); popup.focus(); popup.print();
    };

    const summaryCards = [
        {
            label: "Total Sales",
            value: summary ? summary.total_sales.toLocaleString() : "—",
            icon: <ShoppingCartOutlinedIcon />,
            color: "#4F46E5",
        },
        {
            label: "Total Revenue",
            value: summary ? currency(summary.total_revenue) : "—",
            icon: <PaidOutlinedIcon />,
            color: "#22C55E",
        },
        {
            label: "Total Orders",
            value: summary ? summary.total_orders.toLocaleString() : "—",
            icon: <ReceiptLongOutlinedIcon />,
            color: "#F59E0B",
        },
        {
            label: "Average Order Value",
            value: summary ? currency(summary.average_order_value) : "—",
            icon: <TrendingUpIcon />,
            color: "#3B82F6",
        },
    ];

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
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Sales
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Record and manage product sales transactions.
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                    New Sale
                </Button>
            </Box>

            <Grid container spacing={2} sx={{ mb: 3 }}>
                {summaryCards.map((card) => (
                    <Grid key={card.label} size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card variant="outlined">
                            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <Box
                                    sx={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 2,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        bgcolor: `${card.color}1A`,
                                        color: card.color,
                                    }}
                                >
                                    {card.icon}
                                </Box>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        {card.label}
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {card.value}
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search invoice, customer, product..."
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
                    <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="From"
                            slotProps={{ inputLabel: { shrink: true } }}
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="To"
                            slotProps={{ inputLabel: { shrink: true } }}
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3, md: 2 }}>
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
                    <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                        <Select
                            fullWidth
                            size="small"
                            displayEmpty
                            value={channelFilter}
                            onChange={(e) => setChannelFilter(e.target.value as SalesChannel | "")}
                        >
                            <MenuItem value="">All Channels</MenuItem>
                            {channelOptions.map((c) => (
                                <MenuItem key={c.value} value={c.value}>
                                    {c.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3, md: 1 }}>
                        <Select
                            fullWidth
                            size="small"
                            displayEmpty
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value as PaymentMethod | "")}
                        >
                            <MenuItem value="">All Payments</MenuItem>
                            {paymentOptions.map((p) => (
                                <MenuItem key={p.value} value={p.value}>
                                    {p.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                        <Select fullWidth size="small" displayEmpty value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as PaymentStatus | "")}>
                            <MenuItem value="">All Statuses</MenuItem>
                            {paymentStatusOptions.map((status) => <MenuItem key={status.value} value={status.value}>{status.label}</MenuItem>)}
                        </Select>
                    </Grid>
                </Grid>
                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid size={{ xs: 8, sm: 4, md: 3 }}>
                        <Select
                            fullWidth
                            size="small"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        >
                            <MenuItem value="date">Sort by Date</MenuItem>
                            <MenuItem value="invoice_number">Sort by Invoice Number</MenuItem>
                            <MenuItem value="total_amount">Sort by Total Amount</MenuItem>
                            <MenuItem value="customer_name">Sort by Customer Name</MenuItem>
                        </Select>
                    </Grid>
                    <Grid size={{ xs: 4, sm: 2, md: 2 }}>
                        <Select
                            fullWidth
                            size="small"
                            value={sortDir}
                            onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                        >
                            <MenuItem value="desc">Desc</MenuItem>
                            <MenuItem value="asc">Asc</MenuItem>
                        </Select>
                    </Grid>
                </Grid>
            </Paper>

            <Paper variant="outlined">
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Invoice #</TableCell>
                                <TableCell>Date</TableCell>
                                <TableCell>Customer</TableCell>
                                <TableCell>Products</TableCell>
                                <TableCell>Channel</TableCell>
                                <TableCell>Payment</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right">Total</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading &&
                                [1, 2, 3].map((i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={9}>
                                            <Skeleton height={32} />
                                        </TableCell>
                                    </TableRow>
                                ))}

                            {isError && (
                                <TableRow>
                                    <TableCell colSpan={9}>
                                        <Alert severity="error">Couldn't load sales.</Alert>
                                    </TableCell>
                                </TableRow>
                            )}

                            {!isLoading && !isError && rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9}>
                                        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                                            No sales found. Try adjusting your filters or record a new sale.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}

                            {rows.map((sale) => (
                                <TableRow key={sale.id} hover>
                                    <TableCell sx={{ fontWeight: 600 }}>
                                        <Chip size="small" label={sale.invoice_number} variant="outlined" />
                                    </TableCell>
                                    <TableCell>{new Date(sale.sale_date).toLocaleString()}</TableCell>
                                    <TableCell>{sale.customer_name}</TableCell>
                                    <TableCell>{sale.product_summary ?? "—"}</TableCell>
                                    <TableCell>
                                        {channelOptions.find((c) => c.value === sale.sales_channel)?.label}
                                    </TableCell>
                                    <TableCell>
                                        {paymentOptions.find((p) => p.value === sale.payment_method)?.label}
                                    </TableCell>
                                    <TableCell><Chip size="small" label={sale.payment_status} color={sale.payment_status === "PAID" ? "success" : sale.payment_status === "FAILED" ? "error" : "warning"} /></TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                                        {currency(sale.total_amount)}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="View">
                                            <IconButton size="small" onClick={() => { releaseTriggerFocus(); setViewTarget(sale.id); }}>
                                                <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => openEditDialog(sale)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => { releaseTriggerFocus(); setDeleteTarget(sale); }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Create / Edit dialog */}
            <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogTitle>{editing ? "Edit Sale" : "New Sale"}</DialogTitle>
                    <DialogContent sx={{ pt: 1 }}>
                        {errorMessage && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {errorMessage}
                            </Alert>
                        )}
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Controller control={control} name="customer_id" rules={{ required: "Customer selection is mandatory" }} render={({ field }) => (
                                    <TextField select label="Customer" fullWidth autoFocus value={field.value} onChange={(event) => {
                                        const id = Number(event.target.value); const customer = (customers ?? []).find((entry) => entry.id === id);
                                        field.onChange(id); reset({ ...watch(), customer_id: id, customer_name: customer?.full_name ?? "" });
                                    }} error={!!errors.customer_id} helperText={errors.customer_id?.message ?? "Select an active customer"}>
                                        <MenuItem value="" disabled>Select customer</MenuItem>
                                        {(customers ?? []).filter((customer) => customer.status === "ACTIVE").map((customer) => <MenuItem key={customer.id} value={customer.id}>{customer.full_name}</MenuItem>)}
                                    </TextField>
                                )} />
                                <input type="hidden" {...register("customer_name", { required: "Customer selection is mandatory" })} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Sale Date & Time"
                                    type="datetime-local"
                                    fullWidth
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    {...register("sale_date")}
                                    helperText="Leave blank to use the current date & time"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Controller
                                    control={control}
                                    name="sales_channel"
                                    render={({ field }) => (
                                        <Select fullWidth {...field} displayEmpty>
                                            {channelOptions.map((c) => (
                                                <MenuItem key={c.value} value={c.value}>
                                                    {c.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    )}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Controller
                                    control={control}
                                    name="payment_method"
                                    render={({ field }) => (
                                        <Select fullWidth {...field} displayEmpty>
                                            {paymentOptions.map((p) => (
                                                <MenuItem key={p.value} value={p.value}>
                                                    {p.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    )}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Controller control={control} name="payment_status" render={({ field }) => (
                                    <TextField select label="Payment Status" fullWidth {...field}>{paymentStatusOptions.map((status) => <MenuItem key={status.value} value={status.value}>{status.label}</MenuItem>)}</TextField>
                                )} />
                            </Grid>

                            <Grid size={12}>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    Products
                                </Typography>
                            </Grid>

                            {fields.map((field, index) => {
                                const item = watchedItems?.[index];
                                const product = item ? productsById.get(Number(item.product_id)) : undefined;
                                return (
                                    <Grid size={12} key={field.id}>
                                        <Grid container spacing={1} sx={{ alignItems: "center" }}>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Controller
                                                    control={control}
                                                    name={`items.${index}.product_id`}
                                                    rules={{ required: true }}
                                                    render={({ field: f }) => (
                                                        <Select fullWidth size="small" displayEmpty {...f}>
                                                            <MenuItem value="" disabled>
                                                                Select product
                                                            </MenuItem>
                                                            {(products ?? []).map((p) => (
                                                                <MenuItem key={p.id} value={p.id}>
                                                                    {p.name} ({p.stock_quantity} in stock)
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    )}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 4, sm: 2 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Category"
                                                    value={product?.category?.name ?? "—"}
                                                    disabled
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 4, sm: 1.5 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    type="number"
                                                    label="Qty"
                                                    slotProps={{ htmlInput: { min: 1 } }}
                                                    {...register(`items.${index}.quantity`, {
                                                        required: true,
                                                        validate: (v) => Number(v) > 0,
                                                    })}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 4, sm: 1.5 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    type="number"
                                                    label="Discount"
                                                    slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                                                    {...register(`items.${index}.discount`)}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 4, sm: 1.5 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    type="number"
                                                    label="Tax"
                                                    slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                                                    {...register(`items.${index}.tax`)}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 3, sm: 1 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    {item ? currency(computeLineTotal(item)) : "$0.00"}
                                                </Typography>
                                            </Grid>
                                            <Grid size={{ xs: 1 }}>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    disabled={fields.length === 1}
                                                    onClick={() => remove(index)}
                                                >
                                                    <RemoveCircleOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </Grid>
                                            {product && (
                                                <Grid size={12}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Unit Price {currency(Number(product.unit_price))} · Available
                                                        stock {product.stock_quantity}
                                                    </Typography>
                                                </Grid>
                                            )}
                                        </Grid>
                                    </Grid>
                                );
                            })}

                            <Grid size={12}>
                                <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => append({ ...emptyItem })}
                                >
                                    Add Product
                                </Button>
                            </Grid>

                            <Grid size={12}>
                                <Divider sx={{ my: 1 }} />
                                <Paper variant="outlined" sx={{ ml: "auto", p: 2, maxWidth: 340 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Billing Summary</Typography>
                                    <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography color="text.secondary">Subtotal</Typography><Typography>{currency(billing.subtotal)}</Typography></Box>
                                    <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography color="text.secondary">Discount</Typography><Typography>-{currency(billing.discount)}</Typography></Box>
                                    <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography color="text.secondary">Tax</Typography><Typography>+{currency(billing.tax)}</Typography></Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography sx={{ fontWeight: 700 }}>Grand Total</Typography><Typography sx={{ fontWeight: 700 }}>{currency(formTotal)}</Typography></Box>
                                </Paper>
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={closeDialog}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={isSaving}>
                            {editing ? "Save Changes" : "Create Sale"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* View details dialog */}
            <Dialog open={viewTarget != null} onClose={() => setViewTarget(null)} fullWidth maxWidth="sm">
                <DialogTitle>Sale Details</DialogTitle>
                <DialogContent>
                    {isViewLoading && <Skeleton height={200} />}
                    {viewedSale && (
                        <Box>
                            <Grid container spacing={1} sx={{ mb: 2 }}>
                                <Grid size={6}>
                                    <Typography variant="caption" color="text.secondary">
                                        Invoice Number
                                    </Typography>
                                    <Typography sx={{ fontWeight: 600 }}>{viewedSale.invoice_number}</Typography>
                                </Grid>
                                <Grid size={6}>
                                    <Typography variant="caption" color="text.secondary">
                                        Sale Date
                                    </Typography>
                                    <Typography>{new Date(viewedSale.sale_date).toLocaleString()}</Typography>
                                </Grid>
                                <Grid size={6}>
                                    <Typography variant="caption" color="text.secondary">
                                        Customer
                                    </Typography>
                                    <Typography>{viewedSale.customer_name}</Typography>
                                </Grid>
                                <Grid size={6}>
                                    <Typography variant="caption" color="text.secondary">
                                        Recorded By
                                    </Typography>
                                    <Typography>{viewedSale.created_by_name ?? "—"}</Typography>
                                </Grid>
                                <Grid size={6}>
                                    <Typography variant="caption" color="text.secondary">
                                        Sales Channel
                                    </Typography>
                                    <Typography>
                                        {channelOptions.find((c) => c.value === viewedSale.sales_channel)?.label}
                                    </Typography>
                                </Grid>
                                <Grid size={6}>
                                    <Typography variant="caption" color="text.secondary">
                                        Payment Method
                                    </Typography>
                                    <Typography>
                                        {paymentOptions.find((p) => p.value === viewedSale.payment_method)?.label}
                                    </Typography>
                                </Grid>
                            </Grid>

                            <Divider sx={{ mb: 2 }} />

                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Product / SKU</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">Unit Price</TableCell>
                                        <TableCell align="right">Discount</TableCell>
                                        <TableCell align="right">Tax</TableCell>
                                        <TableCell align="right">Total</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {viewedSale.items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                {item.product_name}
                                                {item.category_name ? ` (${item.category_name})` : ""}
                                                <Typography variant="caption" display="block" color="text.secondary">SKU: {item.sku ?? "—"}</Typography>
                                            </TableCell>
                                            <TableCell align="right">{item.quantity}</TableCell>
                                            <TableCell align="right">{currency(item.unit_price)}</TableCell>
                                            <TableCell align="right">{currency(item.discount)}</TableCell>
                                            <TableCell align="right">{currency(item.tax)}</TableCell>
                                            <TableCell align="right">{currency(item.total)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            <Divider sx={{ my: 2 }} />

                            <Grid container spacing={1}>
                                <Grid size={8}>
                                    <Typography color="text.secondary">Subtotal</Typography>
                                </Grid>
                                <Grid size={4}>
                                    <Typography sx={{ textAlign: "right" }}>{currency(viewedSale.subtotal)}</Typography>
                                </Grid>
                                <Grid size={8}>
                                    <Typography color="text.secondary">Discount Applied</Typography>
                                </Grid>
                                <Grid size={4}>
                                    <Typography sx={{ textAlign: "right" }}>
                                        -{currency(viewedSale.discount_total)}
                                    </Typography>
                                </Grid>
                                <Grid size={8}>
                                    <Typography color="text.secondary">Tax</Typography>
                                </Grid>
                                <Grid size={4}>
                                    <Typography sx={{ textAlign: "right" }}>
                                        +{currency(viewedSale.tax_total)}
                                    </Typography>
                                </Grid>
                                <Grid size={8}>
                                    <Typography sx={{ fontWeight: 700 }}>Final Amount</Typography>
                                </Grid>
                                <Grid size={4}>
                                    <Typography sx={{ textAlign: "right", fontWeight: 700 }}>
                                        {currency(viewedSale.total_amount)}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button startIcon={<DownloadOutlinedIcon />} disabled={!viewedSale} onClick={() => viewedSale && exportPdf(viewedSale)}>Export PDF</Button>
                    <Button startIcon={<DownloadOutlinedIcon />} disabled={!viewedSale} onClick={() => viewedSale && exportCsv(viewedSale)}>Export CSV</Button>
                    <Button onClick={() => setViewTarget(null)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
                <DialogTitle>Delete Sale</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete invoice{" "}
                        <strong>{deleteTarget?.invoice_number}</strong>? Stock quantities for its
                        products will be restored. This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                        disabled={deleteMutation.isPending}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default function SalesPage() {
    return (
        <RoleGuard allowedRoles={["COMPANY_ADMIN", "ANALYST"]}>
            <SalesPageContent />
        </RoleGuard>
    );
}
