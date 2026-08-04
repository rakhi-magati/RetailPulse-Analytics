import "./CustomersPage.css";

import { useMemo, useState } from "react";

import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/EditOutlined";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";

import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import {
    customersApi,
    type Customer,
    type CustomerInput,
} from "../../api/customers";

import RoleGuard from "../../components/RoleGuard";

type CustomerTransaction = {
    id: number;
    invoice_number: string;
    date: string;
    amount: number;
    payment_method: string;
};

type CustomerDetail = Customer & {
    recent_transactions: CustomerTransaction[];
};

const emptyForm: CustomerInput = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    status: "ACTIVE",
};

const phonePattern = /^\+?[0-9() .-]{7,20}$/;

const money = (value: number | null | undefined) =>
    new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
    }).format(value || 0);

const segmentLabel = (segment: string) =>
    segment.replace("_CUSTOMER", "").replace("_", " ");

const segmentColors: Record<
    string,
    "default" | "primary" | "success" | "secondary"
> = {
    NEW_CUSTOMER: "default",
    REGULAR_CUSTOMER: "primary",
    LOYAL_CUSTOMER: "success",
    VIP_CUSTOMER: "secondary",
};

const segmentColor = (
    segment: string
): "default" | "primary" | "success" | "secondary" =>
    segmentColors[segment] || "default";

/* Customer Form*/

type CustomerFormProps = {
    value: CustomerInput;
    errors: Partial<Record<keyof CustomerInput, string>>;
    onChange: (key: keyof CustomerInput, value: string) => void;
};

function CustomerForm({
    value,
    errors,
    onChange,
}: CustomerFormProps) {
    const fields: {
        key: keyof CustomerInput;
        label: string;
        required?: boolean;
        type?: string;
    }[] = [
            {
                key: "first_name",
                label: "First Name",
                required: true,
            },
            {
                key: "last_name",
                label: "Last Name",
                required: true,
            },
            {
                key: "email",
                label: "Email",
                required: true,
                type: "email",
            },
            {
                key: "phone",
                label: "Phone Number",
                required: true,
                type: "tel",
            },
            {
                key: "address",
                label: "Address",
            },
            {
                key: "city",
                label: "City",
            },
            {
                key: "state",
                label: "State",
            },
            {
                key: "country",
                label: "Country",
            },
            {
                key: "postal_code",
                label: "Postal Code",
            },
        ];

    return (
        <Grid container spacing={2} sx={{ pt: 1 }}>
            {fields.map(({ key, label, required, type }) => (
                <Grid
                    key={key}
                    size={{
                        xs: 12,
                        sm: key === "address" ? 12 : 6,
                    }}
                >
                    <TextField
                        fullWidth
                        required={required}
                        type={type}
                        label={label}
                        value={value[key] ?? ""}
                        error={Boolean(errors[key])}
                        helperText={errors[key] || ""}
                        onChange={(event) =>
                            onChange(key, event.target.value)
                        }
                    />
                </Grid>
            ))}

            <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                    select
                    fullWidth
                    label="Status"
                    value={value.status || "ACTIVE"}
                    onChange={(event) =>
                        onChange("status", event.target.value)
                    }
                >
                    <MenuItem value="ACTIVE">Active</MenuItem>
                    <MenuItem value="INACTIVE">Inactive</MenuItem>
                </TextField>
            </Grid>
        </Grid>
    );
}


/* Customers*/


