import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Divider,
    Grid,
    Link,
    MenuItem,
    Paper,
    TextField,
    Typography,
} from "@mui/material";
import StoreIcon from "@mui/icons-material/Store";
import { authApi } from "../api/auth";
import type { CompanyRegisterRequest } from "../types/auth";
import { isAxiosError } from "axios";

const INDUSTRIES = [
    "Retail",
    "E-commerce",
    "Fashion & Apparel",
    "Grocery & FMCG",
    "Electronics",
    "Food & Beverage",
    "Other",
];

interface FormValues extends CompanyRegisterRequest { }

export default function RegisterPage() {
    const navigate = useNavigate();
    const [serverError, setServerError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<FormValues>({
        defaultValues: {
            company_name: "",
            industry: "",
            company_email: "",
            company_address: "",
            company_phone: "",
            owner_name: "",
            owner_email: "",
            password: "",
            confirm_password: "",
        },
    });

    const password = watch("password");

    const onSubmit = async (values: FormValues) => {
        setServerError(null);
        setSubmitting(true);
        try {
            await authApi.register(values);
            setSuccessMessage(
                "Company registered successfully! Redirecting you to login..."
            );
            setTimeout(() => navigate("/login"), 1500);
        } catch (err) {
            if (isAxiosError(err) && err.response?.data?.detail) {
                setServerError(String(err.response.data.detail));
            } else {
                setServerError("Registration failed. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "background.default",
                py: 6,
                px: 2,
            }}
        >
            <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, maxWidth: 720, width: "100%", border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                    <StoreIcon color="primary" fontSize="large" />
                    <Typography variant="h4">RetailPulse Analytics</Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Register your company and create the first admin account.
                </Typography>

                {serverError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {serverError}
                    </Alert>
                )}
                {successMessage && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        {successMessage}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 700 }}>
                        COMPANY DETAILS
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Company Name"
                                {...register("company_name", {
                                    required: "Company name is required",
                                    minLength: { value: 2, message: "Too short" },
                                })}
                                error={!!errors.company_name}
                                helperText={errors.company_name?.message}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                select
                                label="Industry"
                                defaultValue=""
                                {...register("industry", { required: "Select an industry" })}
                                error={!!errors.industry}
                                helperText={errors.industry?.message}
                            >
                                {INDUSTRIES.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="email"
                                label="Company Email"
                                {...register("company_email", {
                                    required: "Company email is required",
                                    pattern: {
                                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                        message: "Enter a valid email",
                                    },
                                })}
                                error={!!errors.company_email}
                                helperText={errors.company_email?.message}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Company Phone Number"
                                {...register("company_phone", {
                                    required: "Phone number is required",
                                })}
                                error={!!errors.company_phone}
                                helperText={errors.company_phone?.message}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Company Address"
                                {...register("company_address", {
                                    required: "Address is required",
                                })}
                                error={!!errors.company_address}
                                helperText={errors.company_address?.message}
                            />
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 700 }}>
                        ADMIN ACCOUNT
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Owner Name"
                                {...register("owner_name", { required: "Owner name is required" })}
                                error={!!errors.owner_name}
                                helperText={errors.owner_name?.message}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="email"
                                label="Owner Email"
                                {...register("owner_email", {
                                    required: "Owner email is required",
                                    pattern: {
                                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                        message: "Enter a valid email",
                                    },
                                })}
                                error={!!errors.owner_email}
                                helperText={errors.owner_email?.message}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="password"
                                label="Password"
                                {...register("password", {
                                    required: "Password is required",
                                    minLength: { value: 8, message: "Minimum 8 characters" },
                                })}
                                error={!!errors.password}
                                helperText={errors.password?.message}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="password"
                                label="Confirm Password"
                                {...register("confirm_password", {
                                    required: "Please confirm your password",
                                    validate: (value) =>
                                        value === password || "Passwords do not match",
                                })}
                                error={!!errors.confirm_password}
                                helperText={errors.confirm_password?.message}
                            />
                        </Grid>
                    </Grid>

                    <Button
                        type="submit"
                        fullWidth
                        size="large"
                        variant="contained"
                        disabled={submitting}
                        sx={{ mt: 4, py: 1.3 }}
                    >
                        {submitting ? "Creating your workspace..." : "Register Company"}
                    </Button>

                    <Typography variant="body2" align="center" sx={{ mt: 3 }}>
                        Already have an account?{" "}
                        <Link component={RouterLink} to="/login">
                            Sign in
                        </Link>
                    </Typography>
                </Box>
            </Paper>
        </Box>
    );
}
