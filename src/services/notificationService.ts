import { Notification, NotificationType } from '../types';

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch('/api/notifications');
  if (!res.ok) return [];
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch(`/api/notifications/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ read: true }),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetch('/api/notifications', { method: 'PUT' });
}

export async function deleteNotification(id: string): Promise<void> {
  await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
}

// Server handles notification creation — kept for call-site compatibility
export const createNotification = async (
  _userId: string,
  _type: NotificationType,
  _title: string,
  _message: string,
  _betId?: string,
) => {};