function Customers() {
    const queryClient = useQueryClient();

    const [search, setSearch] = useState("");
    const [segment, setSegment] = useState("");
    const [status, setStatus] = useState("");

    const [editing, setEditing] = useState<Customer | null>(null);

    const [form, setForm] = useState<CustomerInput>({
        ...emptyForm,
    });

    const [formErrors, setFormErrors] = useState<
        Partial<Record<keyof CustomerInput, string>>
    >({});

    const [formOpen, setFormOpen] = useState(false);

    const [detailId, setDetailId] = useState<number | null>(null);

    const [apiError, setApiError] = useState("");


    /* Customers List*/


    const list = useQuery({
        queryKey: ["customers", search, segment, status],

        queryFn: () =>
            customersApi.list({
                search: search || undefined,
                segment: segment || undefined,
                status: status || undefined,
            }),
    });

    /* ---------------------------------------------------------------------- */
    /* Customer Details                                                       */
    /* ---------------------------------------------------------------------- */

    const detail = useQuery<CustomerDetail>({
        queryKey: ["customer", detailId],

        queryFn: async () => {
            if (detailId === null) {
                throw new Error("Customer ID is required");
            }

            return customersApi.get(detailId) as Promise<CustomerDetail>;
        },

        enabled: detailId !== null,
    });


    /* Refresh*/


    const refresh = () => {
        queryClient.invalidateQueries({
            queryKey: ["customers"],
        });
    };

    /* Save Customer*/

    const save = useMutation({
        mutationFn: async () => {
            if (editing) {
                return customersApi.update(editing.id, form);
            }

            return customersApi.create(form);
        },

        onSuccess: () => {
            setFormOpen(false);
            setEditing(null);
            setForm({ ...emptyForm });
            setFormErrors({});
            setApiError("");

            refresh();
        },

        onError: (error: any) => {
            setApiError(
                error?.response?.data?.detail ||
                "The customer could not be saved. Please try again."
            );
        },
    });

    /* Delete / Deactivate Customer*/


    const remove = useMutation({
        mutationFn: (customerId: number) =>
            customersApi.remove(customerId),

        onSuccess: () => {
            setApiError("");
            refresh();
        },

        onError: (error: any) => {
            setApiError(
                error?.response?.data?.detail ||
                "The customer could not be deactivated."
            );
        },
    });

    /* Validation*/

    const validate = () => {
        const errors: Partial<
            Record<keyof CustomerInput, string>
        > = {};

        const requiredFields: Array<
            keyof CustomerInput
        > = [
                "first_name",
                "last_name",
                "email",
                "phone",
            ];

        requiredFields.forEach((key) => {
            const value = String(form[key] ?? "").trim();

            if (!value) {
                errors[key] = "This field is required.";
            }
        });

        const email = String(form.email ?? "").trim();

        if (
            email &&
            !/^\S+@\S+\.\S+$/.test(email)
        ) {
            errors.email = "Enter a valid email address.";
        }

        const phone = String(form.phone ?? "").trim();

        if (
            phone &&
            !phonePattern.test(phone)
        ) {
            errors.phone =
                "Enter a valid phone number.";
        }

        setFormErrors(errors);

        return Object.keys(errors).length === 0;
    };

    /* Open Customer Form   */

    const openForm = (customer?: Customer) => {
        setApiError("");
        setFormErrors({});

        if (customer) {
            const fullName =
                customer.full_name?.trim() || "";

            const nameParts = fullName.split(" ");

            const firstName =
                customer.first_name ||
                nameParts[0] ||
                "";

            const lastName =
                customer.last_name ||
                nameParts.slice(1).join(" ") ||
                "";

            setEditing(customer);

            setForm({
                first_name: firstName,
                last_name: lastName,
                email: customer.email || "",
                phone: customer.phone || "",
                address: customer.address || "",
                city: customer.city || "",
                state: customer.state || "",
                country: customer.country || "",
                postal_code: customer.postal_code || "",
                status: customer.status || "ACTIVE",
            });
        } else {
            setEditing(null);
            setForm({
                ...emptyForm,
            });
        }

        setFormOpen(true);
    };


    /* Close Form*/


    const closeForm = () => {
        if (save.isPending) {
            return;
        }

        setFormOpen(false);
        setEditing(null);
        setFormErrors({});
        setApiError("");
    };

    /* Submit                                                                 */

    const submit = () => {
        if (!validate()) {
            return;
        }

        setApiError("");
        save.mutate();
    };

    /* Empty State*/


    const noRows =
        !list.isLoading &&
        !list.isError &&
        !list.data?.length;

    /* Purchase History    */

    const purchaseHistory = useMemo(
        () => detail.data?.recent_transactions || [],
        [detail.data]
    );


    /* Render   */


    return (
        <Box className="CustomersPage">
            {/* Header */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 2,
                    alignItems: "center",
                    mb: 3,
                    flexWrap: "wrap",
                }}
            >
                <Box>
                    <Typography
                        variant="h4"
                        fontWeight={700}
                    >
                        Customers
                    </Typography>

                    <Typography color="text.secondary">
                        Manage customer profiles and
                        purchase history.
                    </Typography>
                </Box>

                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => openForm()}
                >
                    Add Customer
                </Button>
            </Box>

            {/* API Error */}
            {apiError && (
                <Alert
                    severity="error"
                    onClose={() => setApiError("")}
                    sx={{ mb: 2 }}
                >
                    {apiError}
                </Alert>
            )}

            {/* Customers Table */}
            <Paper
                sx={{
                    p: 2,
                    overflowX: "auto",
                }}
            >
                {/* Filters */}
                <Box
                    sx={{
                        display: "flex",
                        gap: 1,
                        mb: 2,
                        flexWrap: "wrap",
                    }}
                >
                    <TextField
                        size="small"
                        placeholder="Search name or email"
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />

                    <TextField
                        select
                        size="small"
                        label="Segment"
                        value={segment}
                        onChange={(event) =>
                            setSegment(event.target.value)
                        }
                        sx={{ minWidth: 145 }}
                    >
                        <MenuItem value="">
                            All segments
                        </MenuItem>

                        <MenuItem value="NEW_CUSTOMER">
                            New
                        </MenuItem>

                        <MenuItem value="REGULAR_CUSTOMER">
                            Regular
                        </MenuItem>

                        <MenuItem value="LOYAL_CUSTOMER">
                            Loyal
                        </MenuItem>

                        <MenuItem value="VIP_CUSTOMER">
                            VIP
                        </MenuItem>
                    </TextField>

                    <TextField
                        select
                        size="small"
                        label="Status"
                        value={status}
                        onChange={(event) =>
                            setStatus(event.target.value)
                        }
                        sx={{ minWidth: 130 }}
                    >
                        <MenuItem value="">
                            All statuses
                        </MenuItem>

                        <MenuItem value="ACTIVE">
                            Active
                        </MenuItem>

                        <MenuItem value="INACTIVE">
                            Inactive
                        </MenuItem>
                    </TextField>
                </Box>

                {/* List Error */}
                {list.isError && (
                    <Alert severity="error">
                        Customers could not be loaded.
                        Please refresh and try again.
                    </Alert>
                )}

                {/* Loading */}
                {list.isLoading ? (
                    <Box sx={{ py: 2 }}>
                        {[1, 2, 3, 4].map(
                            (row) => (
                                <Skeleton
                                    key={row}
                                    height={52}
                                />
                            )
                        )}
                    </Box>
                ) : (
                    <Table
                        size="small"
                        sx={{ minWidth: 940 }}
                    >
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    Customer Name
                                </TableCell>

                                <TableCell>
                                    Email
                                </TableCell>

                                <TableCell>
                                    Phone Number
                                </TableCell>

                                <TableCell>
                                    Customer Segment
                                </TableCell>

                                <TableCell>
                                    Total Purchases
                                </TableCell>

                                <TableCell>
                                    Total Spend
                                </TableCell>

                                <TableCell>
                                    Status
                                </TableCell>

                                <TableCell>
                                    Actions
                                </TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {list.data?.map(
                                (customer) => (
                                    <TableRow
                                        key={customer.id}
                                        hover
                                    >
                                        <TableCell>
                                            <Typography fontWeight={600}>
                                                {
                                                    customer.full_name
                                                }
                                            </Typography>
                                        </TableCell>

                                        <TableCell>
                                            {customer.email}
                                        </TableCell>

                                        <TableCell>
                                            {customer.phone}
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                size="small"
                                                color={segmentColor(
                                                    customer.segment
                                                )}
                                                label={segmentLabel(
                                                    customer.segment
                                                )}
                                            />
                                        </TableCell>

                                        <TableCell>
                                            {
                                                customer.total_orders
                                            }
                                        </TableCell>

                                        <TableCell>
                                            {money(
                                                customer.total_revenue
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                size="small"
                                                color={
                                                    customer.status ===
                                                        "ACTIVE"
                                                        ? "success"
                                                        : "default"
                                                }
                                                label={
                                                    customer.status ===
                                                        "ACTIVE"
                                                        ? "Active"
                                                        : "Inactive"
                                                }
                                            />
                                        </TableCell>

                                        <TableCell
                                            sx={{
                                                whiteSpace:
                                                    "nowrap",
                                            }}
                                        >
                                            {/* View */}
                                            <IconButton
                                                aria-label="View customer details"
                                                onClick={() =>
                                                    setDetailId(
                                                        customer.id
                                                    )
                                                }
                                            >
                                                <VisibilityIcon />
                                            </IconButton>

                                            {/* Edit */}
                                            <IconButton
                                                aria-label="Edit customer"
                                                onClick={() =>
                                                    openForm(
                                                        customer
                                                    )
                                                }
                                            >
                                                <EditIcon />
                                            </IconButton>

                                            {/* Deactivate */}
                                            <IconButton
                                                aria-label="Deactivate customer"
                                                color="error"
                                                disabled={
                                                    remove.isPending
                                                }
                                                onClick={() => {
                                                    const confirmed =
                                                        window.confirm(
                                                            `Deactivate ${customer.full_name}?`
                                                        );

                                                    if (
                                                        confirmed
                                                    ) {
                                                        remove.mutate(
                                                            customer.id
                                                        );
                                                    }
                                                }}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                )
                            )}
                        </TableBody>
                    </Table>
                )}

                {/* Empty State */}
                {noRows && (
                    <Box
                        sx={{
                            py: 7,
                            textAlign: "center",
                        }}
                    >
                        <Typography fontWeight={600}>
                            No customers found
                        </Typography>

                        <Typography color="text.secondary">
                            Add a customer or adjust
                            your search and filters.
                        </Typography>
                    </Box>
                )}
            </Paper>

            {/* Add / Edit Customer Dialog */}


            <Dialog
                open={formOpen}
                onClose={closeForm}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>
                    {editing
                        ? "Edit Customer"
                        : "Add Customer"}
                </DialogTitle>

                <DialogContent>
                    {apiError && (
                        <Alert
                            severity="error"
                            sx={{ mt: 1 }}
                        >
                            {apiError}
                        </Alert>
                    )}

                    <CustomerForm
                        value={form}
                        errors={formErrors}
                        onChange={(key, next) =>
                            setForm(
                                (current) =>
                                    ({
                                        ...current,
                                        [key]: next,
                                    }) as CustomerInput
                            )
                        }
                    />
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={closeForm}
                        disabled={save.isPending}
                    >
                        Cancel
                    </Button>

                    <Button
                        variant="contained"
                        onClick={submit}
                        disabled={save.isPending}
                    >
                        {save.isPending
                            ? "Saving..."
                            : editing
                                ? "Save Changes"
                                : "Create Customer"}
                    </Button>
                </DialogActions>
            </Dialog>


            {/* Customer Details Dialog     */}


            <Dialog
                open={detailId !== null}
                onClose={() => setDetailId(null)}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>
                    {detail.isLoading
                        ? "Loading customer..."
                        : detail.data?.full_name ||
                        "Customer Details"}
                </DialogTitle>

                <DialogContent>
                    {/* Details Loading */}
                    {detail.isLoading && (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent:
                                    "center",
                                py: 4,
                            }}
                        >
                            <CircularProgress />
                        </Box>
                    )}

                    {/* Details Error */}
                    {detail.isError && (
                        <Alert severity="error">
                            Customer details could
                            not be loaded.
                        </Alert>
                    )}

                    {/* Details */}
                    {!detail.isLoading &&
                        !detail.isError &&
                        detail.data && (
                            <>
                                <Grid
                                    container
                                    spacing={2}
                                    sx={{ mb: 3 }}
                                >
                                    {/* Customer Information */}
                                    <Grid
                                        size={{
                                            xs: 12,
                                            sm: 6,
                                        }}
                                    >
                                        <Typography variant="overline">
                                            Customer
                                            Information
                                        </Typography>

                                        <Typography>
                                            {
                                                detail.data
                                                    .full_name
                                            }
                                        </Typography>

                                        <Chip
                                            size="small"
                                            color={segmentColor(
                                                detail
                                                    .data
                                                    .segment
                                            )}
                                            label={segmentLabel(
                                                detail
                                                    .data
                                                    .segment
                                            )}
                                            sx={{ mt: 1 }}
                                        />
                                    </Grid>

                                    {/* Contact Details */}
                                    <Grid
                                        size={{
                                            xs: 12,
                                            sm: 6,
                                        }}
                                    >
                                        <Typography variant="overline">
                                            Contact Details
                                        </Typography>

                                        <Typography>
                                            {
                                                detail.data
                                                    .email
                                            }
                                        </Typography>

                                        <Typography>
                                            {
                                                detail.data
                                                    .phone
                                            }
                                        </Typography>

                                        <Typography color="text.secondary">
                                            {[
                                                detail.data
                                                    .address,
                                                detail.data
                                                    .city,
                                                detail.data
                                                    .state,
                                                detail.data
                                                    .country,
                                                detail.data
                                                    .postal_code,
                                            ]
                                                .filter(
                                                    Boolean
                                                )
                                                .join(
                                                    ", "
                                                ) ||
                                                "No address supplied"}
                                        </Typography>
                                    </Grid>

                                    {/* Total Orders */}
                                    <Grid
                                        size={{
                                            xs: 6,
                                            sm: 3,
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            Total Orders
                                        </Typography>

                                        <Typography fontWeight={700}>
                                            {
                                                detail.data
                                                    .total_orders
                                            }
                                        </Typography>
                                    </Grid>

                                    {/* Total Spend */}
                                    <Grid
                                        size={{
                                            xs: 6,
                                            sm: 3,
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            Total Spend
                                        </Typography>

                                        <Typography fontWeight={700}>
                                            {money(
                                                detail
                                                    .data
                                                    .total_revenue
                                            )}
                                        </Typography>
                                    </Grid>

                                    {/* Last Purchase */}
                                    <Grid
                                        size={{
                                            xs: 12,
                                            sm: 6,
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            Last Purchase
                                            Date
                                        </Typography>

                                        <Typography fontWeight={700}>
                                            {detail.data
                                                .last_purchase_date
                                                ? new Date(
                                                    detail
                                                        .data
                                                        .last_purchase_date
                                                ).toLocaleDateString()
                                                : "No purchases yet"}
                                        </Typography>
                                    </Grid>
                                </Grid>

                                {/* Purchase History */}
                                <Typography
                                    variant="h6"
                                    sx={{ mb: 1 }}
                                >
                                    Recent Purchase
                                    History
                                </Typography>

                                {purchaseHistory.length >
                                    0 ? (
                                    purchaseHistory.map(
                                        (sale) => (
                                            <Box
                                                key={
                                                    sale.id
                                                }
                                                sx={{
                                                    display:
                                                        "flex",
                                                    justifyContent:
                                                        "space-between",
                                                    alignItems:
                                                        "center",
                                                    gap: 2,
                                                    borderTop: 1,
                                                    borderColor:
                                                        "divider",
                                                    py: 1,
                                                }}
                                            >
                                                <Box>
                                                    <Typography fontWeight={600}>
                                                        {
                                                            sale.invoice_number
                                                        }
                                                    </Typography>

                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        {new Date(
                                                            sale.date
                                                        ).toLocaleDateString()}{" "}
                                                        -{" "}
                                                        {
                                                            sale.payment_method
                                                        }
                                                    </Typography>
                                                </Box>

                                                <Typography fontWeight={600}>
                                                    {money(
                                                        sale.amount
                                                    )}
                                                </Typography>
                                            </Box>
                                        )
                                    )
                                ) : (
                                    <Typography color="text.secondary">
                                        No purchase
                                        history available.
                                    </Typography>
                                )}
                            </>
                        )}
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() =>
                            setDetailId(null)
                        }
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

/* Customers Page */


export default function CustomersPage() {
    return (
        <RoleGuard
            allowedRoles={[
                "COMPANY_ADMIN",
                "ANALYST",
            ]}
        >
            <Customers />
        </RoleGuard>
    );
}