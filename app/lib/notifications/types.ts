export type NotificationRecord = {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  relatedType: string | null;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationListResponse = {
  notifications: NotificationRecord[];
  unreadCount: number;
};
