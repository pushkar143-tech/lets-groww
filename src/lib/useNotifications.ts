import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserNotification {
  id: string;
  type: 'personal' | 'broadcast' | 'warning' | 'gift';
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

/**
 * Loads a user's notifications (personal + broadcast) with realtime updates,
 * tracks unread count, and provides a mark-read function.
 */
export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc('get_user_notifications', { p_limit: 50 });
    if (error) {
      console.error('load notifications failed', error);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as UserNotification[];
    setNotifications(rows);
    setUnreadCount(rows.filter((r) => !r.is_read).length);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications' },
        (payload) => {
          const newRow = payload.new as { user_id: string | null };
          if (newRow.user_id === userId || newRow.user_id === null) {
            void load();
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_reads' },
        (payload) => {
          const newRow = payload.new as { user_id: string };
          if (newRow.user_id === userId) {
            void load();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const markRead = useCallback(async (notificationId: string) => {
    const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: notificationId });
    if (error) {
      console.error('mark notification read failed', error);
      return;
    }
    void load();
  }, [load]);

  return { notifications, unreadCount, loading, markRead, reload: load };
}
