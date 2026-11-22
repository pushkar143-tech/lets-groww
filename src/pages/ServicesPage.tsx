import { useMemo, useState } from 'react';
import { Search, ShoppingCart, SlidersHorizontal, Tag } from 'lucide-react';
import {
  services,
  platformFilters,
  platformMeta,
  qualityStyles,
  type Platform,
  type Service,
} from '@/data/services';
import { platformIcon } from '@/components/platformIcons';
import { formatINR } from '@/lib/format';
import { useServiceOverrides, applyOverrides, filterVisible } from '@/lib/useServiceOverrides';

interface ServicesPageProps {
  onOrder: (service: Service) => void;
}

export default function ServicesPage({ onOrder }: ServicesPageProps) {
  const [platform, setPlatform] = useState<Platform | 'All'>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const matchPlatform = platform === 'All' || s.platform === platform;
      const matchQuery =
        query.trim() === '' ||
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.category.toLowerCase().includes(query.toLowerCase());
      return matchPlatform && matchQuery;
    });
  }, [platform, query]);

  return (
    <section className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-20" />
      <div className="absolute -top-10 left-1/2 h-48 w-[36rem] -translate-x-1/2 rounded-full bg-neon-500/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center">
          <span className="chip border border-neon-400/30 bg-neon-500/10 text-neon-300">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Full Price List
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Services &amp; <span className="text-gradient">Pricing</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/50">
            Transparent per-1000 pricing in INR. Followers &amp; likes are split into Basic, Medium and High Non-Drop quality tiers.
          </p>
        </div>

        {/* Controls */}
        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Platform filters */}
          <div className="flex flex-wrap gap-2">
            {platformFilters.map((p) => {
              const active = platform === p;
              const Icon = p === 'All' ? null : platformIcon[p as Platform];
              return (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`chip border transition-all duration-200 ${
                    active
                      ? 'border-neon-400/60 bg-neon-500/15 text-neon-200 shadow-glow'
                      : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {p}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services…"
              className="input-field !pl-10"
            />
          </div>
        </div>

        {/* Table — desktop */}
        <div className="mt-6 hidden overflow-hidden rounded-2xl border border-white/10 bg-ink-850/60 backdrop-blur-xl md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Rate / 1K</th>
                <th className="px-4 py-3 font-medium">Min / Max</th>
                <th className="px-4 py-3 font-medium">Quality</th>
                <th className="px-4 py-3 font-medium">Speed</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((s) => (
                <ServiceRow key={s.id} s={s} onOrder={onOrder} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-white/40">
                    No services match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cards — mobile */}
        <div className="mt-6 grid gap-3 md:hidden">
          {filtered.map((s) => (
            <ServiceCard key={s.id} s={s} onOrder={onOrder} />
          ))}
          {filtered.length === 0 && (
            <div className="card p-8 text-center text-white/40">No services match your search.</div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Showing {filtered.length} of {services.length} services · Prices in INR (₹) per 1000 units
        </p>
      </div>
    </section>
  );
}

function ServiceRow({ s, onOrder }: { s: Service; onOrder: (s: Service) => void }) {
  const Icon = platformIcon[s.platform];
  const meta = platformMeta[s.platform];
  return (
    <tr className="group transition-colors hover:bg-white/[0.03]">
      <td className="px-4 py-3 font-mono text-xs text-white/40">#{s.id}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-white">{s.name}</p>
            <p className="text-xs text-white/40">{s.platform} · {s.category}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold text-neon-300">{formatINR(s.ratePer1000)}</span>
      </td>
      <td className="px-4 py-3 text-white/60">
        {s.min.toLocaleString('en-IN')} – {s.max.toLocaleString('en-IN')}
      </td>
      <td className="px-4 py-3">
        {s.quality ? (
          <span className={`chip border ${qualityStyles[s.quality]}`}>{s.quality}</span>
        ) : (
          <span className="chip border border-white/10 bg-white/5 text-white/40">Standard</span>
        )}
      </td>
      <td className="px-4 py-3 text-white/60">{s.speed}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onOrder(s)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-neon-400 to-neon-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition-all hover:shadow-neon"
        >
          <ShoppingCart className="h-3.5 w-3.5" /> Order
        </button>
      </td>
    </tr>
  );
}

function ServiceCard({ s, onOrder }: { s: Service; onOrder: (s: Service) => void }) {
  const Icon = platformIcon[s.platform];
  const meta = platformMeta[s.platform];
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">{s.name}</p>
            <p className="text-xs text-white/40">#{s.id} · {s.speed}</p>
          </div>
        </div>
        {s.quality && (
          <span className={`chip border ${qualityStyles[s.quality]}`}>{s.quality}</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-white/5 px-3 py-2">
          <p className="text-white/40">Rate / 1K</p>
          <p className="font-semibold text-neon-300">{formatINR(s.ratePer1000)}</p>
        </div>
        <div className="rounded-lg bg-white/5 px-3 py-2">
          <p className="text-white/40">Min / Max</p>
          <p className="font-medium text-white/80">{s.min.toLocaleString('en-IN')} – {s.max.toLocaleString('en-IN')}</p>
        </div>
      </div>
      <button
        onClick={() => onOrder(s)}
        className="btn-primary mt-3 w-full !py-2"
      >
        <ShoppingCart className="h-4 w-4" /> Order Now
      </button>
    </div>
  );
}
