import { CheckCircle2, Users, Layers } from 'lucide-react';
import { useCountUp, formatCompact } from '@/lib/format';

const stats = [
  { label: 'Orders Completed', value: 10_000_000, suffix: '+', icon: CheckCircle2, color: 'text-neon-300', glow: 'bg-neon-500/15' },
  { label: 'Happy Clients', value: 50_000, suffix: '+', icon: Users, color: 'text-grape-300', glow: 'bg-grape-500/15' },
  { label: 'Services', value: 500, suffix: '+', icon: Layers, color: 'text-accent-green', glow: 'bg-accent-green/15' },
];

export default function LiveCounters() {
  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  color,
  glow,
}: {
  label: string;
  value: number;
  suffix: string;
  icon: typeof CheckCircle2;
  color: string;
  glow: string;
}) {
  const { display, ref } = useCountUp(value);
  return (
    <div className="card group relative overflow-hidden p-6 text-center transition-all duration-300 hover:border-white/20">
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full ${glow} blur-2xl transition-opacity group-hover:opacity-80`} />
      <span className={`mx-auto grid h-12 w-12 place-items-center rounded-xl ${glow} ${color}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div ref={ref} className="mt-4 font-display text-4xl font-bold tracking-tight text-white">
        {formatCompact(display)}
        <span className={color}>{suffix}</span>
      </div>
      <p className="mt-1 text-sm text-white/50">{label}</p>
    </div>
  );
}
