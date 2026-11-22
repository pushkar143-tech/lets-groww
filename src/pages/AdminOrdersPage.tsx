import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gift,
  Loader2,
  Package,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TrendingDown,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/format';

interface Order {
  id: string;
  user_id: string | null;
  service_name: string;
  quantity: number;
  link: string;
  total_price: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'In Progress' | 'Completed';
  created_at: string;
  email?: string;
}

interface AdminOrdersProps {
  onNavigate: (view: string) => void;
}

export default function AdminOrdersPage({ onNavigate }: AdminOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id, user_id, service_name, quantity, link, total_price, status, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('admin orders load failed', error);
      setMessage({ kind: 'error', text: 'Could not load orders.' });
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Order[];
    const ids = rows.flatMap((row) => (row.user_id ? [row.user_id] : []));
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, email').in('id', ids)
      : { data: [] };
    const emailById = new Map(
      (profiles ?? []).map((profile) => [profile.id as string, profile.email as string]),
    );
    setOrders(rows.map((row) => ({ ...row, email: row.user_id ? emailById.get(row.user_id) : undefined })));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOrders();
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void loadOrders();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  const approve = async (id: string) => {
    setWorkingId(id);
    setMessage(null);
    const { error } = await supabase.rpc('approve_order', { p_order_id: id });
    setWorkingId(null);
    if (error) {
      console.error('approve order failed', error);
      setMessage({ kind: 'error', text: 'This order could not be approved. It may already be processed.' });
      return;
    }
    setMessage({ kind: 'success', text: 'Order approved and marked as completed.' });
    await loadOrders();
  };

  const reject = async (id: string) => {
    setWorkingId(id);
    setMessage(null);
    const { error } = await supabase.rpc('reject_order_and_refund', { p_order_id: id });
    setWorkingId(null);
    if (error) {
      console.error('reject order failed', error);
      setMessage({ kind: 'error', text: 'This order could not be rejected. It may already be processed.' });
      return;
    }
    setMessage({ kind: 'success', text: 'Order rejected and the amount has been refunded to the user wallet.' });
    await loadOrders();
  };

  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'Pending').length;
    const approved = orders.filter((o) => o.status === 'Completed' || o.status === 'Approved').length;
    const refunded = orders
      .filter((o) => o.status === 'Rejected')
      .reduce((sum, o) => sum + Number(o.total_price), 0);
    return { pending, approved, refunded };
  }, [orders]);

  return (
    <section className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-20" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="chip border border-grape-400/30 bg-grape-500/10 text-grape-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Panel
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
              Order <span className="text-gradient">Management</span>
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Review pending orders, approve fulfilment, or reject and refund the customer wallet.
            </p>
          </div>
          <button onClick={() => void loadOrders()} className="btn-ghost w-fit !px-4 !py-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => onNavigate('admin-deposits')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white"><Wallet className="h-4 w-4" /> Deposits</button>
          <button onClick={() => onNavigate('admin-orders')} className="inline-flex items-center gap-2 rounded-xl border border-grape-400/40 bg-grape-500/15 px-4 py-2.5 text-sm font-medium text-grape-200 transition"><Package className="h-4 w-4" /> Orders</button>
          <button onClick={() => onNavigate('admin-services')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white"><Settings2 className="h-4 w-4" /> Services</button>
          <button onClick={() => onNavigate('admin-users')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white"><Users className="h-4 w-4" /> Users</button>
        </div>

        {/* Live stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={Clock3}
            label="Pending Orders"
            value={String(stats.pending)}
            color="text-accent-amber"
            glow="bg-accent-amber/15"
          />
          <StatCard
            icon={CheckCircle2}
            label="Approved Orders"
            value={String(stats.approved)}
            color="text-accent-green"
            glow="bg-accent-green/15"
          />
          <StatCard
            icon={TrendingDown}
            label="Total Refunded"
            value={formatINR(stats.refunded)}
            color="text-accent-red"
            glow="bg-accent-red/15"
          />
        </div>

        {message && (
          <div
            className={`mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
              message.kind === 'success'
                ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
                : 'border-accent-red/30 bg-accent-red/10 text-accent-red'
            }`}
          >
            {message.kind === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}

        {/* Orders table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-ink-850/70 backdrop-blur-xl">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-5 py-3">Order ID</th>
                  <th className="px-5 py-3">User Email</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Qty</th>
                  <th className="px-5 py-3">Link</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-white/40">
                      Loading orders…
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      workingId={workingId}
                      onApprove={approve}
                      onReject={reject}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-white/5 md:hidden">
            {loading ? (
              <div className="p-8 text-center text-white/40">Loading orders…</div>
            ) : (
              orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  workingId={workingId}
                  onApprove={approve}
                  onReject={reject}
                />
              ))
            )}
          </div>

          {!loading && orders.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center text-white/40">
              <Package className="h-10 w-10 text-white/20" />
              No orders yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  glow,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  color: string;
  glow: string;
}) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${glow} ${color}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-white/40">{label}</p>
        <p className="mt-0.5 font-display text-xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function OrderRow({
  order,
  workingId,
  onApprove,
  onReject,
}: {
  order: Order;
  workingId: string | null;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  return (
    <tr className="hover:bg-white/[0.03]">
      <td className="px-5 py-4 font-mono text-xs text-white/60">
        {order.id.slice(0, 8).toUpperCase()}
      </td>
      <td className="px-5 py-4">
        <p className="font-medium text-white/90">{order.email ?? 'Unlinked'}</p>
        <p className="mt-0.5 font-mono text-[11px] text-white/30">{order.user_id ?? '—'}</p>
      </td>
      <td className="px-5 py-4 text-white/80">{order.service_name}</td>
      <td className="px-5 py-4 text-white/70">{order.quantity.toLocaleString('en-IN')}</td>
      <td className="max-w-[200px] px-5 py-4">
        <OrderLink link={order.link} />
      </td>
      <td className="px-5 py-4 font-semibold text-neon-300">{formatINR(Number(order.total_price))}</td>
      <td className="px-5 py-4">
        <StatusBadge status={order.status} />
      </td>
      <td className="px-5 py-4 text-right">
        <OrderActions
          order={order}
          workingId={workingId}
          onApprove={onApprove}
          onReject={onReject}
        />
      </td>
    </tr>
  );
}

function OrderCard({
  order,
  workingId,
  onApprove,
  onReject,
}: {
  order: Order;
  workingId: string | null;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-white/50">{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="mt-1 font-medium text-white/90">{order.email ?? 'Unlinked'}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-white/40">Service</p>
          <p className="mt-0.5 text-white/80">{order.service_name}</p>
        </div>
        <div>
          <p className="text-xs text-white/40">Quantity</p>
          <p className="mt-0.5 text-white/70">{order.quantity.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-white/40">Total</p>
          <p className="mt-0.5 font-semibold text-neon-300">{formatINR(Number(order.total_price))}</p>
        </div>
        <div>
          <p className="text-xs text-white/40">Date</p>
          <p className="mt-0.5 text-white/50">{formatDate(order.created_at)}</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs text-white/40">Link</p>
        <div className="mt-0.5">
          <OrderLink link={order.link} />
        </div>
      </div>
      <div className="mt-4">
        <OrderActions
          order={order}
          workingId={workingId}
          onApprove={onApprove}
          onReject={onReject}
        />
      </div>
    </div>
  );
}

function OrderActions({
  order,
  workingId,
  onApprove,
  onReject,
}: {
  order: Order;
  workingId: string | null;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  if (order.status !== 'Pending') {
    return <span className="text-xs text-white/30">Reviewed</span>;
  }
  const busy = workingId === order.id;
  return (
    <div className="flex justify-end gap-2">
      <button
        disabled={busy}
        onClick={() => void onApprove(order.id)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent-green/15 px-3 py-2 text-xs font-semibold text-accent-green transition hover:bg-accent-green/25 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {busy ? 'Working…' : 'Approve'}
      </button>
      <button
        disabled={busy}
        onClick={() => void onReject(order.id)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent-red/15 px-3 py-2 text-xs font-semibold text-accent-red transition hover:bg-accent-red/25 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
        {busy ? 'Working…' : 'Reject & Refund'}
      </button>
    </div>
  );
}

function OrderLink({ link }: { link: string }) {
  if (!link) return <span className="text-xs text-white/30">—</span>;
  const displayLink = link.length > 40 ? link.slice(0, 37) + '…' : link;
  return (
    <a
      href={link.startsWith('http') ? link : `https://${link}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 text-xs text-neon-300 transition hover:text-neon-200 hover:underline"
      title={link}
    >
      <span className="truncate">{displayLink}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/40" />
    </a>
  );
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const config: Record<Order['status'], { icon: typeof Clock3; classes: string }> = {
    Pending: { icon: Clock3, classes: 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber' },
    Approved: { icon: CheckCircle2, classes: 'border-accent-green/30 bg-accent-green/10 text-accent-green' },
    Completed: { icon: CheckCircle2, classes: 'border-accent-green/30 bg-accent-green/10 text-accent-green' },
    Rejected: { icon: XCircle, classes: 'border-accent-red/30 bg-accent-red/10 text-accent-red' },
    'In Progress': { icon: Loader2, classes: 'border-neon-400/30 bg-neon-500/10 text-neon-300' },
  };
  const entry = config[status] ?? config.Pending;
  const Icon = entry.icon;
  return (
    <span className={`chip border ${entry.classes}`}>
      <Icon className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
