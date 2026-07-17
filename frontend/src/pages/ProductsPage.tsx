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
    Grid,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Select,
    Skeleton,
    Switch,
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
// import DeleteIcon from "@mui/icons-material/DeleteOutline";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { categoriesApi, productsApi } from "../api/catalog";
import RoleGuard from "../components/RoleGuard";
// import DeleteIcon from "@mui/icons-material/DeleteOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import type { UnitOfMeasure,Product,ProductCreateRequest,ProductStatus } from "../types/catalog";
// import type {
//     UnitOfMeasure,
//     Product,
//     ProductCreateRequest,
//     ProductStatus,
// } from "../types/catalog";

interface ProductFormValues {
    name: string;
    sku: string;
    category_id: number | "";
    brand: string;
    description: string;
    unit_price: string;
    cost_price: string;
    stock_quantity: string;
    unit_of_measure: UnitOfMeasure;
    status: ProductStatus;
}

const emptyValues: ProductFormValues = {
    name: "",
    sku: "",
    category_id: "",
    brand: "",
    description: "",
    unit_price: "",
    cost_price: "",
    stock_quantity: "0",
    unit_of_measure: "PCS",
    status: "ACTIVE",
};

const unitOptions: UnitOfMeasure[] = [
    "PCS",
    "KG",
    "GRAM",
    "LITRE",
    "ML",
    "BOX",
    "PACK",
    "DOZEN",
    "METER",
    "UNIT",
];

function currency(value: number) {
    return `$${Number(value).toFixed(2)}`;
}

