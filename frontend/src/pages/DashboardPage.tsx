import type { ReactNode } from "react";
import {
    Alert,
    Avatar,
    Box,
    Card,
    CardContent,
    Chip,
    Grid,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { usersApi } from "../api/auth";
import RoleGuard from "../components/RoleGuard";

const salesOverviewData = [
    { date: "01 May", revenue: 42000, orders: 21000 },
    { date: "05 May", revenue: 58000, orders: 26000 },
    { date: "10 May", revenue: 49000, orders: 24000 },
    { date: "15 May", revenue: 72000, orders: 32000 },
    { date: "20 May", revenue: 61000, orders: 29000 },
    { date: "25 May", revenue: 84000, orders: 35000 },
    { date: "31 May", revenue: 90000, orders: 38000 },
];

const categoryData = [
    { name: "Electronics", value: 35, color: "#4F46E5" },
    { name: "Fashion", value: 25, color: "#22C55E" },
    { name: "Home & Kitchen", value: 20, color: "#F59E0B" },
    { name: "Beauty", value: 10, color: "#3B82F6" },
    { name: "Others", value: 10, color: "#8B5CF6" },
];

const bestSellingProducts = [
    { name: "Sony WH-1000XM5", category: "Electronics", revenue: "$245,800", units: "1,245" },
    { name: "Apple AirPods Pro", category: "Electronics", revenue: "$198,500", units: "1,103" },
    { name: "Nike Air Max 270", category: "Fashion", revenue: "$154,300", units: "980" },
    { name: "Samsung Galaxy S23", category: "Electronics", revenue: "$142,600", units: "876" },
    { name: "Adidas Ultraboost 22", category: "Fashion", revenue: "$112,400", units: "765" },
];

const channelData = [
    { channel: "Online Store", value: 982000 },
    { channel: "Amazon", value: 642000 },
    { channel: "Retail Outlet", value: 512000 },
    { channel: "Flipkart", value: 314000 },
];

function formatCurrency(value: number) {
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
}

function StatCard({
    icon,
    label,
    value,
    change,
}: {
    icon: ReactNode;
    label: string;
    value: string | number;
    change?: string;
}) {
    return (
        <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5 }}>
                    <Box
                        sx={{
                            bgcolor: "primary.light",
                            color: "primary.main",
                            width: 42,
                            height: 42,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0.9,
                        }}
                    >
                        {icon}
                    </Box>
                    {change && (
                        <Chip
                            size="small"
                            icon={<ArrowUpwardIcon sx={{ fontSize: "12px !important" }} />}
                            label={change}
                            sx={{
                                bgcolor: "success.light",
                                color: "success.dark",
                                fontWeight: 600,
                                fontSize: 12,
                            }}
                        />
                    )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                    {label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {value}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                    vs last month
                </Typography>
            </CardContent>
        </Card>
    );
}

export default function DashboardPage() {
    const { user } = useAuth();

    const { data: companyUsers, isLoading, isError } = useQuery({
        queryKey: ["company-users"],
        queryFn: usersApi.listCompanyUsers,
        enabled: user?.role === "COMPANY_ADMIN" || user?.role === "SUPER_ADMIN",
    });

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700 }}>
                Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""} 👋
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Here's what's happening with {user?.company.name ?? "your business"} today.
            </Typography>

            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        icon={<AccountBalanceWalletOutlinedIcon />}
                        label="Total Revenue"
                        value="$2.45M"
                        change="+14.5%"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        icon={<ShoppingCartOutlinedIcon />}
                        label="Total Orders"
                        value="18,765"
                        change="+8.2%"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        icon={<GroupOutlinedIcon />}
                        label="Total Customers"
                        value="12,986"
                        change="+12.6%"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        icon={<TrendingUpIcon />}
                        label="Gross Profit"
                        value="$856K"
                        change="+10.3%"
                    />
                </Grid>
            </Grid>

            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 7 }}>
                    <Paper variant="outlined" sx={{ p: 3, height: "100%" }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                Sales Overview
                            </Typography>
                            <Select value="30" size="small" sx={{ minWidth: 130 }}>
                                <MenuItem value="30">Last 30 Days</MenuItem>
                                <MenuItem value="90">Last 90 Days</MenuItem>
                                <MenuItem value="365">Last Year</MenuItem>
                            </Select>
                        </Box>
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={salesOverviewData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F5" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis
                                    tickFormatter={formatCurrency}
                                    tick={{ fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                                <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#4F46E5"
                                    strokeWidth={2.5}
                                    dot={false}
                                    name="Revenue"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="orders"
                                    stroke="#A5B4FC"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Orders"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                    <Paper variant="outlined" sx={{ p: 3, height: "100%" }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Top Selling Categories
                        </Typography>
                        <Box sx={{ position: "relative", display: "flex", justifyContent: "center" }}>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={2}
                                    >
                                        {categoryData.map((entry) => (
                                            <Cell key={entry.name} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `${value}%`} />
                                </PieChart>
                            </ResponsiveContainer>
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    textAlign: "center",
                                }}
                            >
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                    2.45M
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Total
                                </Typography>
                            </Box>
                        </Box>
                        <List dense>
                            {categoryData.map((cat) => (
                                <ListItem key={cat.name} sx={{ px: 0, py: 0.5 }}>
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: cat.color,
                                            mr: 1.5,
                                        }}
                                    />
                                    <ListItemText primary={cat.name} sx={{ flexGrow: 1 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {cat.value}%
                                    </Typography>
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                </Grid>
            </Grid>

            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 7 }}>
                    <Paper variant="outlined" sx={{ p: 3, height: "100%" }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Best Selling Products
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Product</TableCell>
                                    <TableCell>Category</TableCell>
                                    <TableCell align="right">Revenue</TableCell>
                                    <TableCell align="right">Units Sold</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {bestSellingProducts.map((product) => (
                                    <TableRow key={product.name} hover>
                                        <TableCell>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                                                <Avatar
                                                    variant="rounded"
                                                    sx={{ width: 30, height: 30, bgcolor: "primary.light", color: "primary.main", fontSize: 13 }}
                                                >
                                                    {product.name[0]}
                                                </Avatar>
                                                {product.name}
                                            </Box>
                                        </TableCell>
                                        <TableCell>{product.category}</TableCell>
                                        <TableCell align="right">{product.revenue}</TableCell>
                                        <TableCell align="right">{product.units}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                    <Paper variant="outlined" sx={{ p: 3, height: "100%" }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                Sales by Channel
                            </Typography>
                            <Select value="30" size="small" sx={{ minWidth: 130 }}>
                                <MenuItem value="30">Last 30 Days</MenuItem>
                                <MenuItem value="90">Last 90 Days</MenuItem>
                            </Select>
                        </Box>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={channelData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F5" />
                                <XAxis dataKey="channel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                                <Bar dataKey="value" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
            </Grid>

            <RoleGuard
                allowedRoles={["COMPANY_ADMIN"]}
                fallback={
                    <Alert severity="info">
                        Ask your Company Admin for access to team management and reports.
                    </Alert>
                }
            >
                <Paper variant="outlined" sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                        Team Members — {user?.company.name}
                    </Typography>

                    {isLoading && (
                        <Box>
                            <Skeleton height={40} />
                            <Skeleton height={40} />
                            <Skeleton height={40} />
                        </Box>
                    )}

                    {isError && (
                        <Alert severity="error">Couldn't load team members.</Alert>
                    )}

                    {companyUsers && (
                        <List>
                            {companyUsers.map((member) => (
                                <ListItem
                                    key={member.id}
                                    divider
                                    secondaryAction={
                                        <Chip
                                            size="small"
                                            label={member.role.replace("_", " ")}
                                            color={member.role === "COMPANY_ADMIN" ? "primary" : "default"}
                                        />
                                    }
                                >
                                    <ListItemText
                                        primary={member.name}
                                        secondary={`${member.email} · ${member.status}`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Paper>
            </RoleGuard>
        </Box>
    );
}
