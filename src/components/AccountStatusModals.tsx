import { useState, useEffect } from 'react';
import { AlertTriangle, Ban, LogOut, ShieldAlert, Zap, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type AccountStatus = 'Active' | 'Restricted' | 'Suspended';

interface AccountStatusModalsProps {
  status: AccountStatus;
  statusReason: string | null;
  userId: string;
  onSignOut: () => void;
}

interface UnreadWarning {
  id: string;
  title: string;
  message: string;
}

/**
 * Renders three types of branded popups based on account status:
 * 1. Warning popup — for unread warning notifications
 * 2. Restricted popup — blocks deposits/orders, allows viewing
 * 3. Suspended full-screen lock — blocks all access
 */
export default function AccountStatusModals({ status, statusReason, userId, onSignOut }: AccountStatusModalsProps) {
  const [warning, setWarning] = useState<UnreadWarning | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Load unread warning notifications
  useEffect(() => {
    if (status === 'Suspended') return;
    const loadWarning = async () => {
      const { data, error } = await supabase.rpc('get_user_notifications', { p_limit: 50 });
      if (error) return;
      const rows = (data ?? []) as Array<{ id: string; type: string; title: string; message: string; is_read: boolean }>;
      const unreadWarning = rows.find((r) => r.type === 'warning' && !r.is_read);
      if (unreadWarning) {
        setWarning({ id: unreadWarning.id, title: unreadWarning.title, message: unreadWarning.message });
      }
    };
    void loadWarning();
  }, [status]);

  const acknowledgeWarning = async () => {
    if (warning) {
      const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: warning.id });
      if (error) console.error('mark warning read failed', error);
    }
    setWarning(null);
    setDismissed(true);
  };

  // ===== Suspended: full-screen lock =====
  if (status === 'Suspended') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/95 backdrop-blur-md">
        <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-10" />
        <div className="relative mx-4 w-full max-w-md rounded-2xl border border-accent-red/30 bg-ink-850/95 p-8 shadow-2xl">
          <div className="absolute -top-px left-1/2 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-accent-red/50 to-transparent" />
          <div className="flex flex-col items-center text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent-red/15 ring-1 ring-accent-red/30">
              <Ban className="h-8 w-8 text-accent-red" />
            </span>
            <div className="mt-4 flex items-center gap-2">
              <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-neon-400 to-grape-500">
                <Zap className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">Lets<span className="text-gradient"> Groww</span></span>
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold text-accent-red">Account Suspended</h1>
            <p className="mt-2 text-sm text-white/50">
              Your account has been suspended by the administration. You cannot access the platform until it is reactivated.
            </p>
            {statusReason && (
              <div className="mt-4 w-full rounded-xl border border-accent-red/20 bg-accent-red/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-red/70">Reason</p>
                <p className="mt-1.5 text-sm leading-6 text-white/70">{statusReason}</p>
              </div>
            )}
            <button
              onClick={onSignOut}
              className="btn-primary mt-6 w-full"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
            <p className="mt-3 text-xs text-white/30">If you believe this is an error, please contact support.</p>
          </div>
        </div>
      </div>
    );
  }

  // ===== Warning popup (unread warning notification) =====
  if (warning && !dismissed) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-md rounded-2xl border border-accent-amber/30 bg-ink-850/95 p-6 shadow-2xl animate-[order-success-pop_0.2s_ease-out]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-400 to-grape-500">
                <Zap className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
              </span>
              <span className="font-display text-sm font-bold tracking-tight">Lets<span className="text-gradient"> Groww</span></span>
            </div>
            <span className="chip border border-accent-amber/30 bg-accent-amber/10 text-accent-amber">
              <ShieldAlert className="h-3.5 w-3.5" /> Warning
            </span>
          </div>

          <div className="mt-5 flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-amber/15 ring-1 ring-accent-amber/30">
              <AlertTriangle className="h-7 w-7 text-accent-amber" />
            </span>
            <h2 className="mt-4 font-display text-xl font-bold text-accent-amber">{warning.title}</h2>
            <div className="mt-3 w-full rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-4">
              <p className="text-sm leading-6 text-white/70">{warning.message}</p>
            </div>
          </div>

          <button
            onClick={() => void acknowledgeWarning()}
            className="btn-primary mt-5 w-full"
          >
            I Understand
          </button>
        </div>
      </div>
    );
  }

  // ===== Restricted popup (shown once per mount, dismissible but blocks actions) =====
  if (status === 'Restricted' && !dismissed) {
    return (
      <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-full max-w-md rounded-2xl border border-accent-amber/30 bg-ink-850/95 p-6 shadow-2xl animate-[order-success-pop_0.2s_ease-out]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-400 to-grape-500">
                <Zap className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
              </span>
              <span className="font-display text-sm font-bold tracking-tight">Lets<span className="text-gradient"> Groww</span></span>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-lg border border-white/10 p-1.5 text-white/40 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-amber/15 ring-1 ring-accent-amber/30">
              <Ban className="h-7 w-7 text-accent-amber" />
            </span>
            <h2 className="mt-4 font-display text-xl font-bold text-accent-amber">Account Restricted</h2>
            <p className="mt-2 text-sm text-white/50">
              Your account is currently restricted. You can view your dashboard and inbox, but cannot place new orders or submit deposits.
            </p>
            {statusReason && (
              <div className="mt-4 w-full rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-amber/70">Reason</p>
                <p className="mt-1.5 text-sm leading-6 text-white/70">{statusReason}</p>
              </div>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="btn-ghost mt-5 w-full"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
