import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Gift,
  Loader2,
  Megaphone,
  Package,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Tag,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/format';

interface GiftCode {
  id: string;
  code: string;
  amount_inr: number;
  max_uses: number;
  times_used: number;
  is_active: boolean;
  created_at: string;
}

interface PromoCode {
  id: string;
  code: string;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  max_uses: number | null;
  times_used: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface AdminGiftCodesProps {
  onNavigate: (view: string) => void;
}

export default function AdminGiftCodesPage({ onNavigate }: AdminGiftCodesProps) {
  const [tab, setTab] = useState<'wallet' | 'promo'>('wallet');
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Wallet code form
  const [wcCode, setWcCode] = useState('');
  const [wcAmount, setWcAmount] = useState('');
  const [wcMaxUses, setWcMaxUses] = useState('1');
  const [creatingWc, setCreatingWc] = useState(false);

  // Promo code form
  const [pcCode, setPcCode] = useState('');
  const [pcType, setPcType] = useState<'percent' | 'flat'>('percent');
  const [pcValue, setPcValue] = useState('');
  const [pcMaxUses, setPcMaxUses] = useState('');
  const [pcExpires, setPcExpires] = useState('');
  const [creatingPc, setCreatingPc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [giftRes, promoRes] = await Promise.all([
      supabase.from('gift_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
    ]);
    if (giftRes.data) setGiftCodes(giftRes.data as GiftCode[]);
    if (promoRes.data) setPromoCodes(promoRes.data as PromoCode[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createWalletCode = async () => {
    setCreatingWc(true);
    setMessage(null);
    if (!wcCode.trim() || !wcAmount) {
      setMessage({ kind: 'error', text: 'Enter a code and amount.' });
      setCreatingWc(false);
      return;
    }
    const { error } = await supabase.rpc('create_gift_code', {
      p_code: wcCode.trim(),
      p_amount: Number(wcAmount),
      p_max_uses: Number(wcMaxUses) || 1,
    });
    setCreatingWc(false);
    if (error) {
      setMessage({ kind: 'error', text: error.message.includes('duplicate') ? 'Code already exists.' : 'Could not create the code.' });
      return;
    }
    setMessage({ kind: 'success', text: `Wallet code "${wcCode.trim().toUpperCase()}" created.` });
    setWcCode('');
    setWcAmount('');
    setWcMaxUses('1');
    await load();
  };

  const createPromoCode = async () => {
    setCreatingPc(true);
    setMessage(null);
    if (!pcCode.trim() || !pcValue) {
      setMessage({ kind: 'error', text: 'Enter a code and discount value.' });
      setCreatingPc(false);
      return;
    }
    const { error } = await supabase.rpc('create_promo_code', {
      p_code: pcCode.trim(),
      p_type: pcType,
      p_value: Number(pcValue),
      p_max_uses: pcMaxUses ? Number(pcMaxUses) : null,
      p_expires: pcExpires ? new Date(pcExpires).toISOString() : null,
    });
    setCreatingPc(false);
    if (error) {
      setMessage({ kind: 'error', text: error.message.includes('duplicate') ? 'Code already exists.' : 'Could not create the promo code.' });
      return;
    }
    setMessage({ kind: 'success', text: `Promo code "${pcCode.trim().toUpperCase()}" created.` });
    setPcCode('');
    setPcValue('');
    setPcMaxUses('');
    setPcExpires('');
    await load();
  };

  const deleteGiftCode = async (id: string) => {
    const { error } = await supabase.rpc('deactivate_gift_code', { p_id: id });
    if (error) {
      setMessage({ kind: 'error', text: 'Could not delete the code.' });
      return;
    }
    setMessage({ kind: 'success', text: 'Gift code deleted.' });
    await load();
  };

  const deletePromoCode = async (id: string) => {
    const { error } = await supabase.rpc('deactivate_promo_code', { p_id: id });
    if (error) {
      setMessage({ kind: 'error', text: 'Could not delete the promo code.' });
      return;
    }
    setMessage({ kind: 'success', text: 'Promo code deleted.' });
    await load();
  };

  const randomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

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
              Gift Code <span className="text-gradient">Manager</span>
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Create wallet balance gift codes and discount promo codes for your users.
            </p>
          </div>
          <button onClick={() => void load()} className="btn-ghost w-fit !px-4 !py-2">
            <RefreshCw className="h-4 w-4" /> Refresh
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
            <Settings2 className="h-4 w-4" /> Services
          </button>
          <button onClick={() => onNavigate('admin-gift-codes')} className="inline-flex items-center gap-2 rounded-xl border border-grape-400/40 bg-grape-500/15 px-4 py-2.5 text-sm font-medium text-grape-200 transition">
            <Gift className="h-4 w-4" /> Gift Codes
          </button>
          <button onClick={() => onNavigate('admin-users')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white">
            <Users className="h-4 w-4" /> Users
          </button>
        </div>

        {message && (
          <div className={`mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${message.kind === 'success' ? 'border-accent-green/30 bg-accent-green/10 text-accent-green' : 'border-accent-red/30 bg-accent-red/10 text-accent-red'}`}>
            {message.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* Type tabs */}
        <div className="mt-6 flex gap-2">
          <button onClick={() => setTab('wallet')} className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${tab === 'wallet' ? 'border-neon-400/50 bg-neon-500/15 text-neon-200' : 'border-white/10 bg-white/5 text-white/50 hover:text-white'}`}>
            <Wallet className="h-4 w-4" /> Wallet Balance Codes
          </button>
          <button onClick={() => setTab('promo')} className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${tab === 'promo' ? 'border-grape-400/50 bg-grape-500/15 text-grape-200' : 'border-white/10 bg-white/5 text-white/50 hover:text-white'}`}>
            <Tag className="h-4 w-4" /> Discount Promo Codes
          </button>
        </div>

        {tab === 'wallet' ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* Create form */}
            <div className="card h-fit p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-neon-300" />
                <h2 className="font-display text-lg font-semibold">Create Wallet Code</h2>
              </div>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50">Code</span>
                  <div className="flex gap-2">
                    <input value={wcCode} onChange={(e) => setWcCode(e.target.value.toUpperCase())} placeholder="GIFT50" className="input-field flex-1 font-mono" maxLength={20} />
                    <button onClick={() => setWcCode(randomCode())} className="rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/50 hover:text-white" type="button">Random</button>
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50">Amount (INR)</span>
                  <input type="number" value={wcAmount} onChange={(e) => setWcAmount(e.target.value)} placeholder="50" className="input-field" min="1" step="any" />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50">Max Redemptions</span>
                  <input type="number" value={wcMaxUses} onChange={(e) => setWcMaxUses(e.target.value)} placeholder="1" className="input-field" min="1" />
                  <p className="mt-1 text-xs text-white/35">How many users can redeem this code.</p>
                </label>
                <button onClick={() => void createWalletCode()} disabled={creatingWc} className="btn-primary w-full disabled:opacity-60">
                  {creatingWc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                  {creatingWc ? 'Creating…' : 'Create Code'}
                </button>
              </div>
            </div>

            {/* Table */}
            <CodeTable
              loading={loading}
              empty="No wallet codes created yet."
              headers={['Code', 'Amount', 'Used', 'Limit', 'Status', 'Created', 'Action']}
              rows={giftCodes.map((c) => ({
                id: c.id,
                cells: [
                  <span key="code" className="font-mono font-semibold text-neon-300">{c.code}</span>,
                  <span key="amt" className="font-semibold text-white">{formatINR(Number(c.amount_inr))}</span>,
                  <span key="used" className="text-white/70">{c.times_used}</span>,
                  <span key="max" className="text-white/50">{c.max_uses}</span>,
                  <span key="status" className={`chip border ${c.is_active ? 'border-accent-green/30 bg-accent-green/10 text-accent-green' : 'border-accent-red/30 bg-accent-red/10 text-accent-red'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>,
                  <span key="date" className="text-xs text-white/40">{formatDate(c.created_at)}</span>,
                ],
                onDelete: () => void deleteGiftCode(c.id),
              }))}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* Create form */}
            <div className="card h-fit p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-grape-300" />
                <h2 className="font-display text-lg font-semibold">Create Promo Code</h2>
              </div>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50">Code</span>
                  <div className="flex gap-2">
                    <input value={pcCode} onChange={(e) => setPcCode(e.target.value.toUpperCase())} placeholder="SAVE10" className="input-field flex-1 font-mono" maxLength={20} />
                    <button onClick={() => setPcCode(randomCode())} className="rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/50 hover:text-white" type="button">Random</button>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-white/50">Discount Type</span>
                    <select value={pcType} onChange={(e) => setPcType(e.target.value as 'percent' | 'flat')} className="input-field">
                      <option value="percent" className="bg-ink-850">Percentage %</option>
                      <option value="flat" className="bg-ink-850">Flat ₹</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-white/50">Value</span>
                    <input type="number" value={pcValue} onChange={(e) => setPcValue(e.target.value)} placeholder={pcType === 'percent' ? '10' : '20'} className="input-field" min="1" step="any" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-white/50">Max Uses (optional)</span>
                    <input type="number" value={pcMaxUses} onChange={(e) => setPcMaxUses(e.target.value)} placeholder="Unlimited" className="input-field" min="1" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-white/50">Expiry Date (optional)</span>
                    <input type="date" value={pcExpires} onChange={(e) => setPcExpires(e.target.value)} className="input-field" />
                  </label>
                </div>
                <button onClick={() => void createPromoCode()} disabled={creatingPc} className="btn-grape w-full disabled:opacity-60">
                  {creatingPc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                  {creatingPc ? 'Creating…' : 'Create Promo Code'}
                </button>
              </div>
            </div>

            {/* Table */}
            <CodeTable
              loading={loading}
              empty="No promo codes created yet."
              headers={['Code', 'Type', 'Value', 'Used', 'Limit', 'Expiry', 'Action']}
              rows={promoCodes.map((c) => ({
                id: c.id,
                cells: [
                  <span key="code" className="font-mono font-semibold text-grape-300">{c.code}</span>,
                  <span key="type" className="text-white/70">{c.discount_type === 'percent' ? 'Percentage' : 'Flat'}</span>,
                  <span key="val" className="font-semibold text-white">{c.discount_type === 'percent' ? `${c.discount_value}%` : formatINR(Number(c.discount_value))}</span>,
                  <span key="used" className="text-white/70">{c.times_used}</span>,
                  <span key="max" className="text-white/50">{c.max_uses ?? 'Unlimited'}</span>,
                  <span key="exp" className="text-xs text-white/40">{c.expires_at ? formatDate(c.expires_at) : 'Never'}</span>,
                ],
                onDelete: () => void deletePromoCode(c.id),
              }))}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function CodeTable({
  loading,
  empty,
  headers,
  rows,
}: {
  loading: boolean;
  empty: string;
  headers: string[];
  rows: Array<{ id: string; cells: React.ReactNode[]; onDelete: () => void }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-850/70 backdrop-blur-xl">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
            <tr>
              {headers.map((h, i) => (
                <th key={h} className={`px-5 py-3 ${i === headers.length - 1 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={headers.length} className="px-5 py-12 text-center text-white/40">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={headers.length} className="px-5 py-12 text-center text-white/40">{empty}</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  {r.cells.map((cell, i) => (
                    <td key={i} className={`px-5 py-4 ${i === r.cells.length - 1 ? 'text-right' : ''}`}>{cell}</td>
                  ))}
                  <td className="px-5 py-4 text-right">
                    <button onClick={r.onDelete} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-red/15 px-3 py-2 text-xs font-semibold text-accent-red transition hover:bg-accent-red/25">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-white/5 md:hidden">
        {loading ? <div className="p-8 text-center text-white/40">Loading…</div> : rows.length === 0 ? <div className="p-8 text-center text-white/40">{empty}</div> : rows.map((r) => (
          <div key={r.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>{r.cells[0]}</div>
              <div>{r.cells[1]}</div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/40">
              <span>Used: {r.cells[3]} / {r.cells[4]}</span>
              {r.cells[5]}
            </div>
            <div className="mt-3">
              <button onClick={r.onDelete} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-red/15 px-3 py-2 text-xs font-semibold text-accent-red transition hover:bg-accent-red/25">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}
