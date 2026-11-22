import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRight, Ban, CheckCircle2, Clock3, Gift, Loader2, Mail,
  Minus, Package, Plus, Search, ShieldCheck, UserCheck, Users, Wallet, X, XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/format';

interface AdminUsersProps {
  onNavigate: (view: string) => void;
}

type AccountStatus = 'Active' | 'Restricted' | 'Suspended';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  wallet_balance: number;
  account_status: AccountStatus;
  status_reason: string | null;
  status_updated_at: string | null;
  created_at: string;
  total_deposits: number;
  deposit_count: number;
  total_orders: number;
  order_count: number;
}

type ActionMode = 'add' | 'deduct' | 'gift' | 'status' | 'email' | null;

const STATUS_TABS: { label: string; value: AccountStatus | 'All' }[] = [
  { label: 'All', value: 'All' },
  { label: 'Active', value: 'Active' },
  { label: 'Restricted', value: 'Restricted' },
  { label: 'Suspended', value: 'Suspended' },
];

const EMAIL_TEMPLATES: { label: string; subject: string; message: string }[] = [
  {
    label: 'Welcome',
    subject: 'Welcome to Lets Groww!',
    message: 'Hi there,\n\nWelcome to Lets Groww! We are excited to have you on board. Start by adding funds to your wallet and exploring our services.\n\nIf you have any questions, feel free to reach out.\n\nBest regards,\nThe Lets Groww Team',
  },
  {
    label: 'Gift Credit',
    subject: 'You received a gift balance!',
    message: 'Hi,\n\nGreat news! A gift balance has been credited to your Lets Groww wallet. You can use it to place orders across all our services.\n\nEnjoy!\n\nBest regards,\nThe Lets Groww Team',
  },
  {
    label: 'Account Notice',
    subject: 'Important: Account Status Update',
    message: 'Hi,\n\nThis is to inform you that your Lets Groww account status has been updated. Please review the changes and contact support if you believe this is an error.\n\nBest regards,\nThe Lets Groww Team',
  },
];

