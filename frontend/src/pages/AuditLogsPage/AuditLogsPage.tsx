import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

import { auditLogsApi } from "../../api/auditLogs";
import { apiClient } from "../../api/client";

import type {
  AuditLog,
  AuditLogFilters,
} from "../../types/auditLog";

import type { UserProfile } from "../../types/auth";

import RoleGuard from "../../components/RoleGuard";

import "./AuditLogsPage.css";


// =================
// Initial Filters
// =================

const initialFilters: AuditLogFilters = {
  page: 1,
  limit: 25,
  sort: "newest",
};


// =================
// Helper Functions
// =================

// Convert underscore values into readable text
const labelize = (value: string) => {
  return value.replaceAll("_", " ");
};


// Format date and time
const formatDate = (value: string) => {
  return new Date(value).toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
};


// Download Blob as a file
const download = (
  blob: Blob,
  name: string
) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Keep the object URL alive long enough for the browser to begin the
  // download. Revoking it immediately can cancel PDF downloads in Chromium.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};


// =================
// Audit Logs Page
// =================

export default function AuditLogsPage() {

  // -------------------
  // State
  // -------------------

  const [filters, setFilters] =
    useState<AuditLogFilters>(
      initialFilters
    );

  const [selected, setSelected] =
    useState<AuditLog | null>(null);


  // -------------------  
  // Fetch Audit Logs
  // -------------------

  const query = useQuery({
    queryKey: [
      "audit-logs",
      filters,
    ],

    queryFn: () =>
      auditLogsApi.list(filters),

    refetchInterval: 15000,
  });


  // -------------------
  // Fetch Company Users
  // -------------------

  const users = useQuery({
    queryKey: [
      "company-users",
    ],

    queryFn: () =>
      apiClient
        .get<UserProfile[]>("/users")
        .then(
          (response) =>
            response.data
        ),
  });


  // -------------------
  // Fetch Selected Audit Log Details
  // -------------------

  const detail = useQuery({
    queryKey: [
      "audit-log",
      selected?.id,
    ],

    queryFn: () =>
      auditLogsApi.get(
        selected!.id
      ),

    enabled: !!selected,
  });


  // -------------------  
  // Update Filters
  // ------------------

  const update = <
    K extends keyof AuditLogFilters
  >(
    key: K,
    value:
      | AuditLogFilters[K]
      | undefined
  ) => {

    setFilters(
      (current) => ({
        ...current,

        [key]:
          value || undefined,

        page: 1,
      })
    );
  };


  // -------------------
  // Export Filters
  // -------------------

  const exportFilters = useMemo(
    () => {

      const {
        page,
        limit,
        sort,
        ...rest
      } = filters;

      return rest;
    },
    [filters]
  );


  // -------------------
  // Export Audit Logs
  // -------------------

  const handleExport = async (
    format: "csv" | "pdf"
  ) => {

    const blob =
      await auditLogsApi.export(
        format,
        exportFilters
      );

    download(
      blob,
      `retailpulse-audit-logs.${format}`
    );
  };


  // ------------+
  // Detail Rows
  // -------------

  const detailRows = (
    values:
      | Record<string, unknown>
      | null
      | undefined
  ) => {

    // No values available
    if (
      !values ||
      Object.keys(values).length === 0
    ) {
      return (
        <Typography color="text.secondary">
          No captured values.
        </Typography>
      );
    }


    // Display values
    return (
      <Box className="audit-value-list">

        {Object.entries(values).map(
          ([key, value]) => (

            <Box key={key}>

              <span>
                {labelize(key)}
              </span>

              <strong>
                {String(
                  value ?? "—"
                )}
              </strong>

            </Box>
          )
        )}

      </Box>
    );
  };


  // ======
  // JSX
  // =======
  return (
    <RoleGuard
      allowedRoles={[
        "COMPANY_ADMIN",
      ]}
    >

      <Box className="audit-page">

        {/* ================== */}
        {/* Hero Section */}
        {/* ================== */}

        <Box className="audit-hero">

          <Box>

            <Typography className="audit-eyebrow">
              ADMINISTRATION
            </Typography>

            <Typography variant="h4">
              Audit logs &amp; activity
            </Typography>

            <Typography>
              Monitor sensitive activity
              across your company workspace.
            </Typography>

          </Box>


          {/* Live Update Indicator */}

          <Box className="audit-live">

            <HistoryRoundedIcon />

            Updates automatically every
            15 seconds

          </Box>

        </Box>


        {/* =================== */}
        {/* Filters Card */}
        {/* =================== */}

        <Paper
          className="
            audit-card
            audit-filters
          "
        >

          {/* Filter Header */}

          <Box className="audit-filter-heading">

            <Typography variant="h6">
              Find activity
            </Typography>


            {/* Export Buttons */}

            <Stack
              direction="row"
              gap={1}
            >

              {/* CSV Export */}

              <Button
                startIcon={
                  <DownloadRoundedIcon />
                }
                onClick={() =>
                  handleExport("csv")
                }
                disabled={
                  !query.data?.total
                }
              >
                CSV
              </Button>


              {/* PDF Export */}

              <Button
                variant="outlined"
                startIcon={
                  <DownloadRoundedIcon />
                }
                onClick={() =>
                  handleExport("pdf")
                }
                disabled={
                  !query.data?.total
                }
              >
                PDF
              </Button>

            </Stack>

          </Box>


          {/* Filter Grid */}

          <Box className="audit-filter-grid">

            {/* Search */}

            <TextField
              size="small"
              label="Search activity"
              placeholder="
                User, action, resource,
                description...
              "
              value={
                filters.search ?? ""
              }
              onChange={(event) =>
                update(
                  "search",
                  event.target.value
                )
              }
            />


            {/* User Filter */}

            <FormControl size="small">

              <InputLabel>
                User
              </InputLabel>

              <Select
                label="User"
                value={
                  filters.user_id ?? ""
                }
                onChange={(event) =>
                  update(
                    "user_id",
                    event.target.value
                      ? Number(
                          event.target.value
                        )
                      : undefined
                  )
                }
              >

                <MenuItem value="">
                  All users
                </MenuItem>

                {users.data?.map(
                  (user) => (
                    <MenuItem
                      value={user.id}
                      key={user.id}
                    >
                      {user.name}
                    </MenuItem>
                  )
                )}

              </Select>

            </FormControl>


            {/* Action Filter */}

            <TextField
              size="small"
              label="Action"
              placeholder="
                e.g. PRODUCT_UPDATED
              "
              value={
                filters.action ?? ""
              }
              onChange={(event) =>
                update(
                  "action",
                  event.target.value.toUpperCase()
                )
              }
            />


            {/* Resource Filter */}

            <FormControl size="small">

              <InputLabel>
                Resource
              </InputLabel>

              <Select
                label="Resource"
                value={
                  filters.resource_type ?? ""
                }
                onChange={(event) =>
                  update(
                    "resource_type",
                    event.target.value ||
                      undefined
                  )
                }
              >

                <MenuItem value="">
                  All resources
                </MenuItem>

                {[
                  "Product",
                  "Inventory",
                  "Sale",
                  "Customer",
                  "Authentication",
                ].map((value) => (

                  <MenuItem
                    value={value}
                    key={value}
                  >
                    {value}
                  </MenuItem>

                ))}

              </Select>

            </FormControl>


            {/* Status Filter */}

            <FormControl size="small">

              <InputLabel>
                Status
              </InputLabel>

              <Select
                label="Status"
                value={
                  filters.status ?? ""
                }
                onChange={(event) =>
                  update(
                    "status",
                    event.target.value ||
                      undefined
                  )
                }
              >

                <MenuItem value="">
                  All statuses
                </MenuItem>

                <MenuItem value="SUCCESS">
                  Success
                </MenuItem>

                <MenuItem value="FAILED">
                  Failed
                </MenuItem>

              </Select>

            </FormControl>


            {/* Start Date */}

            <TextField
              size="small"
              label="From"
              type="date"
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
              value={
                filters.start_date ?? ""
              }
              onChange={(event) =>
                update(
                  "start_date",
                  event.target.value
                    ? `${event.target.value}T00:00:00`
                    : undefined
                )
              }
            />


            {/* End Date */}

            <TextField
              size="small"
              label="To"
              type="date"
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
              value={
                filters.end_date ?? ""
              }
              onChange={(event) =>
                update(
                  "end_date",
                  event.target.value
                    ? `${event.target.value}T23:59:59`
                    : undefined
                )
              }
            />


            {/* Sort */}

            <FormControl size="small">

              <InputLabel>
                Sort
              </InputLabel>

              <Select
                label="Sort"
                value={
                  filters.sort
                }
                onChange={(event) =>
                  update(
                    "sort",
                    event.target.value as
                      | "newest"
                      | "oldest"
                  )
                }
              >

                <MenuItem value="newest">
                  Newest first
                </MenuItem>

                <MenuItem value="oldest">
                  Oldest first
                </MenuItem>

              </Select>

            </FormControl>

          </Box>

        </Paper>


        {/* ===================== */}
        {/* Activity Table */}
        {/* ===================== */}

        <Paper
          className="
            audit-card
            audit-table-card
          "
        >

          {/* Table Header */}

          <Box className="audit-table-header">

            <Box>

              <Typography variant="h6">
                Activity history
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                {query.data
                  ? `${query.data.total} matching activities`
                  : "Loading activity..."
                }
              </Typography>

            </Box>


            {/* Loading Indicator */}

            {query.isFetching && (
              <CircularProgress
                size={19}
              />
            )}

          </Box>


          {/* =====================
          {/* Error State */}
          {/* =====================*/}
          {query.isError ? (

            <Alert severity="error">
              Unable to load audit records.
              Please try again.
            </Alert>

          ) : query.isLoading ? (

            /* ======================== */
            /* Loading State */
            /* ======================== */

            <Box sx={{ p: 1 }}>

              {[1, 2, 3, 4, 5].map(
                (item) => (
                  <Skeleton
                    key={item}
                    height={46}
                  />
                )
              )}

            </Box>

          ) : query.data?.items.length ? (

            /* ======================== */
            /* Data State */
            /* ======================== */

            <>
              <TableContainer>

                <Table size="small">

                  {/* Table Head */}

                  <TableHead>

                    <TableRow>

                      {[
                        "User",
                        "Action",
                        "Resource",
                        "Description",
                        "IP address",
                        "Timestamp",
                        "Status",
                        "",
                      ].map((heading) => (

                        <TableCell
                          key={heading}
                        >
                          {heading}
                        </TableCell>

                      ))}

                    </TableRow>

                  </TableHead>


                  {/* Table Body */}

                  <TableBody>

                    {query.data.items.map(
                      (log) => (

                        <TableRow
                          key={log.id}
                          hover
                          onClick={() =>
                            setSelected(log)
                          }
                          className="audit-row"
                        >

                          {/* User */}

                          <TableCell>

                            <Typography
                              fontWeight={700}
                            >
                              {log.user_name}
                            </Typography>

                            <Typography variant="caption">
                              {log.user_email}
                            </Typography>

                          </TableCell>


                          {/* Action */}

                          <TableCell>

                            <Chip
                              className="
                                audit-action-chip
                              "
                              label={
                                labelize(
                                  log.action
                                )
                              }
                            />

                          </TableCell>


                          {/* Resource */}

                          <TableCell>

                            {
                              log.resource_type ||
                              log.entity_name ||
                              "—"
                            }

                            {log.resource_id && (
                              <Typography
                                variant="caption"
                                display="block"
                              >
                                #{log.resource_id}
                              </Typography>
                            )}

                          </TableCell>


                          {/* Description */}

                          <TableCell
                            className="
                              audit-description
                            "
                          >
                            {log.description ||
                              "—"}
                          </TableCell>


                          {/* IP Address */}

                          <TableCell>
                            {log.ip_address ||
                              "—"}
                          </TableCell>


                          {/* Timestamp */}

                          <TableCell>
                            {formatDate(
                              log.created_at
                            )}
                          </TableCell>


                          {/* Status */}

                          <TableCell>

                            <Chip
                              size="small"
                              color={
                                log.status ===
                                "SUCCESS"
                                  ? "success"
                                  : "error"
                              }
                              label={
                                labelize(
                                  log.status
                                )
                              }
                            />

                          </TableCell>


                          {/* View */}

                          <TableCell>

                            <VisibilityRoundedIcon
                              fontSize="small"
                            />

                          </TableCell>

                        </TableRow>

                      )
                    )}

                  </TableBody>

                </Table>

              </TableContainer>


              {/* ===================== */}
              {/* Pagination */}
              {/* ===================== */}

              <Box className="audit-pagination">

                <Pagination
                  count={
                    query.data.total_pages
                  }
                  page={
                    filters.page
                  }
                  onChange={(
                    _,
                    page
                  ) =>
                    setFilters(
                      (current) => ({
                        ...current,
                        page,
                      })
                    )
                  }
                  color="primary"
                />

                <Typography variant="body2">
                  25 per page
                </Typography>

              </Box>

            </>

          ) : (

            /* ===================== */
            /* Empty State */
            /* ===================== */

            <Box className="audit-empty">

              <HistoryRoundedIcon />

              <Typography variant="h6">
                No activity found
              </Typography>

              <Typography>
                Try adjusting the selected
                filters or search term.
              </Typography>

            </Box>

          )}

        </Paper>


        {/* ===================== */}
        {/* Activity Details Dialog */}
        {/* ===================== */}

        <Dialog
          open={!!selected}
          onClose={() =>
            setSelected(null)
          }
          maxWidth="md"
          fullWidth
        >

          <DialogTitle>
            Activity details
          </DialogTitle>


          <DialogContent dividers>

            {/* Loading */}

            {detail.isLoading ? (

              <CircularProgress />

            ) : detail.data ? (

              <Box className="audit-detail">

                {/* Detail Summary */}

                <Box className="audit-detail-summary">

                  <Chip
                    label={
                      labelize(
                        detail.data.action
                      )
                    }
                    color="primary"
                  />

                  <Typography variant="h6">
                    {
                      detail.data.description ||
                      detail.data.entity_name ||
                      "Activity record"
                    }
                  </Typography>

                  <Typography color="text.secondary">
                    {formatDate(
                      detail.data.created_at
                    )}

                    {" · "}

                    {detail.data.user_name}

                    {" · "}

                    {
                      detail.data.ip_address ||
                      "Unknown IP"
                    }
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    {
                      detail.data.user_agent ||
                      "User agent unavailable"
                    }
                  </Typography>

                </Box>


                {/* Before / After */}

                <Box className="audit-change-grid">

                  {/* Before */}

                  <Paper variant="outlined">

                    <Typography variant="subtitle2">
                      Before
                    </Typography>

                    {detailRows(
                      detail.data.before_values
                    )}

                  </Paper>


                  {/* After */}

                  <Paper variant="outlined">

                    <Typography variant="subtitle2">
                      After
                    </Typography>

                    {detailRows(
                      detail.data.after_values
                    )}

                  </Paper>

                </Box>

              </Box>

            ) : null}

          </DialogContent>

        </Dialog>

      </Box>

    </RoleGuard>
  );
}