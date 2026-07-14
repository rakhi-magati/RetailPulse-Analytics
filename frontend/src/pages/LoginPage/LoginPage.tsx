import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from "@mui/material";

import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import ShowChartIcon from "@mui/icons-material/ShowChart";

import { isAxiosError } from "axios";
import { useAuth } from "../../context/AuthContext";
import type { LoginRequest } from "../../types/auth";
import "./LoginPage.css";
export default function LoginPage() {
  const { login } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginRequest) => {
    setServerError(null);
    setSubmitting(true);

    try {
      await login(values);

      const redirectTo =
        (location.state as { from?: Location })?.from?.pathname ??
        "/dashboard";

      navigate(redirectTo, {
        replace: true,
      });
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.detail) {
        setServerError(String(err.response.data.detail));
      } else {
        setServerError(
          "Login failed. Please check your credentials."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box className="login-page">
      <Box className="login-container">

        {/* ================= LEFT PANEL ================= */}

        <Box className="login-left">

          <Box className="login-logo">

            <Box className="login-logo-icon">
              R
            </Box>

            <Box>
              <Typography className="login-logo-title">
                RetailPulse
              </Typography>

              <Typography className="login-logo-subtitle">
                Analytics
              </Typography>
            </Box>

          </Box>

          <Box className="login-illustration">

            <Box className="login-circle" />

            <ShoppingBagIcon className="login-main-icon" />

            <Box className="login-floating-top">
              <ShowChartIcon />
            </Box>

            <Box className="login-floating-bottom">
              <StorefrontIcon />
            </Box>

          </Box>

          <Box>

            <Typography className="login-heading">
              Make smarter retail decisions
            </Typography>

            <Typography className="login-description">
              with real-time analytics
            </Typography>

          </Box>

        </Box>

        {/* ================= RIGHT PANEL ================= */}

        <Box className="login-right">

          <Typography className="login-title">
            Welcome Back
          </Typography>

          <Typography className="login-subtitle">
            Sign in to your account
          </Typography>

          {serverError && (
            <Alert severity="error" className="login-alert">
              {serverError}
            </Alert>
          )}

          <Box
            component="form"
            className="login-form"
            noValidate
            onSubmit={handleSubmit(onSubmit)}
          >

            <Typography className="login-label">
              Email
            </Typography>

            <TextField
              fullWidth
              autoFocus
              type="email"
              placeholder="you@company.com"
              className="login-field"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value:
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email",
                },
              })}
              error={!!errors.email}
              helperText={errors.email?.message}
            />            <Box className="password-header">

              <Typography className="login-label">
                Password
              </Typography>

              <Link
                component={RouterLink}
                to="/login"
                className="forgot-link"
              >
                Forgot Password?
              </Link>

            </Box>

            <TextField
              fullWidth
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="login-field"
              {...register("password", {
                required: "Password is required",
              })}
              error={!!errors.password}
              helperText={errors.password?.message}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() =>
                          setShowPassword((prev) => !prev)
                        }
                      >
                        {showPassword ? (
                          <VisibilityOff fontSize="small" />
                        ) : (
                          <Visibility fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <FormControlLabel
              className="login-checkbox"
              control={
                <Checkbox
                  defaultChecked
                  size="small"
                />
              }
              label={
                <Typography variant="body2">
                  Remember me
                </Typography>
              }
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
              className="login-button"
            >
              {submitting
                ? "Signing in..."
                : "Sign In"}
            </Button>

            <Typography className="login-footer">
              Don't have an account?{" "}
              <Link
                component={RouterLink}
                to="/register"
              >
                Register
              </Link>
            </Typography>

          </Box>

        </Box>

      </Box>

    </Box>
  );
}