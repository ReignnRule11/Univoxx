import { notFound } from "@/lib/errors";
import { publicNotification } from "./serializers";
import { getCommunityStore } from "./store";
import type { PublicNotification } from "./types";

export async function listNotifications(userId: string): Promise<PublicNotification[]> {
  const rows = await getCommunityStore().listNotifications(userId);
  return rows.map(publicNotification);
}

export async function markNotification(
  userId: string,
  notificationId: string,
  read: boolean,
): Promise<PublicNotification> {
  const store = getCommunityStore();
  const notification = await store.findNotificationById(userId, notificationId);
  if (!notification) {
    throw notFound("Notification not found");
  }
  const updated = await store.markNotificationRead(notification.id, read ? new Date() : null);
  return publicNotification(updated);
}
