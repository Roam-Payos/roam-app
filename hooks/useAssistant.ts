/**
 * useAssistant — Roam Smart Assistant hook.
 *
 * Exposes:
 *   publishEvent(type, payload)   — fire an event to the rule engine
 *   notifications                 — list of notifications for the current user
 *   unreadCount                   — badge count
 *   markRead(id)                  — mark one notification as read
 *   dismiss(id)                   — delete / dismiss a notification
 *   refresh()                     — manual refresh
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoam } from "@/context/RoamContext";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const POLL_MS = 30_000; // re-fetch every 30 s

export interface AssistantNotification {
  id: string;
  title: string;
  message: string;
  cta_label: string | null;
  cta_route: string | null;
  icon: string | null;
  type: "suggestion" | "tip" | "upsell" | "alert";
  status: "unread" | "read";
  created_at: string;
}

export function useAssistant() {
  const { user } = useRoam();
  const [notifications, setNotifications] = useState<AssistantNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API}/assistant/notifications/${user.id}?limit=20`);
      if (!res.ok) return;
      const data = await res.json() as { notifications: AssistantNotification[]; unreadCount: number };
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {}
  }, [user?.id]);

  // Initial fetch + polling
  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user?.id, fetchNotifications]);

  const publishEvent = useCallback(async (
    eventType: string,
    payload: Record<string, unknown> = {},
  ) => {
    if (!user?.id) return;
    try {
      await fetch(`${API}/assistant/events/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(user.id), eventType, payload }),
      });
      // Refresh notifications after a short delay (let the engine process)
      setTimeout(fetchNotifications, 600);
    } catch {}
  }, [user?.id, fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, status: "read" } : n),
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetch(`${API}/assistant/notifications/${id}/read`, { method: "PATCH" });
    } catch {}
  }, []);

  const dismiss = useCallback(async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (notif?.status === "unread") setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetch(`${API}/assistant/notifications/${id}`, { method: "DELETE" });
    } catch {}
  }, [notifications]);

  return { notifications, unreadCount, publishEvent, markRead, dismiss, refresh: fetchNotifications };
}
