import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '@/store/useStore';
import { reminderTime } from '@/store/dates';

const CHECK_EVERY_MS = 30_000;
/** A reminder missed by more than this (app was closed) is marked as seen without notifying. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_PER_CHECK = 5;

/** Fires desktop notifications for items whose reminder time has arrived while the app is open. */
export function useReminders() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof Notification === 'undefined') return;

    const check = () => {
      const { items, updateItem } = useStore.getState();
      const now = Date.now();
      const due = items.filter((item) => {
        const at = reminderTime(item);
        return at !== undefined && at <= now && !item.notifiedAt && item.status !== 'completed';
      });
      if (due.length === 0) return;

      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
        return;
      }

      due.slice(0, MAX_PER_CHECK).forEach((item) => {
        const stale = now - reminderTime(item)! > STALE_AFTER_MS;
        if (!stale && Notification.permission === 'granted') {
          const n = new Notification(item.title, { body: item.subtitle || 'Tienes un elemento programado para hoy.' });
          n.onclick = () => router.push(`/item/${item.id}`);
        }
        // Denied or stale: still mark it so it does not retry forever.
        updateItem(item.id, { notifiedAt: now });
      });
    };

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, []);
}
