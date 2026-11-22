import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, X } from 'lucide-react';

interface SuccessModalProps {
  title: string;
  subtitle: string;
  /** Detail badges shown below the title — label/value pairs */
  badges?: { label: string; value: string }[];
  /** Primary button label + handler (optional) */
  primaryAction?: { label: string; icon?: typeof CheckCircle2; onClick: () => void };
  /** Secondary button label + handler (optional) */
  secondaryAction?: { label: string; icon?: typeof CheckCircle2; onClick: () => void };
  onClose: () => void;
}

const NEON_PALETTE = ['#00d2ff', '#22d3ee', '#4ade80', '#a855f7', '#facc15', '#60a5fa'];

export default function SuccessModal({
  title,
  subtitle,
  badges,
  primaryAction,
  secondaryAction,
  onClose,
}: SuccessModalProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Fire canvas-confetti burst once on mount
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const colors = NEON_PALETTE;

    // Initial burst from bottom-center
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.9 },
      colors,
      disableForReducedMotion: true,
      scalar: 0.9,
    });

    // Side cannons — left and right
    const fireSide = (x: number, angle: number) => {
      confetti({
        particleCount: 50,
        angle,
        spread: 55,
        origin: { x, y: 0.9 },
        colors,
        disableForReducedMotion: true,
        scalar: 0.9,
      });
    };

    const t1 = window.setTimeout(() => fireSide(0.1, 60), 150);
    const t2 = window.setTimeout(() => fireSide(0.9, 120), 150);

    // Second smaller top burst
    const t3 = window.setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 100,
        startVelocity: 45,
        origin: { y: 0.2 },
        colors,
        disableForReducedMotion: true,
        scalar: 0.8,
      });
    }, 300);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-md" onClick={onClose} />

      {/* Ambient glows */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-green/15 blur-[100px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-500/10 blur-[120px]" />

      <div className="relative z-10 mx-4 w-full max-w-md animate-[order-success-pop_0.45s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="card relative overflow-hidden p-8 text-center shadow-glow">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-green/20 blur-3xl" />
          <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-neon-500/15 blur-3xl" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white/70"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative">
            {/* Glowing checkmark */}
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 animate-ping rounded-full bg-accent-green/20" />
              <div className="absolute inset-0 rounded-full bg-accent-green/15 blur-xl" />
              <div className="relative grid h-24 w-24 place-items-center rounded-full border border-accent-green/30 bg-accent-green/10">
                <CheckCircle2 className="h-12 w-12 text-accent-green" strokeWidth={2.2} />
              </div>
            </div>

            {/* Heading */}
            <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-white">
              {title}
            </h2>

            {/* Detail badges */}
            {badges && badges.length > 0 && (
              <div className="mt-5 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
                {badges.map((b) => (
                  <span
                    key={b.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm"
                  >
                    <span className="text-white/40">{b.label}</span>
                    <span className="font-semibold text-neon-300">{b.value}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Subtitle */}
            <p className="mx-auto mt-5 max-w-xs text-sm leading-6 text-white/50">
              {subtitle}
            </p>

            {/* Actions */}
            <div className="mt-7 flex flex-col gap-3">
              {primaryAction && (
                <button onClick={primaryAction.onClick} className="btn-primary w-full">
                  {primaryAction.icon && <primaryAction.icon className="h-4 w-4" />} {primaryAction.label}
                </button>
              )}
              {secondaryAction && (
                <button
                  onClick={secondaryAction.onClick}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-transparent px-6 py-3 text-sm font-semibold text-white/70 transition-all duration-300 hover:border-neon-400/40 hover:bg-white/5 hover:text-white"
                >
                  {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4" />} {secondaryAction.label}
                </button>
              )}
              {!primaryAction && !secondaryAction && (
                <button onClick={onClose} className="btn-primary w-full">
                  <CheckCircle2 className="h-4 w-4" /> Continue
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
