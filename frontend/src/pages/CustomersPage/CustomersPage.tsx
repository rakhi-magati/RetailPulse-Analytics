import './CustomersPage.css';
import { useState } from 'react';
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
    Grid,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/EditOutlined';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi, type Customer, type CustomerInput } from '../../api/customers';
import RoleGuard from '../../components/RoleGuard';

const blank: CustomerInput = {
    full_name: '',
    email: '',
    phone: '',
    customer_type: 'RETAIL',
    status: 'ACTIVE',
};

const money = (n: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0);

function Customers() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [type, setType] = useState('');
    const [status, setStatus] = useState('');
    const [editing, setEditing] = useState<Customer | null>(null);
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<number | null>(null);
    const [form, setForm] = useState<CustomerInput>(blank);
    const [error, setError] = useState('');

    const list = useQuery({
        queryKey: ['customers', search, type, status],
        queryFn: () =>
            customersApi.list({
                search: search || undefined,
                customer_type: type || undefined,
                status: status || undefined,
            }),
    });

    const dashboard = useQuery({
        queryKey: ['customer-analytics'],
        queryFn: customersApi.analytics,
    });

    const detail = useQuery({
        queryKey: ['customer', view],
        queryFn: () => customersApi.get(view!),
        enabled: view !== null,
    });

    const refresh = () => {
        qc.invalidateQueries({ queryKey: ['customers'] });
        qc.invalidateQueries({ queryKey: ['customer-analytics'] });
    };

    const save = useMutation({
        mutationFn: () => (editing ? customersApi.update(editing.id, form) : customersApi.create(form)),
        onSuccess: () => {
            setOpen(false);
            refresh();
        },
        onError: (e: any) => setError(e.response?.data?.detail || 'Unable to save customer'),
    });

    const show = (c?: Customer) => {
        setError('');
        setEditing(c || null);
        setForm(
            c
                ? {
                    full_name: c.full_name,
                    email: c.email,
                    phone: c.phone,
                    customer_type: c.customer_type,
                    status: c.status,
                    city: c.city,
                    state: c.state,
                    country: c.country,
                }
                : blank
        );
        setOpen(true);
    };

    const change = (k: keyof CustomerInput, v: string) => setForm({ ...form, [k]: v });

    const exportCsv = async () => {
        const b = await customersApi.exportCsv();
        const u = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = u;
        a.download = 'customers.csv';
        a.click();
        URL.revokeObjectURL(u);
    };

    const metrics = [
        ['Total Customers', dashboard.data?.total_customers],
        ['Active Customers', dashboard.data?.active_customers],
        ['New This Month', dashboard.data?.new_customers],
        ['Returning Customers', dashboard.data?.returning_customers],
        ['Average Spend', dashboard.data ? money(dashboard.data.average_customer_spend) : '—'],
        ['Customer Revenue', dashboard.data ? money(dashboard.data.total_revenue) : '—'],
    ];

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" fontWeight={700}>
                        Customers
                    </Typography>
                    <Typography color="text.secondary">
                        Manage customer profiles, purchase behavior and lifecycle value.
                    </Typography>
                </Box>
                <Box>
                    <Button startIcon={<DownloadIcon />} onClick={exportCsv}>
                        Export CSV
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => show()} sx={{ ml: 1 }}>
                        Add Customer
                    </Button>
                </Box>
            </Box>

            <Grid container spacing={2} sx={{ mb: 3 }}>
                {metrics.map(([l, v]) => (
                    <Grid key={String(l)} size={{ xs: 6, md: 2 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="caption" color="text.secondary">
                                    {l}
                                </Typography>
                                <Typography variant="h5" fontWeight={700}>
                                    {v ?? '—'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <TextField
                        size="small"
                        placeholder="Name, ID, email or phone"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
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
                    <Select size="small" displayEmpty value={type} onChange={(e) => setType(e.target.value)}>
                        <MenuItem value="">All types</MenuItem>
                        <MenuItem value="RETAIL">Retail</MenuItem>
                        <MenuItem value="WHOLESALE">Wholesale</MenuItem>
                        <MenuItem value="CORPORATE">Corporate</MenuItem>
                    </Select>
                    <Select size="small" displayEmpty value={status} onChange={(e) => setStatus(e.target.value)}>
                        <MenuItem value="">All statuses</MenuItem>
                        <MenuItem value="ACTIVE">Active</MenuItem>
                        <MenuItem value="INACTIVE">Inactive</MenuItem>
                    </Select>
                </Box>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Customer</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Orders</TableCell>
                            <TableCell>Total Spend</TableCell>
                            <TableCell>Segment</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {list.data?.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell>
                                    <Typography fontWeight={600}>{c.full_name}</Typography>
                                    <Typography variant="caption">
                                        {c.customer_id} · {c.email}
                                    </Typography>
                                </TableCell>
                                <TableCell>{c.customer_type}</TableCell>
                                <TableCell>
                                    <Chip size="small" color={c.status === 'ACTIVE' ? 'success' : 'default'} label={c.status} />
                                </TableCell>
                                <TableCell>{c.total_orders}</TableCell>
                                <TableCell>{money(c.total_revenue)}</TableCell>
                                <TableCell>
                                    <Chip size="small" label={c.segment.replace('_', ' ')} />
                                </TableCell>
                                <TableCell>
                                    <IconButton onClick={() => setView(c.id)}>
                                        <VisibilityIcon />
                                    </IconButton>
                                    <IconButton onClick={() => show(c)}>
                                        <EditIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {!list.isLoading && !list.data?.length && (
                    <Typography textAlign="center" color="text.secondary" sx={{ p: 4 }}>
                        No customers match these filters.
                    </Typography>
                )}
            </Paper>

            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{editing ? 'Edit customer' : 'Add customer'}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ pt: 1 }}>
                        {error && (
                            <Grid size={12}>
                                <Alert severity="error">{error}</Alert>
                            </Grid>
                        )}
                        {(
                            [
                                ['full_name', 'Full name'],
                                ['email', 'Email address'],
                                ['phone', 'Phone number'],
                                ['city', 'City'],
                                ['state', 'State'],
                                ['country', 'Country'],
                            ] as [keyof CustomerInput, string][]
                        ).map(([k, l]) => (
                            <Grid key={k} size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    fullWidth
                                    required={['full_name', 'email', 'phone'].includes(k)}
                                    label={l}
                                    value={form[k] || ''}
                                    onChange={(e) => change(k, e.target.value)}
                                />
                            </Grid>
                        ))}
                        <Grid size={6}>
                            <TextField
                                select
                                fullWidth
                                label="Customer type"
                                value={form.customer_type}
                                onChange={(e) => change('customer_type', e.target.value)}
                            >
                                {['RETAIL', 'WHOLESALE', 'CORPORATE'].map((x) => (
                                    <MenuItem key={x} value={x}>
                                        {x}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid size={6}>
                            <TextField
                                select
                                fullWidth
                                label="Status"
                                value={form.status}
                                onChange={(e) => change('status', e.target.value)}
                            >
                                {['ACTIVE', 'INACTIVE'].map((x) => (
                                    <MenuItem key={x} value={x}>
                                        {x}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>
                        {editing ? 'Save changes' : 'Create customer'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={view !== null} onClose={() => setView(null)} fullWidth maxWidth="sm">
                <DialogTitle>{detail.data?.full_name || 'Customer profile'}</DialogTitle>
                <DialogContent>
                    {detail.data && (
                        <>
                            <Typography color="text.secondary">
                                {detail.data.email} · {detail.data.phone}
                            </Typography>
                            <Grid container spacing={2} sx={{ my: 2 }}>
                                {[
                                    ['Lifetime revenue', money(detail.data.total_revenue)],
                                    ['Total orders', detail.data.total_orders],
                                    ['Average order', money(detail.data.average_order_value)],
                                    ['Segment', detail.data.segment.replace('_', ' ')],
                                ].map(([k, v]) => (
                                    <Grid key={String(k)} size={6}>
                                        <Typography variant="caption" color="text.secondary">
                                            {k}
                                        </Typography>
                                        <Typography fontWeight={700}>{v}</Typography>
                                    </Grid>
                                ))}
                            </Grid>
                            <Typography variant="h6">Recent transactions</Typography>
                            {detail.data.recent_transactions.map((t: any) => (
                                <Typography key={t.id} sx={{ py: 0.5 }}>
                                    {t.invoice_number} — {money(t.amount)}
                                </Typography>
                            ))}
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setView(null)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default function CustomersPage() {
    return (
        <RoleGuard allowedRoles={['COMPANY_ADMIN', 'ANALYST']}>
            <Customers />
        </RoleGuard>
    );
}
