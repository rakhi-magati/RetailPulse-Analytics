import "./RegisterPage.css";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import {
    Alert,
    Box,
    Button,
    Grid,
    IconButton,
    InputAdornment,
    Link,
    MenuItem,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
} from "@mui/material";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import { isAxiosError } from "axios";

import { authApi } from "../../api/auth";
import type { CompanyRegisterRequest } from "../../types/auth";

/* -------------------------------- Constants -------------------------------- */

const INDUSTRIES = [
    "Retail",
    "E-commerce",
    "Fashion & Apparel",
    "Grocery & FMCG",
    "Electronics",
    "Food & Beverage",
    "Other",
];

const STEPS = [
    "Business profile",
    "Admin account",
];

const COMPANY_FIELDS = [
    "company_name",
    "industry",
    "company_email",
    "company_phone",
    "company_address",
] as const;

/* -------------------------------- Component -------------------------------- */

export default function RegisterPage() {
    const navigate = useNavigate();

    /* ------------------------------- UI States ------------------------------ */

    const [activeStep, setActiveStep] = useState(0);

    const [serverError, setServerError] = useState<string | null>(null);

    const [successMessage, setSuccessMessage] =
        useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);

    const [showPassword, setShowPassword] = useState(false);

    const [showConfirmation, setShowConfirmation] = useState(false);

    /* ----------------------------- React Hook Form -------------------------- */

    const {
        register,
        handleSubmit,
        trigger,
        watch,
        formState: { errors },
    } = useForm<CompanyRegisterRequest>({
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

    /* ---------------------------- Step 1 Validation ------------------------- */

    const continueToAccount = async () => {
        setServerError(null);

        const isValid = await trigger(COMPANY_FIELDS);

        if (isValid) {
            setActiveStep(1);
        }
    };

    /* ----------------------------- Form Submission -------------------------- */

    const onSubmit = async (values: CompanyRegisterRequest) => {
        setServerError(null);
        setSubmitting(true);

        try {
            await authApi.register(values);

            setSuccessMessage(
                "Workspace created successfully. Taking you to sign in..."
            );

            window.setTimeout(() => {
                navigate("/login");
            }, 1500);
        } catch (err) {
            if (
                isAxiosError(err) &&
                err.response?.data?.detail
            ) {
                setServerError(
                    String(err.response.data.detail)
                );
            } else {
                setServerError(
                    "We couldn't create your workspace. Please try again."
                );
            }
        } finally {
            setSubmitting(false);
        }
    };

    /* -------------------------- Password Visibility ------------------------- */

    const passwordAdornment = (
        visible: boolean,
        toggle: () => void
    ) => ({
        endAdornment: (
            <InputAdornment position="end">
                <IconButton
                    aria-label={
                        visible
                            ? "Hide password"
                            : "Show password"
                    }
                    edge="end"
                    onClick={toggle}
                >
                    {visible ? (
                        <VisibilityOff fontSize="small" />
                    ) : (
                        <Visibility fontSize="small" />
                    )}
                </IconButton>
            </InputAdornment>
        ),
    });

    /* ---------------------------------- JSX ---------------------------------- */

    return (
        <Box className="register-page">
            <Box className="register-shell">

                {/* ========================== LEFT SIDE ========================== */}

                <Box className="register-aside">

                    {/* Brand */}

                    <Box className="register-brand">
                        <Box className="register-brand-mark">
                            R
                        </Box>

                        <Box>
                            <Typography className="register-brand-name">
                                RetailPulse
                            </Typography>

                            <Typography className="register-brand-subtitle">
                                ANALYTICS
                            </Typography>
                        </Box>
                    </Box>

                    {/* Illustration & Description */}

                    <Box className="register-aside-content">

                        <Box className="register-illustration">

                            <Box
                                className="register-orbit register-orbit-one"
                            />

                            <Box
                                className="register-orbit register-orbit-two"
                            />

                            <StorefrontRoundedIcon
                                className="register-store-icon"
                            />

                            <Box className="register-chart-card">

                                <InsightsRoundedIcon />

                                <Box>
                                    <Typography>
                                        Live insights
                                    </Typography>

                                    <Box className="register-chart-bars">
                                        <i />
                                        <i />
                                        <i />
                                        <i />
                                    </Box>
                                </Box>

                            </Box>
                        </Box>

                        <Typography className="register-aside-heading">
                            Build a sharper retail operation.
                        </Typography>

                        <Typography className="register-aside-copy">
                            Set up your workspace, invite your team,
                            and turn sales data into confident decisions.
                        </Typography>

                    </Box>

                    {/* Benefits */}

                    <Box className="register-benefits">

                        <Typography>
                            <CheckCircleRoundedIcon />
                            Get started in minutes
                        </Typography>

                        <Typography>
                            <CheckCircleRoundedIcon />
                            Your data stays protected
                        </Typography>

                    </Box>

                </Box>

                {/* ========================== RIGHT SIDE ========================= */}

                <Box className="register-main">

                    <Box className="register-form-wrap">

                        {/* Header */}

                        <Typography className="register-eyebrow">
                            CREATE YOUR WORKSPACE
                        </Typography>

                        <Typography className="register-title">
                            Let’s get your business set up
                        </Typography>

                        <Typography className="register-subtitle">
                            A couple of details now, then you’ll be ready
                            to explore your retail performance.
                        </Typography>

                        {/* Stepper */}

                        <Stepper
                            activeStep={activeStep}
                            className="register-stepper"
                        >
                            {STEPS.map((label) => (
                                <Step key={label}>
                                    <StepLabel>
                                        {label}
                                    </StepLabel>
                                </Step>
                            ))}
                        </Stepper>

                        {/* Error Message */}

                        {serverError && (
                            <Alert
                                severity="error"
                                className="register-alert"
                            >
                                {serverError}
                            </Alert>
                        )}

                        {/* Success Message */}

                        {successMessage && (
                            <Alert
                                severity="success"
                                className="register-alert"
                            >
                                {successMessage}
                            </Alert>
                        )}

                        {/* ======================== FORM ======================== */}

                        <Box
                            component="form"
                            noValidate
                            onSubmit={handleSubmit(onSubmit)}
                        >

                            {/* ================= STEP 1 ================= */}

                            {activeStep === 0 ? (
                                <>
                                    {/* Section Heading */}

                                    <Box className="register-section-heading">

                                        <Box className="register-section-icon">
                                            <BusinessRoundedIcon />
                                        </Box>

                                        <Box>
                                            <Typography>
                                                Tell us about your company
                                            </Typography>

                                            <Typography>
                                                These details help personalise
                                                your workspace.
                                            </Typography>
                                        </Box>

                                    </Box>

                                    {/* Company Fields */}

                                    <Grid
                                        container
                                        spacing={2.25}
                                    >

                                        {/* Company Name */}

                                        <Grid
                                            size={{
                                                xs: 12,
                                                sm: 7,
                                            }}
                                        >
                                            <TextField
                                                fullWidth
                                                autoFocus
                                                label="Company name"
                                                placeholder="e.g. Northstar Retail"
                                                {...register(
                                                    "company_name",
                                                    {
                                                        required:
                                                            "Company name is required",
                                                        minLength: {
                                                            value: 2,
                                                            message:
                                                                "Enter at least 2 characters",
                                                        },
                                                    }
                                                )}
                                                error={
                                                    !!errors.company_name
                                                }
                                                helperText={
                                                    errors.company_name?.message
                                                }
                                            />
                                        </Grid>

                                        {/* Industry */}

                                        <Grid
                                            size={{
                                                xs: 12,
                                                sm: 5,
                                            }}
                                        >
                                            <TextField
                                                fullWidth
                                                select
                                                label="Industry"
                                                {...register(
                                                    "industry",
                                                    {
                                                        required:
                                                            "Choose an industry",
                                                    }
                                                )}
                                                error={
                                                    !!errors.industry
                                                }
                                                helperText={
                                                    errors.industry?.message
                                                }
                                            >
                                                {INDUSTRIES.map(
                                                    (option) => (
                                                        <MenuItem
                                                            key={option}
                                                            value={option}
                                                        >
                                                            {option}
                                                        </MenuItem>
                                                    )
                                                )}
                                            </TextField>
                                        </Grid>

                                        {/* Company Email */}

                                        <Grid
                                            size={{
                                                xs: 12,
                                                sm: 6,
                                            }}
                                        >
                                            <TextField
                                                fullWidth
                                                type="email"
                                                label="Work email"
                                                placeholder="hello@company.com"
                                                {...register(
                                                    "company_email",
                                                    {
                                                        required:
                                                            "Company email is required",
                                                        pattern: {
                                                            value: /^\S+@\S+\.\S+$/,
                                                            message:
                                                                "Enter a valid email address",
                                                        },
                                                    }
                                                )}
                                                error={
                                                    !!errors.company_email
                                                }
                                                helperText={
                                                    errors.company_email?.message
                                                }
                                            />
                                        </Grid>

                                        {/* Phone */}

                                        <Grid
                                            size={{
                                                xs: 12,
                                                sm: 6,
                                            }}
                                        >
                                            <TextField
                                                fullWidth
                                                label="Phone number"
                                                placeholder="+91 98765 43210"
                                                {...register(
                                                    "company_phone",
                                                    {
                                                        required:
                                                            "Phone number is required",
                                                    }
                                                )}
                                                error={
                                                    !!errors.company_phone
                                                }
                                                helperText={
                                                    errors.company_phone?.message
                                                }
                                            />
                                        </Grid>

                                        {/* Address */}

                                        <Grid size={{ xs: 12 }}>
                                            <TextField
                                                fullWidth
                                                label="Business address"
                                                placeholder="Street, city, state"
                                                {...register(
                                                    "company_address",
                                                    {
                                                        required:
                                                            "Business address is required",
                                                    }
                                                )}
                                                error={
                                                    !!errors.company_address
                                                }
                                                helperText={
                                                    errors.company_address?.message
                                                }
                                            />
                                        </Grid>

                                    </Grid>

                                    {/* Continue Button */}

                                    <Button
                                        type="button"
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        endIcon={
                                            <ArrowForwardRoundedIcon />
                                        }
                                        onClick={continueToAccount}
                                        className="register-primary-button"
                                    >
                                        Continue to admin account
                                    </Button>
                                </>
                            ) : (

                                /* ================= STEP 2 ================= */

                                <>
                                    {/* Section Heading */}

                                    <Box className="register-section-heading">

                                        <Box className="register-section-icon">
                                            <LockRoundedIcon />
                                        </Box>

                                        <Box>
                                            <Typography>
                                                Create your admin account
                                            </Typography>

                                            <Typography>
                                                You’ll use this account to
                                                manage your company workspace.
                                            </Typography>
                                        </Box>

                                    </Box>

                                    {/* Admin Fields */}

                                    <Grid
                                        container
                                        spacing={2.25}
                                    >

                                        {/* Owner Name */}

                                        <Grid
                                            size={{
                                                xs: 12,
                                                sm: 6,
                                            }}
                                        >
                                            <TextField
                                                fullWidth
                                                autoFocus
                                                label="Your name"
                                                placeholder="e.g. Priya Sharma"
                                                {...register(
                                                    "owner_name",
                                                    {
                                                        required:
                                                            "Your name is required",
                                                    }
                                                )}
                                                error={
                                                    !!errors.owner_name
                                                }
                                                helperText={
                                                    errors.owner_name?.message
                                                }
                                            />
                                        </Grid>

                                        {/* Owner Email */}

                                        <Grid
                                            size={{
                                                xs: 12,
                                                sm: 6,
                                            }}
                                        >
                                            <TextField
                                                fullWidth
                                                type="email"
                                                label="Your work email"
                                                placeholder="priya@company.com"
                                                {...register(
                                                    "owner_email",
                                                    {
                                                        required:
                                                            "Owner email is required",
                                                        pattern: {
                                                            value: /^\S+@\S+\.\S+$/,
                                                            message:
                                                                "Enter a valid email address",
                                                        },
                                                    }
                                                )}
                                                error={
                                                    !!errors.owner_email
                                                }
                                                helperText={
                                                    errors.owner_email?.message
                                                }
                                            />
                                        </Grid>

                                        {/* Password */}

                                        <Grid
                                            size={{
                                                xs: 12,
                                                sm: 6,
                                            }}
                                        >
                                            <TextField
                                                fullWidth
                                                type={
                                                    showPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                label="Create password"
                                                placeholder="At least 8 characters"
                                                slotProps={{
                                                    input:
                                                        passwordAdornment(
                                                            showPassword,
                                                            () =>
                                                                setShowPassword(
                                                                    (value) =>
                                                                        !value
                                                                )
                                                        ),
                                                }}
                                                {...register(
                                                    "password",
                                                    {
                                                        required:
                                                            "Password is required",
                                                        minLength: {
                                                            value: 8,
                                                            message:
                                                                "Use at least 8 characters",
                                                        },
                                                    }
                                                )}
                                                error={
                                                    !!errors.password
                                                }
                                                helperText={
                                                    errors.password?.message ??
                                                    "Use 8 or more characters"
                                                }
                                            />
                                        </Grid>

                                        {/* Confirm Password */}

                                        <Grid
                                            size={{
                                                xs: 12,
                                                sm: 6,
                                            }}
                                        >
                                            <TextField
                                                fullWidth
                                                type={
                                                    showConfirmation
                                                        ? "text"
                                                        : "password"
                                                }
                                                label="Confirm password"
                                                placeholder="Repeat your password"
                                                slotProps={{
                                                    input:
                                                        passwordAdornment(
                                                            showConfirmation,
                                                            () =>
                                                                setShowConfirmation(
                                                                    (value) =>
                                                                        !value
                                                                )
                                                        ),
                                                }}
                                                {...register(
                                                    "confirm_password",
                                                    {
                                                        required:
                                                            "Please confirm your password",
                                                        validate: (
                                                            value
                                                        ) =>
                                                            value ===
                                                                password ||
                                                            "Passwords do not match",
                                                    }
                                                )}
                                                error={
                                                    !!errors.confirm_password
                                                }
                                                helperText={
                                                    errors.confirm_password
                                                        ?.message
                                                }
                                            />
                                        </Grid>

                                    </Grid>

                                    {/* Action Buttons */}

                                    <Box className="register-actions">

                                        <Button
                                            type="button"
                                            startIcon={
                                                <ArrowBackRoundedIcon />
                                            }
                                            onClick={() =>
                                                setActiveStep(0)
                                            }
                                            className="register-back-button"
                                        >
                                            Back
                                        </Button>

                                        <Button
                                            type="submit"
                                            variant="contained"
                                            size="large"
                                            disabled={submitting}
                                            className="register-create-button"
                                        >
                                            {submitting
                                                ? "Creating workspace..."
                                                : "Create workspace"}
                                        </Button>

                                    </Box>
                                </>
                            )}

                        </Box>

                        {/* Footer */}

                        <Typography className="register-footer">
                            Already have an account?{" "}
                            <Link
                                component={RouterLink} 
                                to="/login"
                            >
                                Sign in
                            </Link>
                        </Typography>

                    </Box>

                </Box>

            </Box>
        </Box>
    );
}