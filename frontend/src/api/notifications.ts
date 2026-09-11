import { apiClient } from "./client";
import type { Notification, NotificationFilters, NotificationPage } from "../types/notification";

export const notificationsApi = {
  list: (params: NotificationFilters) => apiClient.get<NotificationPage>("/notifications", { params }).then((r) => r.data),
  unreadCount: () => apiClient.get<{ count: number }>("/notifications/unread-count").then((r) => r.data),
  get: (id: number) => apiClient.get<Notification>(`/notifications/${id}`).then((r) => r.data),
  markRead: (id: number) => apiClient.patch<Notification>(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => apiClient.patch<{ updated: number }>("/notifications/read-all").then((r) => r.data),
};