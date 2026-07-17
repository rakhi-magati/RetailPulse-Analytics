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
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
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
import { categoriesApi } from "../api/catalog";
import RoleGuard from "../components/RoleGuard";
// import type { Category, CategoryCreateRequest } from "../types/catalog";
import type { Category, CategoryCreateRequest } from "../types/catalog";

interface CategoryFormValues {
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
}

const emptyValues: CategoryFormValues = {
  name: "",
  description: "",
  status: "ACTIVE",
};

function CategoriesPageContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading, isError, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["categories", search],
    queryFn: () => categoriesApi.list(search || undefined),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({ defaultValues: emptyValues });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories"] });

  const createMutation = useMutation({
    mutationFn: (payload: CategoryCreateRequest) => categoriesApi.create(payload),
    onSuccess: () => {
      invalidate();
      closeDialog();
    },
    onError: (err: any) =>
      setErrorMessage(err?.response?.data?.detail ?? "Failed to save category"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CategoryCreateRequest }) =>
      categoriesApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      closeDialog();
    },
    onError: (err: any) =>
      setErrorMessage(err?.response?.data?.detail ?? "Failed to save category"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.detail ?? "Failed to delete category");
      setDeleteTarget(null);
    },
  });

  const openCreateDialog = () => {
    setEditing(null);
    reset(emptyValues);
    setErrorMessage(null);
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditing(category);
    reset({
      name: category.name,
      description: category.description ?? "",
      status: category.status,
    });
    setErrorMessage(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const onSubmit = (values: CategoryFormValues) => {
    setErrorMessage(null);
    const payload: CategoryCreateRequest = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      status: values.status,
    };
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
              Categories
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
            Organize your product catalog into categories.
            {dataUpdatedAt ? ` Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}.` : ""}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Category
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search categories by name..."
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
      </Paper>

      <Paper variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Products</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton height={32} />
                    </TableCell>
                  </TableRow>
                ))}

              {isError && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Alert severity="error">Couldn't load categories.</Alert>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                      No categories found. Create your first category to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {rows.map((category) => (
                <TableRow key={category.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{category.name}</TableCell>
                  <TableCell sx={{ color: "text.secondary", maxWidth: 320 }}>
                    {category.description || "—"}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={category.status}
                      color={category.status === "ACTIVE" ? "success" : "default"}
                      variant={category.status === "ACTIVE" ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell align="center">{category.product_count}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(category)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(category)}
                      >
                        {/* <DeleteIcon fontSize="small" /> */}
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
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
            <TextField
            style={{ marginTop: 16 }}
              label="Category Name"
              autoFocus
              fullWidth
              {...register("name", { required: "Category name is mandatory" })}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={2}
              {...register("description")}
            />
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value === "ACTIVE"}
                      onChange={(e) =>
                        field.onChange(e.target.checked ? "ACTIVE" : "INACTIVE")
                      }
                    />
                  }
                  label={field.value === "ACTIVE" ? "Active" : "Inactive"}
                />
              )}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSaving}>
              {editing ? "Save Changes" : "Create Category"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Category</DialogTitle>
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

export default function CategoriesPage() {
  return (
    <RoleGuard allowedRoles={["COMPANY_ADMIN"]}>
      <CategoriesPageContent />
    </RoleGuard>
  );
}
