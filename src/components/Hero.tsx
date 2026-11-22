import { Rocket, Eye, ChevronRight, ShieldCheck, Sparkles } from 'lucide-react';
import { platformIcon } from '@/components/platformIcons';
import type { Platform } from '@/data/services';

interface HeroProps {
  onNavigate: (v: string) => void;
}

export default function Hero({ onNavigate }: HeroProps) {
  const platforms = Object.keys(platformIcon) as Platform[];

  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36">
      {/* Background layers */}
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-40" />
      <div className="absolute inset-0 bg-radial-fade" />
      <div className="absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-neon-500/20 blur-[120px]" />
      <div className="absolute top-32 -right-20 h-64 w-64 rounded-full bg-grape-500/20 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* badge */}
          <span className="chip border border-neon-400/30 bg-neon-500/10 text-neon-300 animate-pulseGlow">
            <Sparkles className="h-3.5 w-3.5" /> India's Fastest SMM Panel
          </span>

          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            Boost Your Social Presence{' '}
            <span className="text-gradient">Instantly</span> with Lets Groww
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-white/60 sm:text-lg">
            Premium quality <span className="text-white">followers, likes &amp; views</span> for
            Instagram, YouTube, Facebook, X, Telegram and more — delivered at{' '}
            <span className="text-neon-300">ultra-cheap rates</span> with instant start.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => onNavigate('dashboard')} className="btn-primary w-full sm:w-auto">
              <Rocket className="h-4 w-4" /> Get Started Now
            </button>
            <button onClick={() => onNavigate('services')} className="btn-ghost w-full sm:w-auto">
              <Eye className="h-4 w-4" /> View Pricing &amp; Services
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Platform pills */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {platforms.map((p) => {
              const Icon = platformIcon[p];
              return (
                <span
                  key={p}
                  className="chip border border-white/10 bg-white/5 text-white/70 hover:border-neon-400/40 hover:text-neon-200"
                >
                  <Icon className="h-3.5 w-3.5" /> {p}
                </span>
              );
            })}
          </div>
        </div>

        {/* Floating stat card */}
        <div className="relative mx-auto mt-14 max-w-2xl animate-floaty">
          <div className="card relative overflow-hidden p-5 shadow-glow">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-grape-500/30 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-neon-500/15 text-neon-300">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Safe, Secure &amp; Anonymous</p>
                <p className="text-xs text-white/50">
                  No password required. Encrypted payments. 100% confidential delivery.
                </p>
              </div>
              <span className="hidden rounded-lg bg-accent-green/15 px-3 py-1 text-xs font-semibold text-accent-green sm:block">
                Live
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
