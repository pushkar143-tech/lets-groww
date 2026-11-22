import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Gift, Loader2, Package, RefreshCw, Settings2, ShieldCheck, Users, Wallet, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/format';

interface AdminDepositsProps {
  onNavigate: (view: string) => void;
}

interface Deposit {
  id: string;
  user_id: string | null;
  amount_inr: number;
  utr: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
  email?: string;
}

export default function AdminDepositsPage({ onNavigate }: AdminDepositsProps) {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const loadDeposits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('deposit_requests').select('id, user_id, amount_inr, utr, status, created_at').order('created_at', { ascending: false });
    if (error) {
      console.error('admin deposits load failed', error);
      setMessage({ kind: 'error', text: 'Could not load deposit requests.' });
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Deposit[];
    const ids = rows.flatMap((row) => row.user_id ? [row.user_id] : []);
    const { data: profiles } = ids.length ? await supabase.from('profiles').select('id, email').in('id', ids) : { data: [] };
    const emailById = new Map((profiles ?? []).map((profile) => [profile.id as string, profile.email as string]));
    setDeposits(rows.map((row) => ({ ...row, email: row.user_id ? emailById.get(row.user_id) : undefined })));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDeposits();
    const channel = supabase.channel('admin-deposit-requests').on('postgres_changes', { event: '*', schema: 'public', table: 'deposit_requests' }, () => { void loadDeposits(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadDeposits]);

  const review = async (id: string, approve: boolean) => {
    setWorkingId(id);
    setMessage(null);
    const { error } = await supabase.rpc('approve_deposit', { p_deposit_id: id, p_approve: approve });
    setWorkingId(null);
    if (error) {
      console.error('admin deposit review failed', error);
      setMessage({ kind: 'error', text: 'This request could not be reviewed. It may already be processed.' });
      return;
    }
    setMessage({ kind: 'success', text: approve ? 'Deposit approved and wallet credited.' : 'Deposit rejected without changing the wallet.' });
    await loadDeposits();
  };

  return (
    <section className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-20" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="chip border border-grape-400/30 bg-grape-500/10 text-grape-300"><ShieldCheck className="h-3.5 w-3.5" /> Admin Panel</span>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Deposit <span className="text-gradient">Requests</span></h1>
            <p className="mt-2 text-sm text-white/50">Review UPI payments and credit approved amounts to user wallets.</p>
          </div>
          <button onClick={() => void loadDeposits()} className="btn-ghost w-fit !px-4 !py-2"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => onNavigate('admin-deposits')} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${'border-grape-400/40 bg-grape-500/15 text-grape-200'}`}><Wallet className="h-4 w-4" /> Deposits</button>
          <button onClick={() => onNavigate('admin-orders')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white"><Package className="h-4 w-4" /> Orders</button>
          <button onClick={() => onNavigate('admin-services')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white"><Settings2 className="h-4 w-4" /> Services</button>
          <button onClick={() => onNavigate('admin-gift-codes')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white"><Gift className="h-4 w-4" /> Gift Codes</button>
          <button onClick={() => onNavigate('admin-users')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white"><Users className="h-4 w-4" /> Users</button>
        </div>

        {message && <div className={`mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${message.kind === 'success' ? 'border-accent-green/30 bg-accent-green/10 text-accent-green' : 'border-accent-red/30 bg-accent-red/10 text-accent-red'}`}>{message.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {message.text}</div>}

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-ink-850/70 backdrop-blur-xl">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40"><tr><th className="px-5 py-3">User Email / ID</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">UTR Number</th><th className="px-5 py-3">Date / Time</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-white/5">{loading ? <LoadingRow /> : deposits.map((deposit) => <DepositRow key={deposit.id} deposit={deposit} workingId={workingId} onReview={review} />)}</tbody>
            </table>
          </div>
          <div className="divide-y divide-white/5 md:hidden">{loading ? <div className="p-8 text-center text-white/40">Loading requests…</div> : deposits.map((deposit) => <DepositCard key={deposit.id} deposit={deposit} workingId={workingId} onReview={review} />)}</div>
          {!loading && deposits.length === 0 && <div className="p-12 text-center text-white/40">No deposit requests yet.</div>}
        </div>
      </div>
    </section>
  );
}

function LoadingRow() { return <tr><td colSpan={6} className="px-5 py-12 text-center text-white/40">Loading requests…</td></tr>; }

function DepositRow({ deposit, workingId, onReview }: { deposit: Deposit; workingId: string | null; onReview: (id: string, approve: boolean) => Promise<void> }) {
  return <tr className="hover:bg-white/[0.03]"><td className="px-5 py-4"><p className="font-medium text-white/90">{deposit.email ?? 'Unlinked request'}</p><p className="mt-1 font-mono text-[11px] text-white/30">{deposit.user_id ?? deposit.id}</p></td><td className="px-5 py-4 font-semibold text-neon-300">{formatINR(Number(deposit.amount_inr))}</td><td className="px-5 py-4 font-mono text-white/70">{deposit.utr}</td><td className="px-5 py-4 text-white/50">{formatDate(deposit.created_at)}</td><td className="px-5 py-4"><Status status={deposit.status} /></td><td className="px-5 py-4 text-right"><Actions deposit={deposit} workingId={workingId} onReview={onReview} /></td></tr>;
}

function DepositCard({ deposit, workingId, onReview }: { deposit: Deposit; workingId: string | null; onReview: (id: string, approve: boolean) => Promise<void> }) { return <div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-white/90">{deposit.email ?? 'Unlinked request'}</p><p className="mt-1 font-mono text-[11px] text-white/30">{deposit.user_id ?? deposit.id}</p></div><Status status={deposit.status} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-white/40">Amount</p><p className="mt-1 font-semibold text-neon-300">{formatINR(Number(deposit.amount_inr))}</p></div><div><p className="text-xs text-white/40">UTR</p><p className="mt-1 font-mono text-white/75">{deposit.utr}</p></div></div><p className="mt-3 text-xs text-white/40">{formatDate(deposit.created_at)}</p><div className="mt-4"><Actions deposit={deposit} workingId={workingId} onReview={onReview} /></div></div>; }

function Actions({ deposit, workingId, onReview }: { deposit: Deposit; workingId: string | null; onReview: (id: string, approve: boolean) => Promise<void> }) { if (deposit.status !== 'Pending') return <span className="text-xs text-white/30">Reviewed</span>; const busy = workingId === deposit.id; return <div className="flex justify-end gap-2"><button disabled={busy} onClick={() => void onReview(deposit.id, true)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-green/15 px-3 py-2 text-xs font-semibold text-accent-green transition hover:bg-accent-green/25 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> {busy ? 'Working…' : 'Approve'}</button><button disabled={busy} onClick={() => void onReview(deposit.id, false)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-red/15 px-3 py-2 text-xs font-semibold text-accent-red transition hover:bg-accent-red/25 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Reject</button></div>; }

function Status({ status }: { status: Deposit['status'] }) { const config = { Pending: { icon: Clock3, classes: 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber' }, Approved: { icon: CheckCircle2, classes: 'border-accent-green/30 bg-accent-green/10 text-accent-green' }, Rejected: { icon: XCircle, classes: 'border-accent-red/30 bg-accent-red/10 text-accent-red' } }[status]; const Icon = config.icon; return <span className={`chip border ${config.classes}`}><Icon className="h-3.5 w-3.5" /> {status}</span>; }

function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
