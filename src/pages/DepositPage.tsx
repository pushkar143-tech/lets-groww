import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock3, Copy,
  Gift, IndianRupee, Loader2, LockKeyhole, Receipt, Send, ShieldCheck, Wallet,
  XCircle, Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/format';
import VerificationModal from '@/components/VerificationModal';
import UpiQrCode from '@/components/UpiQrCode';

const UPI_ID = 'chaudhary149209@fam';
const UPI_PAYEE_NAME = 'Lets Groww';
const MIN_DEPOSIT = 10;
const QUICK_AMOUNTS = [50, 100, 200, 500];

interface Deposit {
  id: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  amount_inr: number;
}

interface DepositHistoryRow {
  id: string;
  amount_inr: number;
  utr: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

interface PendingDeposit {
  id: string;
  amount: number;
  utr: string;
}

export default function DepositPage({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState(false);
  const [pendingDeposit, setPendingDeposit] = useState<PendingDeposit | null>(null);
  const [approvedAmount, setApprovedAmount] = useState<number | null>(null);
  const [deposits, setDeposits] = useState<DepositHistoryRow[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(true);

  const numericAmount = Number(amount);
  const upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_PAYEE_NAME)}&am=${numericAmount.toFixed(2)}&cu=INR`;

  const copyUpi = async () => {
    await navigator.clipboard.writeText(UPI_ID);
    setCopyNotice(true);
    window.setTimeout(() => setCopyNotice(false), 2000);
  };

  const goToStep2 = () => {
    if (!Number.isFinite(numericAmount) || numericAmount < MIN_DEPOSIT) {
      setAmountError(`Minimum deposit is ${formatINR(MIN_DEPOSIT)}.`);
      return;
    }
    setAmountError(null);
    setStep(2);
  };

  const changeAmount = () => {
    setStep(1);
    setUtr('');
    setUtrError(null);
  };

  const submitPayment = async () => {
    setUtrError(null);
    const cleanUtr = utr.replace(/\s/g, '');

    if (!Number.isFinite(numericAmount) || numericAmount < MIN_DEPOSIT) {
      setUtrError('Amount is invalid. Go back and re-enter.');
      return;
    }

    if (!/^\d{12}$/.test(cleanUtr)) {
      setUtrError('Enter the 12-digit UTR or transaction ID.');
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await supabase
      .from('deposit_requests')
      .insert({ amount_inr: numericAmount, utr: cleanUtr })
      .select('id')
      .maybeSingle();
    setIsSubmitting(false);

    if (error || !data) {
      console.error('deposit request submission failed', error);
      setUtrError('We could not submit your payment. Please try again.');
      return;
    }

    setApprovedAmount(null);
    setPendingDeposit({ id: data.id, amount: numericAmount, utr: cleanUtr });
    setAmount('');
    setUtr('');
    setStep(1);
    void loadDeposits();
  };

  const handleTimeout = async (depositId: string) => {
    const { error } = await supabase.rpc('timeout_reject_deposit', { p_deposit_id: depositId });
    if (error) {
      console.error('timeout reject failed', error);
    }
    void loadDeposits();
  };

  const closeModal = () => {
    setPendingDeposit(null);
    setApprovedAmount(null);
  };

  const loadDeposits = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDepositsLoading(false); return; }

    const { data, error } = await supabase
      .from('deposit_requests')
      .select('id, amount_inr, utr, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('load deposit history failed', error);
      setDepositsLoading(false);
      return;
    }
    setDeposits((data ?? []) as DepositHistoryRow[]);
    setDepositsLoading(false);
  }, []);

  useEffect(() => {
    void loadDeposits();

    let approvalChannel: ReturnType<typeof supabase.channel> | null = null;
    let historyChannel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      approvalChannel = supabase
        .channel(`deposit-approvals-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'deposit_requests', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const next = payload.new as Deposit;
            const prev = payload.old as Deposit;
            if (next.status === 'Approved' && prev.status !== 'Approved') {
              setApprovedAmount(Number(next.amount_inr));
            }
          },
        )
        .subscribe();

      historyChannel = supabase
        .channel(`deposit-history-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'deposit_requests', filter: `user_id=eq.${user.id}` },
          () => { void loadDeposits(); },
        )
        .subscribe();
    };

    void setup();

    return () => {
      if (approvalChannel) void supabase.removeChannel(approvalChannel);
      if (historyChannel) void supabase.removeChannel(historyChannel);
    };
  }, [loadDeposits]);

  const approvedTotal = deposits.filter((d) => d.status === 'Approved').reduce((sum, d) => sum + Number(d.amount_inr), 0);
  const pendingCount = deposits.filter((d) => d.status === 'Pending').length;

  return (
    <section className="relative min-h-screen overflow-hidden pt-24 pb-16">
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-20" />
      <div className="absolute -top-10 left-1/2 h-56 w-[34rem] -translate-x-1/2 rounded-full bg-neon-500/10 blur-[120px]" />
      <div className="absolute top-1/3 right-0 h-40 w-60 rounded-full bg-grape-500/8 blur-[100px]" />

      {pendingDeposit && (
        <VerificationModal
          amount={pendingDeposit.amount}
          utr={pendingDeposit.utr}
          depositId={pendingDeposit.id}
          onTimeout={handleTimeout}
          onClose={closeModal}
          approvedAmount={approvedAmount}
        />
      )}

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        {/* ===== 2-Step Deposit Card ===== */}
        <div className="mx-auto max-w-md">
          <div className="card relative overflow-hidden p-6 sm:p-8">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-neon-500/10 blur-3xl" />
            <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-grape-500/8 blur-3xl" />

            <div className="relative">
              {/* Branding */}
              <div className="flex flex-col items-center text-center">
                <div className="relative grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-neon-400 to-grape-500 shadow-neon">
                  <Zap className="h-6 w-6 text-ink-950" strokeWidth={2.5} />
                  <span className="absolute inset-0 rounded-xl ring-1 ring-white/30" />
                </div>
                <h1 className="mt-3 font-display text-xl font-bold tracking-tight">
                  Lets<span className="text-gradient"> Groww</span>
                </h1>
                <p className="mt-1 text-xs text-white/40">Add Funds to Your Wallet</p>
              </div>

              {/* Step indicator */}
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className={`flex items-center gap-2 ${step === 1 ? 'text-neon-300' : 'text-white/30'}`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === 1 ? 'bg-neon-500/20 text-neon-300 ring-1 ring-neon-400/40' : 'bg-white/5'}`}>1</span>
                  <span className="text-xs font-medium">Amount</span>
                </div>
                <div className={`h-px w-8 transition-colors duration-300 ${step === 2 ? 'bg-neon-400/40' : 'bg-white/10'}`} />
                <div className={`flex items-center gap-2 ${step === 2 ? 'text-neon-300' : 'text-white/30'}`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === 2 ? 'bg-neon-500/20 text-neon-300 ring-1 ring-neon-400/40' : 'bg-white/5'}`}>2</span>
                  <span className="text-xs font-medium">Pay & Submit</span>
                </div>
              </div>

              {/* ===== STEP 1: Enter Amount ===== */}
              {step === 1 && (
                <div className="mt-6 animate-[deposit-step-in_0.35s_ease-out]">
                  <label className="block">
                    <span className="mb-2 flex items-center gap-1.5 text-sm font-medium text-white/60">
                      <IndianRupee className="h-4 w-4 text-neon-300" /> Enter Amount (INR)
                    </span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-white/30">₹</span>
                      <input
                        type="number"
                        min={MIN_DEPOSIT}
                        step="1"
                        value={amount}
                        onChange={(e) => { setAmount(e.target.value); setAmountError(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') goToStep2(); }}
                        placeholder="0"
                        className="input-field !pl-9 text-center font-display text-2xl font-bold tracking-wide"
                        autoFocus
                      />
                    </div>
                  </label>

                  {/* Quick-select buttons */}
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => { setAmount(String(amt)); setAmountError(null); }}
                        className={`rounded-lg border py-2 text-sm font-semibold transition-all ${
                          numericAmount === amt
                            ? 'border-neon-400/50 bg-neon-500/15 text-neon-300'
                            : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>

                  {amountError && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-red">
                      <AlertCircle className="h-3.5 w-3.5" /> {amountError}
                    </p>
                  )}

                  <button onClick={goToStep2} className="btn-primary mt-5 w-full">
                    Proceed to Pay <ArrowRight className="h-4 w-4" />
                  </button>

                  <p className="mt-3 text-center text-xs text-white/30">
                    Minimum deposit {formatINR(MIN_DEPOSIT)} · UPI payments only
                  </p>
                </div>
              )}

              {/* ===== STEP 2: QR Payment + UTR Submission ===== */}
              {step === 2 && (
                <div className="mt-6 animate-[deposit-step-in_0.35s_ease-out]">
                  {/* Locked amount header */}
                  <div className="flex items-center justify-between rounded-xl border border-neon-400/20 bg-neon-500/5 px-4 py-3">
                    <div>
                      <p className="text-xs text-white/40">Payable Amount</p>
                      <p className="font-display text-2xl font-bold text-neon-300">{formatINR(numericAmount)}</p>
                    </div>
                    <button
                      onClick={changeAmount}
                      className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/50 transition hover:border-white/20 hover:text-white"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Change
                    </button>
                  </div>

                  {/* QR Code */}
                  <div className="mt-5 flex flex-col items-center">
                    <UpiQrCode upiLink={upiLink} size={220} />
                    <p className="mt-2 text-center text-xs text-white/40">
                      Scan with any UPI app — amount auto-fills
                    </p>
                  </div>

                  {/* UPI ID copy */}
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-white/40">UPI ID</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="font-mono text-sm font-semibold text-neon-300">{UPI_ID}</p>
                      <button
                        onClick={copyUpi}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                          copyNotice
                            ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
                            : 'border-white/10 text-white/50 hover:border-neon-400/40 hover:text-neon-300'
                        }`}
                      >
                        {copyNotice ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copyNotice ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* UTR Input */}
                  <div className="mt-5">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-white/60">Enter 12-digit UTR / Transaction ID</span>
                      <input
                        inputMode="numeric"
                        maxLength={12}
                        value={utr}
                        onChange={(e) => { setUtr(e.target.value.replace(/\D/g, '').slice(0, 12)); setUtrError(null); }}
                        placeholder="Enter 12-digit UTR"
                        className="input-field font-mono tracking-wider text-center"
                      />
                      <span className="mt-1.5 block text-center text-xs text-white/35">{utr.length}/12 digits</span>
                    </label>

                    {utrError && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-accent-red">
                        <AlertCircle className="h-3.5 w-3.5" /> {utrError}
                      </p>
                    )}
                  </div>

                  {/* Submit button */}
                  <button
                    onClick={submitPayment}
                    disabled={isSubmitting || utr.length !== 12}
                    className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                    ) : (
                      <><Send className="h-4 w-4" /> Submit Payment</>
                    )}
                  </button>

                  {/* Warning box */}
                  <div className="mt-4 space-y-2.5 rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-amber">
                      <AlertTriangle className="h-4 w-4" /> Important Rules
                    </div>
                    <ul className="space-y-1.5 text-xs leading-5 text-white/55">
                      <li className="flex gap-2">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-amber" />
                        Pay the exact entered amount ({formatINR(numericAmount)}) only. Partial or different amounts will not be verified.
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-amber" />
                        Do not submit fake, duplicate, or edited UTRs — your account may be permanently suspended.
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-amber" />
                        Balance is credited automatically shortly after UTR verification.
                      </li>
                    </ul>
                  </div>

                  {/* Trust footer */}
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/30">
                    <LockKeyhole className="h-3.5 w-3.5 text-accent-green" /> Secure UPI Payment
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== Deposit History ===== */}
        <div className="mt-8">
          <div className="card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-neon-300" />
                <h2 className="font-display text-lg font-semibold">Deposit History</h2>
                <span className="chip ml-auto border border-white/10 bg-white/5 text-white/50 sm:ml-2">{deposits.length} payments</span>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-xs text-white/40">Approved Total</span>
                  <p className="font-semibold text-accent-green">{formatINR(approvedTotal)}</p>
                </div>
                <div>
                  <span className="text-xs text-white/40">Pending</span>
                  <p className="font-semibold text-accent-amber">{pendingCount}</p>
                </div>
              </div>
            </div>

            {depositsLoading ? (
              <div className="px-5 py-12 text-center text-sm text-white/40">Loading deposit history…</div>
            ) : deposits.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-white/40">No deposit requests yet. Your payment history will appear here.</div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                      <tr>
                        <th className="px-5 py-3 font-medium">Date / Time</th>
                        <th className="px-5 py-3 font-medium">Amount</th>
                        <th className="px-5 py-3 font-medium">UTR Number</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {deposits.map((d) => (
                        <tr key={d.id} className="transition-colors hover:bg-white/[0.03]">
                          <td className="px-5 py-3 text-white/50">{formatDepositDate(d.created_at)}</td>
                          <td className="px-5 py-3 font-semibold text-neon-300">{formatINR(Number(d.amount_inr))}</td>
                          <td className="px-5 py-3 font-mono text-white/70">{d.utr}</td>
                          <td className="px-5 py-3"><DepositStatus status={d.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="divide-y divide-white/5 md:hidden">
                  {deposits.map((d) => (
                    <div key={d.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neon-300">{formatINR(Number(d.amount_inr))}</span>
                        <DepositStatus status={d.status} />
                      </div>
                      <p className="mt-2 font-mono text-xs text-white/50">{d.utr}</p>
                      <p className="mt-1 text-xs text-white/40">{formatDepositDate(d.created_at)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ===== Gift code shortcut ===== */}
        <div className="mx-auto mt-6 max-w-md">
          <button
            onClick={() => onNavigate('redeem-gift-code')}
            className="card group relative flex w-full items-center gap-4 overflow-hidden p-5 text-left transition-colors hover:border-grape-400/40"
          >
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-grape-500/15 blur-2xl" />
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-grape-500/15 text-grape-300">
              <Gift className="h-5 w-5" />
            </span>
            <div className="relative flex-1">
              <h2 className="font-display text-base font-semibold">Have a Gift Code?</h2>
              <p className="mt-0.5 text-sm text-white/50">Redeem wallet balance gift codes for instant cash on the Gift Codes page.</p>
            </div>
            <ArrowRight className="relative h-5 w-5 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-grape-300" />
          </button>
        </div>
      </div>
    </section>
  );
}

function DepositStatus({ status }: { status: DepositHistoryRow['status'] }) {
  const config = {
    Pending: { icon: Clock3, classes: 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber' },
    Approved: { icon: CheckCircle2, classes: 'border-accent-green/30 bg-accent-green/10 text-accent-green' },
    Rejected: { icon: XCircle, classes: 'border-accent-red/30 bg-accent-red/10 text-accent-red' },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`chip border ${config.classes}`}>
      <Icon className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

function formatDepositDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