export default function AdminUsersPage({ onNavigate }: AdminUsersProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'All'>('All');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, wallet_balance, account_status, status_reason, status_updated_at, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('admin users load failed', error);
      setMessage({ kind: 'error', text: 'Could not load users.' });
      setLoading(false);
      return;
    }

    const profiles = (data ?? []) as Omit<UserProfile, 'total_deposits' | 'deposit_count' | 'total_orders' | 'order_count'>[];

    // Batch fetch stats for each user
    const enriched = await Promise.all(
      profiles.map(async (p) => {
        const { data: stats } = await supabase.rpc('admin_get_user_stats', { p_user_id: p.id });
        const s = (stats ?? { total_deposits: 0, deposit_count: 0, total_orders: 0, order_count: 0 }) as {
          total_deposits: number; deposit_count: number; total_orders: number; order_count: number;
        };
        return { ...p, ...s } as UserProfile;
      }),
    );

    setUsers(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
    const channel = supabase
      .channel('admin-users-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void loadUsers(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesStatus = statusFilter === 'All' || u.account_status === statusFilter;
      const matchesSearch = !q ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.role === 'admin' && 'admin'.includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [users, search, statusFilter]);

  const openAction = (mode: ActionMode, user: UserProfile) => {
    setSelectedUser(user);
    setActionMode(mode);
  };

  const closeAction = () => {
    setActionMode(null);
    setSelectedUser(null);
  };

  const onActionDone = (kind: 'success' | 'error', text: string) => {
    setMessage({ kind, text });
    closeAction();
    void loadUsers();
    window.setTimeout(() => setMessage(null), 4000);
  };

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.account_status === 'Active').length,
    restricted: users.filter((u) => u.account_status === 'Restricted').length,
    suspended: users.filter((u) => u.account_status === 'Suspended').length,
  }), [users]);

  return (
    <section className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-20" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="chip border border-grape-400/30 bg-grape-500/10 text-grape-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Panel
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
              User <span className="text-gradient">Management</span>
            </h1>
            <p className="mt-2 text-sm text-white/50">Manage users, wallet balances, account status, and send emails.</p>
          </div>
          <button onClick={() => void loadUsers()} className="btn-ghost w-fit !px-4 !py-2">
            <Clock3 className="h-4 w-4" /> Refresh
          </button>
        </div>

        {/* Admin sub-nav */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => onNavigate('admin-deposits')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white">
            <Wallet className="h-4 w-4" /> Deposits
          </button>
          <button onClick={() => onNavigate('admin-orders')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white">
            <Package className="h-4 w-4" /> Orders
          </button>
          <button onClick={() => onNavigate('admin-services')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white">
            <Users className="h-4 w-4" /> Services
          </button>
          <button onClick={() => onNavigate('admin-gift-codes')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white">
            <Gift className="h-4 w-4" /> Gift Codes
          </button>
          <button onClick={() => onNavigate('admin-users')} className="inline-flex items-center gap-2 rounded-xl border border-grape-400/40 bg-grape-500/15 px-4 py-2.5 text-sm font-medium text-grape-200">
            <Users className="h-4 w-4" /> Users
          </button>
        </div>

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Users" value={stats.total} icon={Users} color="text-white" />
          <StatCard label="Active" value={stats.active} icon={UserCheck} color="text-accent-green" />
          <StatCard label="Restricted" value={stats.restricted} icon={Ban} color="text-accent-amber" />
          <StatCard label="Suspended" value={stats.suspended} icon={XCircle} color="text-accent-red" />
        </div>

        {/* Message banner */}
        {message && (
          <div className={`mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            message.kind === 'success' ? 'border-accent-green/30 bg-accent-green/10 text-accent-green' : 'border-accent-red/30 bg-accent-red/10 text-accent-red'
          }`}>
            {message.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* Search + filter tabs */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or ID…"
              className="input-field !pl-10"
            />
          </div>
          <div className="flex gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  statusFilter === tab.value
                    ? 'bg-white/10 text-white ring-1 ring-white/20'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Users table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-ink-850/70 backdrop-blur-xl">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Wallet</th>
                  <th className="px-5 py-3">Deposits</th>
                  <th className="px-5 py-3">Orders</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-white/40">Loading users…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-white/40">No users found.</td></tr>
                ) : (
                  filtered.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-4">
                        <p className="font-medium text-white/90">{user.email}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-white/30">{user.id.slice(0, 8)}…</p>
                        {user.role === 'admin' && <span className="chip mt-1 border border-grape-400/30 bg-grape-500/10 text-grape-300">Admin</span>}
                      </td>
                      <td className="px-5 py-4 font-semibold text-neon-300">{formatINR(Number(user.wallet_balance))}</td>
                      <td className="px-5 py-4 text-white/60">
                        <p className="font-medium">{formatINR(Number(user.total_deposits))}</p>
                        <p className="text-xs text-white/30">{user.deposit_count} approved</p>
                      </td>
                      <td className="px-5 py-4 text-white/60">
                        <p className="font-medium">{formatINR(Number(user.total_orders))}</p>
                        <p className="text-xs text-white/30">{user.order_count} orders</p>
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={user.account_status} /></td>
                      <td className="px-5 py-4 text-white/50">{formatDate(user.created_at)}</td>
                      <td className="px-5 py-4">
                        <ActionButtons user={user} onAction={openAction} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-white/5 md:hidden">
            {loading ? (
              <div className="p-8 text-center text-white/40">Loading users…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-white/40">No users found.</div>
            ) : (
              filtered.map((user) => (
                <div key={user.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white/90">{user.email}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-white/30">{user.id.slice(0, 12)}…</p>
                    </div>
                    <StatusBadge status={user.account_status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-white/40">Wallet</p><p className="mt-0.5 font-semibold text-neon-300">{formatINR(Number(user.wallet_balance))}</p></div>
                    <div><p className="text-xs text-white/40">Deposits</p><p className="mt-0.5 font-medium text-white/70">{formatINR(Number(user.total_deposits))}</p></div>
                    <div><p className="text-xs text-white/40">Orders</p><p className="mt-0.5 font-medium text-white/70">{user.order_count}</p></div>
                    <div><p className="text-xs text-white/40">Joined</p><p className="mt-0.5 text-xs text-white/50">{formatDate(user.created_at)}</p></div>
                  </div>
                  <div className="mt-4"><ActionButtons user={user} onAction={openAction} full /></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ===== Action Modals ===== */}
      {actionMode && selectedUser && (
        <ActionModal
          mode={actionMode}
          user={selectedUser}
          onClose={closeAction}
          onDone={onActionDone}
        />
      )}
    </section>
  );
}

// ===== Stat Card =====
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Users; color: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className={`grid h-10 w-10 place-items-center rounded-xl bg-white/5 ${color}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-white/40">{label}</p>
        <p className={`font-display text-xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

// ===== Status Badge =====
function StatusBadge({ status }: { status: AccountStatus }) {
  const config = {
    Active: { icon: CheckCircle2, classes: 'border-accent-green/30 bg-accent-green/10 text-accent-green' },
    Restricted: { icon: Ban, classes: 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber' },
    Suspended: { icon: XCircle, classes: 'border-accent-red/30 bg-accent-red/10 text-accent-red' },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`chip border ${config.classes}`}>
      <Icon className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

// ===== Action Buttons =====
function ActionButtons({
  user, onAction, full,
}: {
  user: UserProfile;
  onAction: (mode: ActionMode, user: UserProfile) => void;
  full?: boolean;
}) {
  const isAdmin = user.role === 'admin';
  const base = full ? 'flex w-full flex-wrap gap-2' : 'flex justify-end gap-1.5';
  return (
    <div className={base}>
      <button onClick={() => onAction('add', user)} disabled={isAdmin} className="inline-flex items-center gap-1 rounded-lg bg-accent-green/15 px-2.5 py-1.5 text-xs font-semibold text-accent-green transition hover:bg-accent-green/25 disabled:opacity-30" title="Add Funds">
        <Plus className="h-3.5 w-3.5" /> {full ? 'Add' : ''}
      </button>
      <button onClick={() => onAction('deduct', user)} disabled={isAdmin} className="inline-flex items-center gap-1 rounded-lg bg-accent-amber/15 px-2.5 py-1.5 text-xs font-semibold text-accent-amber transition hover:bg-accent-amber/25 disabled:opacity-30" title="Deduct Funds">
        <Minus className="h-3.5 w-3.5" /> {full ? 'Deduct' : ''}
      </button>
      <button onClick={() => onAction('gift', user)} disabled={isAdmin} className="inline-flex items-center gap-1 rounded-lg bg-grape-500/15 px-2.5 py-1.5 text-xs font-semibold text-grape-300 transition hover:bg-grape-500/25 disabled:opacity-30" title="Send Gift">
        <Gift className="h-3.5 w-3.5" /> {full ? 'Gift' : ''}
      </button>
      <button onClick={() => onAction('status', user)} disabled={isAdmin} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/10 disabled:opacity-30" title="Account Status">
        <Ban className="h-3.5 w-3.5" /> {full ? 'Status' : ''}
      </button>
      <button onClick={() => onAction('email', user)} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/10" title="Send Email">
        <Mail className="h-3.5 w-3.5" /> {full ? 'Email' : ''}
      </button>
    </div>
  );
}

// ===== Action Modal (handles all 5 modes) =====
function ActionModal({
  mode, user, onClose, onDone,
}: {
  mode: ActionMode;
  user: UserProfile;
  onClose: () => void;
  onDone: (kind: 'success' | 'error', text: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (mode === 'email' && subject === '' && messageBody === '') {
      setSubject(EMAIL_TEMPLATES[0].subject);
      setMessageBody(EMAIL_TEMPLATES[0].message);
    }
  }, [mode, subject, messageBody]);

  const titles: Record<NonNullable<ActionMode>, string> = {
    add: 'Add Funds to Wallet',
    deduct: 'Deduct Funds from Wallet',
    gift: 'Send Gift Balance',
    status: 'Account Status',
    email: 'Send Email',
  };

  const handleSubmit = async () => {
    setError(null);

    if (mode === 'add' || mode === 'deduct' || mode === 'gift') {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setError('Enter a valid positive amount.');
        return;
      }

      if (!confirmStep) {
        setConfirmStep(true);
        return;
      }

      setWorking(true);
      if (mode === 'gift') {
        const { data, error: rpcError } = await supabase.rpc('admin_send_gift', {
          p_user_id: user.id, p_amount: amt, p_title: note || 'Gift from Lets Groww',
        });
        setWorking(false);
        if (rpcError || data === null) {
          setError(rpcError?.message ?? 'Failed to send gift.');
          return;
        }
        onDone('success', `Gift of ${formatINR(amt)} sent to ${user.email}. New balance: ${formatINR(Number(data))}.`);
      } else {
        const { data, error: rpcError } = await supabase.rpc('admin_adjust_wallet', {
          p_user_id: user.id, p_amount: amt, p_note: note || null, p_type: mode,
        });
        setWorking(false);
        if (rpcError || data === null) {
          setError(rpcError?.message ?? 'Failed to adjust wallet.');
          return;
        }
        onDone('success', `${mode === 'add' ? 'Added' : 'Deducted'} ${formatINR(amt)} ${mode === 'add' ? 'to' : 'from'} ${user.email}. New balance: ${formatINR(Number(data))}.`);
      }
      return;
    }

    if (mode === 'status') {
      if (!confirmStep) {
        setConfirmStep(true);
        return;
      }
      setWorking(true);
      const targetStatus = (note === 'Active' ? 'Active' : note === 'Restricted' ? 'Restricted' : 'Suspended') as AccountStatus;
      // note field is repurposed — we use a separate state for status selection
      const statusToSet = pendingStatus;
      const reasonText = statusReason;
      const { error: rpcError } = await supabase.rpc('admin_set_account_status', {
        p_user_id: user.id, p_status: statusToSet, p_reason: reasonText || null,
      });
      setWorking(false);
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      onDone('success', `${user.email} is now ${statusToSet}.`);
      return;
    }

    if (mode === 'email') {
      if (!subject.trim() || !messageBody.trim()) {
        setError('Subject and message are required.');
        return;
      }
      setWorking(true);
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          to_email: user.email,
          subject: subject.trim(),
          message: messageBody.trim(),
          admin_id: adminUser?.id,
          user_id: user.id,
        }),
      });
      setWorking(false);
      const result = await response.json() as { success?: boolean; error?: string; message?: string };
      if (!response.ok || result.error) {
        setError(result.error ?? 'Failed to send email.');
        return;
      }
      onDone('success', `Email sent to ${user.email}.`);
      return;
    }
  };

  // Status modal state
  const [pendingStatus, setPendingStatus] = useState<AccountStatus>(user.account_status);
  const [statusReason, setStatusReason] = useState(user.status_reason ?? '');

  const resetConfirm = () => { setConfirmStep(false); setError(null); };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-ink-850/95 p-6 shadow-2xl backdrop-blur-xl animate-[order-success-pop_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">{titles[mode!]}</h3>
          <button onClick={onClose} className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* User info */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-medium text-white/90">{user.email}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
            <span>Balance: <span className="text-neon-300 font-semibold">{formatINR(Number(user.wallet_balance))}</span></span>
            <span>Status: <StatusBadgeMini status={user.account_status} /></span>
          </div>
        </div>

        {/* Mode-specific content */}
        <div className="mt-4 space-y-4">
          {(mode === 'add' || mode === 'deduct') && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/60">Amount (INR)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); resetConfirm(); }}
                  className="input-field"
                  placeholder="Enter amount"
                  disabled={confirmStep}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/60">Reason / Note (optional)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Manual adjustment for dispute"
                  disabled={confirmStep}
                />
              </label>
              {confirmStep && (
                <div className="rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-3 text-sm text-accent-amber">
                  {mode === 'add' ? 'Add' : 'Deduct'} {formatINR(Number(amount))} {mode === 'add' ? 'to' : 'from'} this user's wallet?
                  {mode === 'deduct' && Number(user.wallet_balance) - Number(amount) < 0 && (
                    <p className="mt-1 text-xs text-accent-red">This will be blocked — amount exceeds current balance.</p>
                  )}
                </div>
              )}
            </>
          )}

          {mode === 'gift' && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/60">Gift Amount (INR)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); resetConfirm(); }}
                  className="input-field"
                  placeholder="Enter gift amount"
                  disabled={confirmStep}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/60">Gift Title / Reason</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Welcome bonus, festive gift"
                  disabled={confirmStep}
                />
              </label>
              {confirmStep && (
                <div className="rounded-xl border border-grape-400/20 bg-grape-500/5 p-3 text-sm text-grape-300">
                  Send {formatINR(Number(amount))} as a gift to this user?
                </div>
              )}
            </>
          )}

          {mode === 'status' && (
            <>
              <div className="space-y-2">
                <span className="block text-sm font-medium text-white/60">Account Status</span>
                {(['Active', 'Restricted', 'Suspended'] as AccountStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setPendingStatus(s); resetConfirm(); }}
                    disabled={confirmStep}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      pendingStatus === s
                        ? s === 'Active' ? 'border-accent-green/40 bg-accent-green/10'
                          : s === 'Restricted' ? 'border-accent-amber/40 bg-accent-amber/10'
                          : 'border-accent-red/40 bg-accent-red/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <StatusBadgeMini status={s} />
                    <span className="text-sm text-white/70">
                      {s === 'Active' && 'Full access — can deposit and place orders'}
                      {s === 'Restricted' && 'Cannot deposit or place new orders'}
                      {s === 'Suspended' && 'Account fully blocked'}
                    </span>
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/60">Reason (optional)</span>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="input-field"
                  placeholder="Reason for status change"
                  disabled={confirmStep}
                />
              </label>
              {confirmStep && pendingStatus !== user.account_status && (
                <div className="rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-3 text-sm text-accent-amber">
                  Change status from <b>{user.account_status}</b> to <b>{pendingStatus}</b>?
                </div>
              )}
            </>
          )}

          {mode === 'email' && (
            <>
              <div className="flex flex-wrap gap-2">
                {EMAIL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => { setSubject(tpl.subject); setMessageBody(tpl.message); }}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-white/20 hover:text-white"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/60">Subject</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input-field"
                  placeholder="Email subject"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/60">Message</span>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={6}
                  className="input-field resize-none"
                  placeholder="Email message"
                />
              </label>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-accent-red/30 bg-accent-red/10 px-3 py-3 text-sm text-accent-red">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={working || (mode === 'status' && pendingStatus === user.account_status && !confirmStep)}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {working ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Working…</>
            ) : confirmStep ? (
              <>Confirm</>
            ) : mode === 'email' ? (
              <><Mail className="h-4 w-4" /> Send Email</>
            ) : (
              <>{confirmStep ? 'Confirm' : 'Continue'} <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadgeMini({ status }: { status: AccountStatus }) {
  const colorMap = {
    Active: 'text-accent-green',
    Restricted: 'text-accent-amber',
    Suspended: 'text-accent-red',
  };
  return <span className={`text-xs font-semibold ${colorMap[status]}`}>{status}</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}
