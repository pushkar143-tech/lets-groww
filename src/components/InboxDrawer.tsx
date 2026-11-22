import { useMemo, useState } from 'react';
import {
  Bell, Gift, Megaphone, MessageSquare, X, Zap, AlertTriangle,
  CheckCircle2, Clock3,
} from 'lucide-react';
import type { UserNotification } from '@/lib/useNotifications';

interface InboxDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: UserNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => Promise<void>;
}

type Tab = 'personal' | 'offers';

export default function InboxDrawer({ open, onClose, notifications, unreadCount, onMarkRead }: InboxDrawerProps) {
  const [tab, setTab] = useState<Tab>('personal');
  const [selected, setSelected] = useState<UserNotification | null>(null);

  const personal = useMemo(
    () => notifications.filter((n) => n.type === 'personal' || n.type === 'warning' || n.type === 'gift'),
    [notifications],
  );
  const offers = useMemo(
    () => notifications.filter((n) => n.type === 'broadcast'),
    [notifications],
  );

  const list = tab === 'personal' ? personal : offers;
  const personalUnread = personal.filter((n) => !n.is_read).length;
  const offersUnread = offers.filter((n) => !n.is_read).length;

  const openMessage = async (n: UserNotification) => {
    setSelected(n);
    if (!n.is_read) {
      await onMarkRead(n.id);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-ink-850/95 shadow-2xl backdrop-blur-xl animate-[slide-in-right_0.25s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-400 to-grape-500 shadow-neon">
              <Zap className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="font-display text-base font-bold tracking-tight">Lets<span className="text-gradient"> Groww</span> Inbox</h2>
              <p className="text-xs text-white/40">{unreadCount} unread {unreadCount === 1 ? 'message' : 'messages'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/10 p-2 text-white/40 transition hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 px-5 py-3">
          <button
            onClick={() => { setTab('personal'); setSelected(null); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'personal' ? 'bg-neon-500/15 text-neon-300 ring-1 ring-neon-400/30' : 'text-white/50 hover:text-white'
            }`}
          >
            <MessageSquare className="h-4 w-4" /> Personal
            {personalUnread > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white">{personalUnread}</span>
            )}
          </button>
          <button
            onClick={() => { setTab('offers'); setSelected(null); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'offers' ? 'bg-grape-500/15 text-grape-300 ring-1 ring-grape-400/30' : 'text-white/50 hover:text-white'
            }`}
          >
            <Megaphone className="h-4 w-4" /> Offers
            {offersUnread > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white">{offersUnread}</span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <MessageDetail notification={selected} onBack={() => setSelected(null)} />
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center text-white/40">
              {tab === 'personal' ? <MessageSquare className="h-10 w-10 text-white/15" /> : <Megaphone className="h-10 w-10 text-white/15" />}
              <p className="text-sm">{tab === 'personal' ? 'No personal messages yet.' : 'No offers or announcements yet.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {list.map((n) => (
                <NotificationItem key={n.id} notification={n} onClick={() => void openMessage(n)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationItem({ notification: n, onClick }: { notification: UserNotification; onClick: () => void }) {
  const iconMap = {
    personal: { icon: MessageSquare, color: 'text-neon-300', bg: 'bg-neon-500/15' },
    warning: { icon: AlertTriangle, color: 'text-accent-amber', bg: 'bg-accent-amber/15' },
    gift: { icon: Gift, color: 'text-grape-300', bg: 'bg-grape-500/15' },
    broadcast: { icon: Megaphone, color: 'text-grape-300', bg: 'bg-grape-500/15' },
  };
  const config = iconMap[n.type] ?? iconMap.personal;
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03] ${!n.is_read ? 'bg-neon-500/[0.04]' : ''}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${config.bg} ${config.color}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm font-medium ${!n.is_read ? 'text-white' : 'text-white/70'}`}>{n.title}</p>
          {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-neon-400 animate-pulseGlow" />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-white/40">{n.message}</p>
        <p className="mt-1 text-[11px] text-white/25">{formatRelative(n.created_at)}</p>
      </div>
    </button>
  );
}

function MessageDetail({ notification: n, onBack }: { notification: UserNotification; onBack: () => void }) {
  const iconMap = {
    personal: { icon: MessageSquare, color: 'text-neon-300', bg: 'bg-neon-500/15' },
    warning: { icon: AlertTriangle, color: 'text-accent-amber', bg: 'bg-accent-amber/15' },
    gift: { icon: Gift, color: 'text-grape-300', bg: 'bg-grape-500/15' },
    broadcast: { icon: Megaphone, color: 'text-grape-300', bg: 'bg-grape-500/15' },
  };
  const config = iconMap[n.type] ?? iconMap.personal;
  const Icon = config.icon;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
        <button onClick={onBack} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:text-white">Back</button>
        <span className={`chip border ${n.type === 'warning' ? 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber' : n.type === 'gift' ? 'border-grape-400/30 bg-grape-500/10 text-grape-300' : n.type === 'broadcast' ? 'border-grape-400/30 bg-grape-500/10 text-grape-300' : 'border-neon-400/30 bg-neon-500/10 text-neon-300'}`}>
          <Icon className="h-3.5 w-3.5" /> {n.type}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <h3 className="font-display text-lg font-bold text-white">{n.title}</h3>
        <p className="mt-1 text-xs text-white/30">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(n.created_at))}</p>
        <div className="mt-4 whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/70">
          {n.message}
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-accent-green">
          <CheckCircle2 className="h-3.5 w-3.5" /> Read
        </div>
      </div>
    </div>
  );
}

function formatRelative(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'short' }).format(new Date(value));
}
