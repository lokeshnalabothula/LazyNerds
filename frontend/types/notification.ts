export type NotificationType =
  | "finding_alert"
  | "engagement_due"
  | "automation_alert"
  | "verification_result"
  | "system";

export interface Notification {
  id: string;
  recipient_email: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
}
