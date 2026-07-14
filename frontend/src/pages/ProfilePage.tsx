import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { isAxiosError } from "axios";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/auth";
import type { ChangePasswordRequest } from "../types/auth";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordRequest>({
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_new_password: "",
    },
  });

  const newPassword = watch("new_password");

  if (!user) return null;

  const onSubmit = async (values: ChangePasswordRequest) => {
    setServerError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    try {
      await authApi.changePassword(values);
      setSuccessMessage("Password changed successfully.");
      reset();
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.detail) {
        setServerError(String(err.response.data.detail));
      } else {
        setServerError("Could not change password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        My Profile
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: "primary.main",
                fontSize: 28,
                mx: "auto",
                mb: 2,
              }}
            >
              {initials}
            </Avatar>
            <Typography variant="h6">{user.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {user.email}
            </Typography>
            <Chip label={user.role.replace("_", " ")} color="primary" size="small" sx={{ mr: 1 }} />
            <Chip
              label={user.status}
              color={user.status === "ACTIVE" ? "success" : "default"}
              size="small"
            />

            <Divider sx={{ my: 2.5 }} />

            <Box sx={{ textAlign: "left" }}>
              <Typography variant="caption" color="text.secondary">
                COMPANY
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                {user.company.name} ({user.company.industry})
              </Typography>

              <Typography variant="caption" color="text.secondary">
                LAST LOGIN
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                {formatDate(user.last_login)}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                MEMBER SINCE
              </Typography>
              <Typography variant="body2">{formatDate(user.created_at)}</Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Change Password
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
              <TextField
                fullWidth
                margin="normal"
                type="password"
                label="Current Password"
                {...register("current_password", {
                  required: "Current password is required",
                })}
                error={!!errors.current_password}
                helperText={errors.current_password?.message}
              />
              <TextField
                fullWidth
                margin="normal"
                type="password"
                label="New Password"
                {...register("new_password", {
                  required: "New password is required",
                  minLength: { value: 8, message: "Minimum 8 characters" },
                })}
                error={!!errors.new_password}
                helperText={errors.new_password?.message}
              />
              <TextField
                fullWidth
                margin="normal"
                type="password"
                label="Confirm New Password"
                {...register("confirm_new_password", {
                  required: "Please confirm your new password",
                  validate: (value) =>
                    value === newPassword || "Passwords do not match",
                })}
                error={!!errors.confirm_new_password}
                helperText={errors.confirm_new_password?.message}
              />

              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                sx={{ mt: 2 }}
              >
                {submitting ? "Updating..." : "Update Password"}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
