import { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Clock, Loader2, RotateCcw, Timer, X, XCircle } from 'lucide-react';
import { formatINR } from '@/lib/format';

type VerifyState = 'verifying' | 'approved' | 'timed_out';

interface VerificationModalProps {
  amount: number;
  utr: string;
  depositId: string;
  /** Called when the timer hits 00:00 and the deposit is still pending — DepositPage rejects the row */
  onTimeout: (depositId: string) => Promise<void>;
  /** Called when the user dismisses the modal (approved, timed out, or manual close) */
  onClose: () => void;
  /** Deposit was approved externally (realtime). If true, the modal switches to the approved state. */
  approvedAmount: number | null;
}

const COUNTDOWN_SECONDS = 180;
const NEON_PALETTE = ['#00d2ff', '#22d3ee', '#4ade80', '#a855f7', '#facc15', '#60a5fa'];

export default function VerificationModal({ amount, utr, depositId, onTimeout, onClose, approvedAmount }: VerificationModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [state, setState] = useState<VerifyState>('verifying');
  const timedOutRef = useRef(false);
  const approvedRef = useRef(false);

  // Watch for external approval (realtime UPDATE on deposit_requests)
  useEffect(() => {
    if (approvedAmount != null && !approvedRef.current) {
      approvedRef.current = true;
      setState('approved');
      fireConfetti();
    }
  }, [approvedAmount]);

  // Countdown ticker
  useEffect(() => {
    if (state !== 'verifying') return;

    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state]);

  // When timer hits 0, trigger timeout rejection
  useEffect(() => {
    if (secondsLeft !== 0 || state !== 'verifying' || timedOutRef.current) return;
    timedOutRef.current = true;
    setState('timed_out');
    void onTimeout(depositId);
  }, [secondsLeft, state, depositId, onTimeout]);

  const fireConfetti = useCallback(() => {
    const colors = NEON_PALETTE;
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.9 }, colors, disableForReducedMotion: true, scalar: 0.9 });
    const t1 = window.setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0.1, y: 0.9 }, colors, disableForReducedMotion: true, scalar: 0.9 }), 150);
    const t2 = window.setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 0.9, y: 0.9 }, colors, disableForReducedMotion: true, scalar: 0.9 }), 150);
    const t3 = window.setTimeout(() => confetti({ particleCount: 40, spread: 100, startVelocity: 45, origin: { y: 0.2 }, colors, disableForReducedMotion: true, scalar: 0.8 }), 300);
    window.setTimeout(() => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); }, 2500);
  }, []);

  // Lock scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state !== 'verifying') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, state]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const isUrgent = secondsLeft <= 30 && state === 'verifying';
  const progressPercent = (secondsLeft / COUNTDOWN_SECONDS) * 100;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-md" />

      {/* Ambient glows */}
      <div className={`pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] transition-colors duration-500 ${state === 'approved' ? 'bg-accent-green/20' : state === 'timed_out' ? 'bg-accent-red/15' : 'bg-neon-500/10'}`} />

      <div className="relative z-10 mx-4 w-full max-w-md animate-[order-success-pop_0.45s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="card relative overflow-hidden p-8 text-center shadow-glow">
          <div className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl transition-colors duration-500 ${state === 'approved' ? 'bg-accent-green/20' : state === 'timed_out' ? 'bg-accent-red/15' : 'bg-neon-500/10'}`} />
          <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-neon-500/10 blur-3xl" />

          {state !== 'verifying' && (
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white/70"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div className="relative">
            {/* ---- VERIFYING STATE ---- */}
            {state === 'verifying' && (
              <>
                {/* Timer icon with pulsing ring */}
                <div className="relative mx-auto h-24 w-24">
                  <div className={`absolute inset-0 animate-ping rounded-full ${isUrgent ? 'bg-accent-red/20' : 'bg-neon-500/15'}`} />
                  <div className={`absolute inset-0 rounded-full blur-xl ${isUrgent ? 'bg-accent-red/15' : 'bg-neon-500/10'}`} />
                  <div className={`relative grid h-24 w-24 place-items-center rounded-full border ${isUrgent ? 'border-accent-red/30 bg-accent-red/10' : 'border-neon-400/30 bg-neon-500/10'}`}>
                    <Timer className={`h-11 w-11 ${isUrgent ? 'text-accent-red' : 'text-neon-300'}`} strokeWidth={2.2} />
                  </div>
                </div>

                {/* Countdown display */}
                <div className="mt-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-white/40">Verifying Payment</p>
                  <div className={`mt-2 font-mono text-5xl font-bold tabular-nums tracking-wider transition-colors duration-300 ${isUrgent ? 'text-accent-red' : 'text-white'}`}>
                    {timeStr}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mx-auto mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-linear ${isUrgent ? 'bg-accent-red' : 'bg-gradient-to-r from-neon-400 to-neon-500'}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Amount + UTR badges */}
                <div className="mt-5 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
                    <span className="text-white/40">Amount:</span>
                    <span className="font-semibold text-neon-300">{formatINR(amount)}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
                    <span className="text-white/40">UTR:</span>
                    <span className="font-mono font-semibold text-white">{utr}</span>
                  </span>
                </div>

                {/* Status text */}
                <p className="mx-auto mt-5 flex max-w-xs items-center justify-center gap-2 text-sm leading-6 text-white/50">
                  <Loader2 className="h-4 w-4 animate-spin text-neon-300" />
                  Waiting for payment confirmation…
                </p>
              </>
            )}

            {/* ---- APPROVED STATE ---- */}
            {state === 'approved' && (
              <>
                <div className="relative mx-auto h-24 w-24">
                  <div className="absolute inset-0 animate-ping rounded-full bg-accent-green/20" />
                  <div className="absolute inset-0 rounded-full bg-accent-green/15 blur-xl" />
                  <div className="relative grid h-24 w-24 place-items-center rounded-full border border-accent-green/30 bg-accent-green/10">
                    <CheckCircle2 className="h-12 w-12 text-accent-green" strokeWidth={2.2} />
                  </div>
                </div>

                <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-white">
                  Payment Successful ✅
                </h2>

                <div className="mt-5 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
                    <span className="text-white/40">Amount:</span>
                    <span className="font-semibold text-accent-green">{formatINR(approvedAmount ?? amount)}</span>
                  </span>
                </div>

                <p className="mx-auto mt-5 max-w-xs text-sm leading-6 text-white/50">
                  Your deposit has been verified and added to your wallet.
                </p>

                <button onClick={onClose} className="btn-primary mt-7 w-full">
                  <CheckCircle2 className="h-4 w-4" /> Continue
                </button>
              </>
            )}

            {/* ---- TIMED OUT STATE ---- */}
            {state === 'timed_out' && (
              <>
                <div className="relative mx-auto h-24 w-24">
                  <div className="absolute inset-0 rounded-full bg-accent-red/15 blur-xl" />
                  <div className="relative grid h-24 w-24 place-items-center rounded-full border border-accent-red/30 bg-accent-red/10">
                    <XCircle className="h-12 w-12 text-accent-red" strokeWidth={2.2} />
                  </div>
                </div>

                <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-white">
                  Payment Timed Out ❌
                </h2>

                <div className="mt-5 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
                    <span className="text-white/40">Amount:</span>
                    <span className="font-semibold text-accent-red">{formatINR(amount)}</span>
                  </span>
                </div>

                <p className="mx-auto mt-5 max-w-xs text-sm leading-6 text-white/50">
                  Your deposit request was not verified within 3 minutes and has been rejected. Please try again.
                </p>

                <button onClick={onClose} className="btn-primary mt-7 w-full">
                  <RotateCcw className="h-4 w-4" /> Try Again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
