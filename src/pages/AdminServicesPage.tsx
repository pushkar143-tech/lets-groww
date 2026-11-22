import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Megaphone,
  Package,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Tag,
  Users,
  Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { services } from '@/data/services';
import { formatINR } from '@/lib/format';

interface ServiceOverride {
  service_id: number;
  rate_override: number | null;
  discount_percent: number;
  is_visible: boolean;
}

interface AdminServicesProps {
  onNavigate: (view: string) => void;
}

export default function AdminServicesPage({ onNavigate }: AdminServicesProps) {
  const [overrides, setOverrides] = useState<Map<number, ServiceOverride>>(new Map());
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [bannerText, setBannerText] = useState('');
  const [bannerVisible, setBannerVisible] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  const loadOverrides = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('service_overrides')
      .select('service_id, rate_override, discount_percent, is_visible');
    if (error) {
      console.error('load service overrides failed', error);
    }
    const map = new Map<number, ServiceOverride>();
    for (const row of (data ?? []) as ServiceOverride[]) {
      map.set(row.service_id, row);
    }
    setOverrides(map);

    const { data: settings } = await supabase
      .from('site_settings')
      .select('banner_text, banner_visible')
      .eq('id', 1)
      .maybeSingle();
    if (settings) {
      setBannerText((settings as { banner_text: string | null }).banner_text ?? '');
      setBannerVisible((settings as { banner_visible: boolean }).banner_visible);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOverrides();
  }, [loadOverrides]);

  const saveOverride = async (serviceId: number, rate: number | null, discount: number, visible: boolean) => {
    setWorkingId(serviceId);
    setMessage(null);
    const { error } = await supabase.rpc('upsert_service_override', {
      p_service_id: serviceId,
      p_rate: rate,
      p_discount: discount,
      p_visible: visible,
    });
    setWorkingId(null);
    if (error) {
      console.error('save override failed', error);
      setMessage({ kind: 'error', text: 'Could not save the service settings.' });
      return;
    }
    setMessage({ kind: 'success', text: 'Service settings updated.' });
    await loadOverrides();
  };

  const saveBanner = async () => {
    setSavingBanner(true);
    setMessage(null);
    const { error } = await supabase.rpc('update_site_banner', {
      p_text: bannerText.trim() || null,
      p_visible: bannerVisible,
    });
    setSavingBanner(false);
    if (error) {
      console.error('save banner failed', error);
      setMessage({ kind: 'error', text: 'Could not update the banner.' });
      return;
    }
    setMessage({ kind: 'success', text: 'Homepage banner updated.' });
  };

  const stats = useMemo(() => {
    const total = services.length;
    const hidden = Array.from(overrides.values()).filter((o) => !o.is_visible).length;
    const discounted = Array.from(overrides.values()).filter((o) => o.discount_percent > 0).length;
    return { total, hidden, discounted };
  }, [overrides]);

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
              Service &amp; Offer <span className="text-gradient">Manager</span>
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Edit service rates, apply discounts, hide services, and manage the homepage banner announcement.
            </p>
          </div>
          <button onClick={() => void loadOverrides()} className="btn-ghost w-fit !px-4 !py-2">
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
          <button onClick={() => onNavigate('admin-services')} className="inline-flex items-center gap-2 rounded-xl border border-grape-400/40 bg-grape-500/15 px-4 py-2.5 text-sm font-medium text-grape-200 transition">
            <Settings2 className="h-4 w-4" /> Services
          </button>
          <button onClick={() => onNavigate('admin-users')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:text-white">
            <Users className="h-4 w-4" /> Users
          </button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard icon={Package} label="Total Services" value={String(stats.total)} color="text-neon-300" glow="bg-neon-500/15" />
          <StatCard icon={EyeOff} label="Hidden" value={String(stats.hidden)} color="text-accent-amber" glow="bg-accent-amber/15" />
          <StatCard icon={Tag} label="On Discount" value={String(stats.discounted)} color="text-grape-300" glow="bg-grape-500/15" />
        </div>

        {message && (
          <div
            className={`mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
              message.kind === 'success'
                ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
                : 'border-accent-red/30 bg-accent-red/10 text-accent-red'
            }`}
          >
            {message.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* Banner editor */}
        <div className="mt-6 card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-neon-300" />
            <h2 className="font-display text-lg font-semibold">Homepage Banner Announcement</h2>
          </div>
          <p className="mt-1.5 text-sm text-white/40">
            Show an announcement bar at the top of the homepage. Leave text empty to hide.
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="block flex-1">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50">Banner Text</span>
              <input
                type="text"
                value={bannerText}
                onChange={(e) => setBannerText(e.target.value)}
                placeholder="e.g. Flat 20% off on all Instagram services this week!"
                className="input-field"
                maxLength={200}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <input
                type="checkbox"
                checked={bannerVisible}
                onChange={(e) => setBannerVisible(e.target.checked)}
                className="h-4 w-4 accent-grape-400"
              />
              <span className="text-sm text-white/70">Visible</span>
            </label>
            <button
              onClick={() => void saveBanner()}
              disabled={savingBanner}
              className="btn-primary w-full sm:w-auto disabled:opacity-60"
            >
              {savingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingBanner ? 'Saving…' : 'Save Banner'}
            </button>
          </div>
        </div>

        {/* Services table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-ink-850/70 backdrop-blur-xl">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Default Rate</th>
                  <th className="px-5 py-3">Custom Rate</th>
                  <th className="px-5 py-3">Discount %</th>
                  <th className="px-5 py-3">Effective Rate</th>
                  <th className="px-5 py-3">Visible</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-white/40">
                      Loading services…
                    </td>
                  </tr>
                ) : (
                  services.map((svc) => (
                    <ServiceRow
                      key={svc.id}
                      service={svc}
                      override={overrides.get(svc.id) ?? null}
                      workingId={workingId}
                      onSave={saveOverride}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-white/5 lg:hidden">
            {loading ? (
              <div className="p-8 text-center text-white/40">Loading services…</div>
            ) : (
              services.map((svc) => (
                <ServiceCard
                  key={svc.id}
                  service={svc}
                  override={overrides.get(svc.id) ?? null}
                  workingId={workingId}
                  onSave={saveOverride}
                />
              ))
            )}
          </div>
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
  icon: typeof Package;
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

function ServiceRow({
  service,
  override,
  workingId,
  onSave,
}: {
  service: (typeof services)[number];
  override: ServiceOverride | null;
  workingId: number | null;
  onSave: (id: number, rate: number | null, discount: number, visible: boolean) => Promise<void>;
}) {
  const [rate, setRate] = useState<string>(override?.rate_override != null ? String(override.rate_override) : '');
  const [discount, setDiscount] = useState<string>(override ? String(override.discount_percent) : '0');
  const [visible, setVisible] = useState<boolean>(override ? override.is_visible : true);

  useEffect(() => {
    setRate(override?.rate_override != null ? String(override.rate_override) : '');
    setDiscount(override ? String(override.discount_percent) : '0');
    setVisible(override ? override.is_visible : true);
  }, [override]);

  const rateNum = rate.trim() === '' ? null : Number(rate);
  const discountNum = Number(discount) || 0;
  const baseRate = rateNum ?? service.ratePer1000;
  const effectiveRate = baseRate * (1 - discountNum / 100);
  const busy = workingId === service.id;

  return (
    <tr className="hover:bg-white/[0.03]">
      <td className="px-5 py-4">
        <p className="font-medium text-white/90">{service.name}</p>
        <p className="mt-0.5 text-xs text-white/30">{service.platform} · {service.category}</p>
      </td>
      <td className="px-5 py-4 text-white/50">{formatINR(service.ratePer1000)}/1K</td>
      <td className="px-5 py-4">
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder={String(service.ratePer1000)}
          className="input-field w-24 !py-1.5 text-xs"
          step="any"
          min="0"
        />
      </td>
      <td className="px-5 py-4">
        <input
          type="number"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          className="input-field w-20 !py-1.5 text-xs"
          step="any"
          min="0"
          max="100"
        />
      </td>
      <td className="px-5 py-4 font-semibold text-neon-300">{formatINR(effectiveRate)}/1K</td>
      <td className="px-5 py-4">
        <button
          onClick={() => setVisible((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            visible
              ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
              : 'border-white/10 bg-white/5 text-white/40'
          }`}
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {visible ? 'Shown' : 'Hidden'}
        </button>
      </td>
      <td className="px-5 py-4 text-right">
        <button
          disabled={busy}
          onClick={() => void onSave(service.id, rateNum, discountNum, visible)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neon-500/15 px-3 py-2 text-xs font-semibold text-neon-300 transition hover:bg-neon-500/25 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {busy ? 'Saving…' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

function ServiceCard({
  service,
  override,
  workingId,
  onSave,
}: {
  service: (typeof services)[number];
  override: ServiceOverride | null;
  workingId: number | null;
  onSave: (id: number, rate: number | null, discount: number, visible: boolean) => Promise<void>;
}) {
  const [rate, setRate] = useState<string>(override?.rate_override != null ? String(override.rate_override) : '');
  const [discount, setDiscount] = useState<string>(override ? String(override.discount_percent) : '0');
  const [visible, setVisible] = useState<boolean>(override ? override.is_visible : true);

  useEffect(() => {
    setRate(override?.rate_override != null ? String(override.rate_override) : '');
    setDiscount(override ? String(override.discount_percent) : '0');
    setVisible(override ? override.is_visible : true);
  }, [override]);

  const rateNum = rate.trim() === '' ? null : Number(rate);
  const discountNum = Number(discount) || 0;
  const baseRate = rateNum ?? service.ratePer1000;
  const effectiveRate = baseRate * (1 - discountNum / 100);
  const busy = workingId === service.id;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white/90">{service.name}</p>
          <p className="mt-0.5 text-xs text-white/30">{service.platform} · {service.category}</p>
        </div>
        <button
          onClick={() => setVisible((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            visible
              ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
              : 'border-white/10 bg-white/5 text-white/40'
          }`}
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {visible ? 'Shown' : 'Hidden'}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-white/40">Default</p>
          <p className="mt-0.5 text-white/60">{formatINR(service.ratePer1000)}/1K</p>
        </div>
        <div>
          <p className="text-xs text-white/40">Effective</p>
          <p className="mt-0.5 font-semibold text-neon-300">{formatINR(effectiveRate)}/1K</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 text-xs text-white/40">Custom Rate</span>
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={String(service.ratePer1000)}
            className="input-field w-full !py-1.5 text-xs"
            step="any"
            min="0"
          />
        </label>
        <label className="block">
          <span className="mb-1 text-xs text-white/40">Discount %</span>
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="input-field w-full !py-1.5 text-xs"
            step="any"
            min="0"
            max="100"
          />
        </label>
      </div>
      <div className="mt-3">
        <button
          disabled={busy}
          onClick={() => void onSave(service.id, rateNum, discountNum, visible)}
          className="btn-primary w-full !py-2 text-xs disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