function ProductsPageContent() {
    const queryClient = useQueryClient();

    // Search & filter state
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<number | "">("");
    const [statusFilter, setStatusFilter] = useState<ProductStatus | "">("");
    const [brandFilter, setBrandFilter] = useState("");
    const [sortBy, setSortBy] = useState<"recent" | "name" | "price">("recent");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Product | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const { data: categories } = useQuery({
        queryKey: ["categories"],
        queryFn: () => categoriesApi.list(),
        refetchInterval: 15000,
    });

    const { data, isLoading, isError, isFetching, dataUpdatedAt } = useQuery({
        queryKey: ["products", search, categoryFilter, statusFilter, brandFilter, sortBy],
        queryFn: () =>
            productsApi.list({
                search: search || undefined,
                category_id: categoryFilter || undefined,
                status: statusFilter || undefined,
                brand: brandFilter || undefined,
                sort_by: sortBy,
            }),
        refetchInterval: 15000,
        refetchOnWindowFocus: true,
    });

    const {
        control,
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ProductFormValues>({ defaultValues: emptyValues });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["categories"] });
    };

    const toPayload = (values: ProductFormValues): ProductCreateRequest => ({
        name: values.name.trim(),
        sku: values.sku.trim().toUpperCase(),
        category_id: Number(values.category_id),
        brand: values.brand.trim() || null,
        description: values.description.trim() || null,
        unit_price: Number(values.unit_price),
        cost_price: Number(values.cost_price),
        stock_quantity: Number(values.stock_quantity),
        unit_of_measure: values.unit_of_measure,
        status: values.status,
    });

    const createMutation = useMutation({
        mutationFn: (payload: ProductCreateRequest) => productsApi.create(payload),
        onSuccess: () => {
            invalidate();
            closeDialog();
        },
        onError: (err: any) =>
            setErrorMessage(err?.response?.data?.detail ?? "Failed to save product"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: ProductCreateRequest }) =>
            productsApi.update(id, payload),
        onSuccess: () => {
            invalidate();
            closeDialog();
        },
        onError: (err: any) =>
            setErrorMessage(err?.response?.data?.detail ?? "Failed to save product"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => productsApi.remove(id),
        onSuccess: () => {
            invalidate();
            setDeleteTarget(null);
        },
        onError: (err: any) => {
            setErrorMessage(err?.response?.data?.detail ?? "Failed to delete product");
            setDeleteTarget(null);
        },
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number; status: ProductStatus }) =>
            productsApi.setStatus(id, status),
        onSuccess: invalidate,
        onError: (err: any) =>
            setErrorMessage(err?.response?.data?.detail ?? "Failed to update product status"),
    });

    const openCreateDialog = () => {
        setEditing(null);
        reset(emptyValues);
        setErrorMessage(null);
        setDialogOpen(true);
    };

    const openEditDialog = (product: Product) => {
        setEditing(product);
        reset({
            name: product.name,
            sku: product.sku,
            category_id: product.category_id,
            brand: product.brand ?? "",
            description: product.description ?? "",
            unit_price: String(product.unit_price),
            cost_price: String(product.cost_price),
            stock_quantity: String(product.stock_quantity),
            unit_of_measure: product.unit_of_measure,
            status: product.status,
        });
        setErrorMessage(null);
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditing(null);
    };

    const onSubmit = (values: ProductFormValues) => {
        setErrorMessage(null);

        if (Number(values.cost_price) > Number(values.unit_price)) {
            setErrorMessage("Cost Price cannot exceed Unit Price");
            return;
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
                            Products
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
                        Manage your product catalog, pricing, and stock.
                        {dataUpdatedAt ? ` Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}.` : ""}
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                    Add Product
                </Button>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search name, SKU, brand..."
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
                            onChange={(e) => setStatusFilter(e.target.value as ProductStatus | "")}
                        >
                            <MenuItem value="">All Status</MenuItem>
                            <MenuItem value="ACTIVE">Active</MenuItem>
                            <MenuItem value="INACTIVE">Inactive</MenuItem>
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
                            <MenuItem value="recent">Recently Added</MenuItem>
                            <MenuItem value="name">Name</MenuItem>
                            <MenuItem value="price">Price</MenuItem>
                        </Select>
                    </Grid>
                </Grid>
            </Paper>

            <Paper variant="outlined">
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>SKU</TableCell>
                                <TableCell>Category</TableCell>
                                <TableCell>Brand</TableCell>
                                <TableCell align="right">Unit Price</TableCell>
                                <TableCell align="right">Cost Price</TableCell>
                                <TableCell align="right">Stock</TableCell>
                                <TableCell>UoM</TableCell>
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
                                        <Alert severity="error">Couldn't load products.</Alert>
                                    </TableCell>
                                </TableRow>
                            )}

                            {!isLoading && !isError && rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={10}>
                                        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                                            No products found. Try adjusting your filters or add a new product.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}

                            {rows.map((product) => (
                                <TableRow key={product.id} hover>
                                    <TableCell sx={{ fontWeight: 600 }}>{product.name}</TableCell>
                                    <TableCell>
                                        <Chip size="small" label={product.sku} variant="outlined" />
                                    </TableCell>
                                    <TableCell>{product.category?.name ?? "—"}</TableCell>
                                    <TableCell>{product.brand || "—"}</TableCell>
                                    <TableCell align="right">{currency(product.unit_price)}</TableCell>
                                    <TableCell align="right">{currency(product.cost_price)}</TableCell>
                                    <TableCell align="right">{product.stock_quantity}</TableCell>
                                    <TableCell>{product.unit_of_measure}</TableCell>
                                    <TableCell align="center">
                                        <Tooltip title={product.status === "ACTIVE" ? "Disable product" : "Enable product"}>
                                            <Switch
                                                size="small"
                                                checked={product.status === "ACTIVE"}
                                                onChange={(e) =>
                                                    toggleStatusMutation.mutate({
                                                        id: product.id,
                                                        status: e.target.checked ? "ACTIVE" : "INACTIVE",
                                                    })
                                                }
                                            />
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => openEditDialog(product)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => setDeleteTarget(product)}
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
                    <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
                    <DialogContent sx={{ pt: 1 }}>
                        {errorMessage && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {errorMessage}
                            </Alert>
                        )}
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Product Name"
                                    fullWidth
                                    autoFocus
                                    {...register("name", { required: "Product name is mandatory" })}
                                    error={!!errors.name}
                                    helperText={errors.name?.message}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="SKU"
                                    fullWidth
                                    placeholder="RTL-10001"
                                    {...register("sku", { required: "SKU is mandatory" })}
                                    error={!!errors.sku}
                                    helperText={errors.sku?.message}
                                />
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Controller
                                    control={control}
                                    name="category_id"
                                    rules={{ required: "Category is mandatory" }}
                                    render={({ field }) => (
                                        <Select fullWidth displayEmpty {...field} error={!!errors.category_id}>
                                            <MenuItem value="" disabled>
                                                Select category
                                            </MenuItem>
                                            {(categories ?? []).map((c) => (
                                                <MenuItem key={c.id} value={c.id}>
                                                    {c.name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    )}
                                />
                                {errors.category_id && (
                                    <Typography variant="caption" color="error">
                                        {errors.category_id.message}
                                    </Typography>
                                )}
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Brand" fullWidth {...register("brand")} />
                            </Grid>

                            <Grid size={12}>
                                <TextField
                                    label="Product Description"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    {...register("description")}
                                />
                            </Grid>

                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField
                                    label="Unit Price"
                                    type="number"
                                    fullWidth
                                    inputProps={{ step: "0.01", min: 0 }}
                                    {...register("unit_price", {
                                        required: "Unit Price is mandatory",
                                        validate: (v) => Number(v) > 0 || "Unit Price must be greater than zero",
                                    })}
                                    error={!!errors.unit_price}
                                    helperText={errors.unit_price?.message}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField
                                    label="Cost Price"
                                    type="number"
                                    fullWidth
                                    inputProps={{ step: "0.01", min: 0 }}
                                    {...register("cost_price", {
                                        required: "Cost Price is mandatory",
                                        validate: (v) => Number(v) >= 0 || "Cost Price cannot be negative",
                                    })}
                                    error={!!errors.cost_price}
                                    helperText={errors.cost_price?.message}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField
                                    label="Initial Stock Quantity"
                                    type="number"
                                    fullWidth
                                    inputProps={{ step: "1", min: 0 }}
                                    {...register("stock_quantity", {
                                        required: "Stock Quantity is mandatory",
                                        validate: (v) => Number(v) >= 0 || "Stock Quantity cannot be negative",
                                    })}
                                    error={!!errors.stock_quantity}
                                    helperText={errors.stock_quantity?.message}
                                />
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Controller
                                    control={control}
                                    name="unit_of_measure"
                                    render={({ field }) => (
                                        <Select fullWidth {...field}>
                                            {unitOptions.map((u) => (
                                                <MenuItem key={u} value={u}>
                                                    {u}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    )}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Controller
                                    control={control}
                                    name="status"
                                    render={({ field }) => (
                                        <Select fullWidth {...field}>
                                            <MenuItem value="ACTIVE">Active</MenuItem>
                                            <MenuItem value="INACTIVE">Inactive</MenuItem>
                                        </Select>
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={closeDialog}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={isSaving}>
                            {editing ? "Save Changes" : "Create Product"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
                <DialogTitle>Delete Product</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This
                        cannot be undone.
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

export default function ProductsPage() {
    return (
        <RoleGuard allowedRoles={["COMPANY_ADMIN"]}>
            <ProductsPageContent />
        </RoleGuard>
    );
}
