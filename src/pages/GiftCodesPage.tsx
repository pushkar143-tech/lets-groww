import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Gift,
  History,
  Loader2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/format';

interface Redemption {
  id: string;
  code: string;
  amount_credited: number;
  redeemed_at: string;
}

export default function GiftCodesPage({ userId }: { userId: string }) {
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [history, setHistory] = useState<Redemption[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('gift_code_redemptions')
      .select('id, gift_code_id, amount_credited, redeemed_at')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false });
    if (error || !data) {
      setLoadingHistory(false);
      return;
    }
    // Resolve code names via a join-free lookup of gift_codes
    const rows = data as Array<{
      id: string;
      gift_code_id: string;
      amount_credited: number;
      redeemed_at: string;
    }>;
    if (rows.length === 0) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }
    const ids = Array.from(new Set(rows.map((r) => r.gift_code_id)));
    const { data: codeRows } = await supabase
      .from('gift_codes')
      .select('id, code')
      .in('id', ids);
    const codeMap = new Map<string, string>();
    for (const cr of (codeRows ?? []) as Array<{ id: string; code: string }>) {
      codeMap.set(cr.id, cr.code);
    }
    setHistory(
      rows.map((r) => ({
        id: r.id,
        code: codeMap.get(r.gift_code_id) ?? '—',
        amount_credited: Number(r.amount_credited),
        redeemed_at: r.redeemed_at,
      })),
    );
    setLoadingHistory(false);
  }, [userId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Live update when a new redemption is written for this user
  useEffect(() => {
    const channel = supabase
      .channel(`gift-redemptions-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gift_code_redemptions', filter: `user_id=eq.${userId}` },
        () => { void loadHistory(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, loadHistory]);

  const claimCode = async () => {
    setNotice(null);
    if (!code.trim()) {
      setNotice({ kind: 'error', message: 'Enter a gift code to claim.' });
      return;
    }
    setClaiming(true);
    const { data, error } = await supabase.rpc('redeem_gift_code', { p_code: code.trim() });
    setClaiming(false);
    if (error) {
      const msg = error.message.includes('already') ? 'You have already redeemed this code.'
        : error.message.includes('usage') ? 'This code has reached its usage limit.'
        : error.message.includes('no longer') ? 'This code is no longer active.'
        : 'Invalid or expired gift code.';
      setNotice({ kind: 'error', message: msg });
      return;
    }
    const result = data as { amount_credited?: number } | null;
    const credited = result?.amount_credited ?? 0;
    setCode('');
    setNotice({ kind: 'success', message: `${formatINR(Number(credited))} added to your wallet instantly!` });
    await loadHistory();
  };

  return (
    <section className="relative min-h-screen overflow-hidden pt-24 pb-16">
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-20" />
      <div className="absolute -top-10 left-1/2 h-56 w-[34rem] -translate-x-1/2 rounded-full bg-grape-500/10 blur-[120px]" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip border border-grape-400/30 bg-grape-500/10 text-grape-300">
            <Gift className="h-3.5 w-3.5" /> Gift Codes
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Redeem <span className="text-gradient">Gift Codes</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            Have a wallet balance gift code? Claim it here to add instant cash to your wallet. Discount promo codes are applied at checkout.
          </p>
        </div>

        {/* Claim card */}
        <div className="mx-auto mt-8 max-w-2xl">
          <div className="card relative overflow-hidden p-5 sm:p-7">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-grape-500/15 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-grape-300" />
                <h2 className="font-display text-lg font-semibold">Claim a Gift Code</h2>
              </div>
              <p className="mt-2 text-sm text-white/50">
                Enter your balance gift code below. The cash value will be credited to your wallet instantly.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setNotice(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void claimCode(); }}
                  placeholder="Enter gift code e.g. GIFT50"
                  className="input-field flex-1 font-mono"
                  maxLength={20}
                />
                <button
                  onClick={() => void claimCode()}
                  disabled={claiming}
                  className="btn-grape sm:w-auto disabled:opacity-60"
                >
                  {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                  {claiming ? 'Claiming…' : 'Claim Code'}
                </button>
              </div>
              {notice && (
                <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-3 text-sm ${notice.kind === 'success' ? 'border-accent-green/30 bg-accent-green/10 text-accent-green' : 'border-accent-red/30 bg-accent-red/10 text-accent-red'}`}>
                  {notice.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{notice.message}</span>
                </div>
              )}
              <div className="mt-4 flex items-start gap-2 text-xs text-white/40">
                <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
                Wallet balance gift codes add direct cash. For order discounts, use a promo code at checkout.
              </div>
            </div>
          </div>
        </div>

        {/* Redemption history */}
        <div className="mx-auto mt-6 max-w-2xl">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
              <History className="h-5 w-5 text-neon-300" />
              <h2 className="font-display text-lg font-semibold">Redemption History</h2>
              <span className="chip ml-auto border border-white/10 bg-white/5 text-white/50">{history.length} redeemed</span>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-white/40">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your redemptions…
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
                <Gift className="h-8 w-8 text-white/20" />
                <p className="text-sm text-white/40">No gift codes redeemed yet.</p>
                <p className="text-xs text-white/30">Claim your first code above to see it here.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                      <tr>
                        <th className="px-5 py-3 font-medium">Code</th>
                        <th className="px-5 py-3 font-medium">Amount Added</th>
                        <th className="px-5 py-3 font-medium">Date &amp; Time</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {history.map((r) => (
                        <tr key={r.id} className="transition-colors hover:bg-white/[0.03]">
                          <td className="px-5 py-3 font-mono text-xs font-semibold text-grape-300">{r.code}</td>
                          <td className="px-5 py-3 font-semibold text-accent-green">+{formatINR(r.amount_credited)}</td>
                          <td className="px-5 py-3 text-white/50">{formatDateTime(r.redeemed_at)}</td>
                          <td className="px-5 py-3">
                            <span className="chip border border-accent-green/30 bg-accent-green/10 text-accent-green">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Success
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="divide-y divide-white/5 sm:hidden">
                  {history.map((r) => (
                    <div key={r.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-grape-300">{r.code}</span>
                        <span className="chip border border-accent-green/30 bg-accent-green/10 text-accent-green">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Success
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-white/50">{formatDateTime(r.redeemed_at)}</span>
                        <span className="font-semibold text-accent-green">+{formatINR(r.amount_credited)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}
