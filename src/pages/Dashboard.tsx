import { useMemo, useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Wallet,
  Plus,
  PlusCircle,
  Link2,
  Hash,
  Calculator,
  ShoppingCart,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  History,
  LayoutGrid,
  TrendingUp,
  Receipt,
  Tag,
  X,
  PartyPopper,
} from 'lucide-react';
import {
  services,
  platformMeta,
  type Platform,
  type Service,
} from '@/data/services';
import { platformIcon } from '@/components/platformIcons';
import { formatINR } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import OrderSuccessModal from '@/components/OrderSuccessModal';

type OrderStatus = 'Pending' | 'In Progress' | 'Completed' | 'Partial' | 'Rejected';

interface Order {
  id: string;
  date: string;
  serviceId: number;
  serviceName: string;
  platform: Platform;
  link: string;
  quantity: number;
  charge: number;
  status: OrderStatus;
}


interface DashboardProps {
  preselectedService: Service | null;
  onConsumePreselect: () => void;
  onDeposit: () => void;
  onNavigate: (view: string) => void;
  userId: string;
}

export default function Dashboard({ preselectedService, onConsumePreselect, onDeposit, onNavigate, userId }: DashboardProps) {
  const [balance, setBalance] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [successOrder, setSuccessOrder] = useState<{ id: string; amount: number } | null>(null);
  const orderHistoryRef = useRef<HTMLDivElement>(null);
  const totalSpent = useMemo(
    () => orders.reduce((sum, o) => sum + (o.status !== 'Rejected' ? o.charge : 0), 0),
    [orders],
  );

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, service_name, quantity, link, total_price, status, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('load orders failed', error);
      return;
    }
    const rows = (data ?? []) as Array<{
      id: string;
      service_name: string;
      quantity: number;
      link: string;
      total_price: number;
      status: Order['status'];
      created_at: string;
    }>;
    setOrders(
      rows.map((r) => ({
        id: r.id.slice(0, 8).toUpperCase(),
        date: r.created_at.slice(0, 10),
        serviceId: 0,
        serviceName: r.service_name,
        platform: 'Instagram' as Platform,
        link: r.link,
        quantity: r.quantity,
        charge: Number(r.total_price),
        status: r.status,
      })),
    );
  };

  useEffect(() => {
    void loadOrders();
    const channel = supabase
      .channel(`orders-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void loadOrders();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // New order form state
  const platforms = useMemo(() => Array.from(new Set(services.map((s) => s.platform))) as Platform[], []);
  const [platform, setPlatform] = useState<Platform>('Instagram');
  const categoryList = useMemo(
    () => Array.from(new Set(services.filter((s) => s.platform === platform).map((s) => s.category))),
    [platform],
  );
  const [category, setCategory] = useState<string>('Followers');
  const serviceList = useMemo(
    () => services.filter((s) => s.platform === platform && s.category === category),
    [platform, category],
  );
  const [serviceId, setServiceId] = useState<number>(serviceList[0]?.id ?? 0);
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState('1000');
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  // Promo code state — store only the validated code + type/value; the discount
  // is recomputed live from baseCharge so it always tracks the current quantity.
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; type: 'percent' | 'flat'; value: number } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const selectedService = services.find((s) => s.id === serviceId) ?? serviceList[0];

  // Sync category when platform changes
  useEffect(() => {
    if (!categoryList.includes(category as never)) {
      setCategory(categoryList[0] ?? 'Followers');
    }
  }, [categoryList, category]);

  // Sync service when list changes
  useEffect(() => {
    if (serviceList.length && !serviceList.some((s) => s.id === serviceId)) {
      setServiceId(serviceList[0].id);
    }
  }, [serviceList, serviceId]);

  useEffect(() => {
    const loadWallet = async () => {
      const { data, error } = await supabase.from('profiles').select('wallet_balance').eq('id', userId).maybeSingle();
      if (!error && data) setBalance(Number(data.wallet_balance));
    };
    void loadWallet();
    const channel = supabase.channel(`wallet-${userId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload) => {
      const nextBalance = Number((payload.new as { wallet_balance?: number }).wallet_balance);
      if (Number.isFinite(nextBalance)) setBalance(nextBalance);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  // Preselect from "Order" button on services page
  useEffect(() => {
    if (preselectedService) {
      setPlatform(preselectedService.platform);
      setCategory(preselectedService.category);
      setServiceId(preselectedService.id);
      onConsumePreselect();
    }
  }, [preselectedService, onConsumePreselect]);

  const qtyNum = parseInt(quantity, 10);
  const baseCharge = selectedService && Number.isFinite(qtyNum) ? (qtyNum / 1000) * selectedService.ratePer1000 : 0;
  // Discount recalculates dynamically from the current baseCharge whenever the
  // quantity or service changes, so a 10% code always deducts 10% of the live total.
  const promoDiscount = appliedPromo
    ? appliedPromo.type === 'percent'
      ? baseCharge * (appliedPromo.value / 100)
      : Math.min(appliedPromo.value, baseCharge)
    : 0;
  const totalCharge = appliedPromo ? Math.max(baseCharge - promoDiscount, 0) : baseCharge;

  const showToast = (kind: 'success' | 'error', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const firePromoConfetti = () => {
    const colors = ['#00d2ff', '#22d3ee', '#4ade80', '#a855f7', '#facc15', '#60a5fa'];
    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.65 },
      colors,
      disableForReducedMotion: true,
      scalar: 0.85,
    });
    const t1 = window.setTimeout(() => confetti({ particleCount: 40, angle: 60, spread: 50, origin: { x: 0.15, y: 0.7 }, colors, disableForReducedMotion: true, scalar: 0.85 }), 120);
    const t2 = window.setTimeout(() => confetti({ particleCount: 40, angle: 120, spread: 50, origin: { x: 0.85, y: 0.7 }, colors, disableForReducedMotion: true, scalar: 0.85 }), 120);
    window.setTimeout(() => { window.clearTimeout(t1); window.clearTimeout(t2); }, 2000);
  };

  const validatePromo = async () => {
    setPromoError(null);
    if (!promoInput.trim()) {
      setPromoError('Enter a promo code first.');
      return;
    }
    if (baseCharge <= 0) {
      setPromoError('Select a service and quantity first.');
      return;
    }
    setPromoChecking(true);
    const { data, error } = await supabase.rpc('validate_promo_code', {
      p_code: promoInput.trim(),
      p_order_total: baseCharge,
    });
    setPromoChecking(false);
    if (error) {
      setPromoError(error.message.includes('promo') || error.message.includes('expired') || error.message.includes('limit') || error.message.includes('Invalid') ? error.message : 'Invalid or expired promo code.');
      setAppliedPromo(null);
      return;
    }
    const result = data as { discount_amount: number; final_total: number; discount_type: string; discount_value: number } | null;
    if (!result) {
      setPromoError('Could not validate this promo code.');
      return;
    }
    setAppliedPromo({
      code: promoInput.trim().toUpperCase(),
      type: result.discount_type as 'percent' | 'flat',
      value: Number(result.discount_value),
    });

    firePromoConfetti();
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  };

  const placeOrder = async () => {
    if (!selectedService) return showToast('error', 'Please select a service.');
    if (!link.trim()) return showToast('error', 'Please enter a valid link/username.');
    if (!Number.isFinite(qtyNum) || qtyNum < selectedService.min) return showToast('error', `Minimum order is ${selectedService.min}.`);
    if (qtyNum > selectedService.max) return showToast('error', `Maximum order is ${selectedService.max}.`);
    if (totalCharge > balance) return showToast('error', 'Insufficient balance. Please add funds.');

    const { data, error: orderError } = await supabase.rpc('place_order', {
      p_service_name: selectedService.name,
      p_quantity: qtyNum,
      p_link: link.trim(),
      p_total_price: baseCharge,
      p_promo_code: appliedPromo ? appliedPromo.code : null,
    });
    if (orderError) {
      console.error('order placement failed', orderError);
      const msg = orderError.message.toLowerCase().includes('insufficient')
        ? 'Insufficient balance. Please add funds.'
        : orderError.message.toLowerCase().includes('promo')
        ? 'Promo code could not be applied. It may be expired or used up.'
        : 'Could not place the order. Please try again.';
      showToast('error', msg);
      return;
    }

    const result = data as { order_id?: string; new_balance?: number; final_price?: number } | null;
    if (result?.new_balance != null) setBalance(Number(result.new_balance));
    setLink('');
    setQuantity('1000');
    removePromo();
    await loadOrders();
    if (result?.order_id) {
      setSuccessOrder({
        id: result.order_id,
        amount: Number(result.final_price ?? totalCharge),
      });
    } else {
      showToast('success', 'Order placed successfully!');
    }
  };

  return (
    <section className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-20" />
      <div className="absolute -top-10 right-0 h-48 w-72 rounded-full bg-grape-500/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Client <span className="text-gradient">Dashboard</span>
            </h1>
            <p className="mt-1 text-sm text-white/50">Welcome back — let's grow your presence today.</p>
          </div>
          <span className="chip w-fit border border-accent-green/30 bg-accent-green/10 text-accent-green">
            <span className="h-2 w-2 rounded-full bg-accent-green animate-pulseGlow" /> Live Wallet
          </span>
        </div>

        {/* Stat cards row */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatMini icon={Wallet} label="Wallet Balance" value={formatINR(balance)} color="text-neon-300" glow="bg-neon-500/15" />
          <StatMini icon={Receipt} label="Total Spent" value={formatINR(totalSpent)} color="text-grape-300" glow="bg-grape-500/15" />
          <StatMini icon={TrendingUp} label="Total Orders" value={String(orders.length)} color="text-accent-green" glow="bg-accent-green/15" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* New Order Panel */}
          <div className="lg:col-span-3">
            <div className="card p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-neon-300" />
                <h2 className="font-display text-lg font-semibold">New Order</h2>
              </div>

              <div className="mt-5 space-y-4">
                {/* Platform + Category */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Platform">
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value as Platform)}
                      className="input-field"
                    >
                      {platforms.map((p) => (
                        <option key={p} value={p} className="bg-ink-850">{p}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Category">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="input-field"
                    >
                      {categoryList.map((c) => (
                        <option key={c} value={c} className="bg-ink-850">{c}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Service */}
                <Field label="Service">
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(Number(e.target.value))}
                    className="input-field"
                  >
                    {serviceList.map((s) => (
                      <option key={s.id} value={s.id} className="bg-ink-850">
                        {s.name} — {formatINR(s.ratePer1000)}/1K
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Link */}
                <Field label="Link / Username" icon={Link2}>
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://instagram.com/your.profile"
                    className="input-field"
                  />
                </Field>

                {/* Quantity + total */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Quantity" icon={Hash}>
                    <input
                      type="number"
                      value={quantity}
                      min={selectedService?.min ?? 0}
                      max={selectedService?.max ?? 0}
                      onChange={(e) => {
                        const raw = e.target.value;
                        // Allow empty string while typing; otherwise strip
                        // leading zeros so "05" becomes "5".
                        if (raw === '') { setQuantity(''); return; }
                        const cleaned = String(parseInt(raw, 10));
                        setQuantity(Number.isNaN(parseInt(raw, 10)) ? '' : cleaned);
                      }}
                      className="input-field"
                    />
                    {selectedService && (
                      <p className="mt-1.5 text-xs text-white/40">
                        Min {selectedService.min.toLocaleString('en-IN')} · Max {selectedService.max.toLocaleString('en-IN')}
                      </p>
                    )}
                  </Field>
                  <div className="rounded-xl border border-neon-400/20 bg-neon-500/5 p-4">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <Calculator className="h-3.5 w-3.5" /> Total Charge
                    </div>
                    <p className="mt-1 font-display text-2xl font-bold text-neon-300">
                      {formatINR(totalCharge)}
                    </p>
                    {appliedPromo ? (
                      <div className="mt-1.5 space-y-0.5">
                        <p className="text-xs text-white/40 line-through">{formatINR(baseCharge)}</p>
                        <p className="text-xs text-accent-green">
                          {appliedPromo.type === 'percent' ? `${appliedPromo.value}% off` : `${formatINR(appliedPromo.value)} off`} · −{formatINR(promoDiscount)}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-white/40">
                        {formatINR(selectedService?.ratePer1000 ?? 0)} per 1,000
                      </p>
                    )}
                  </div>
                </div>

                {/* Promo code */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-white/50">
                    <Tag className="h-3.5 w-3.5 text-grape-300" /> Have a Promo Code?
                  </div>
                  {appliedPromo ? (
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <PartyPopper className="h-4 w-4 text-accent-green" />
                        <span className="font-mono text-sm font-semibold text-accent-green">{appliedPromo.code}</span>
                        <span className="text-xs text-white/50">applied — you saved {formatINR(promoDiscount)}</span>
                      </div>
                      <button onClick={removePromo} className="rounded-md p-1 text-white/40 transition hover:text-accent-red" aria-label="Remove promo code">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={promoInput}
                        onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                        placeholder="Enter code e.g. SAVE10"
                        className="input-field flex-1 font-mono"
                        maxLength={20}
                      />
                      <button
                        onClick={() => void validatePromo()}
                        disabled={promoChecking}
                        className="btn-grape !px-4 !py-2.5 text-sm disabled:opacity-60"
                      >
                        {promoChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                  )}
                  {promoError && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-accent-red">
                      <AlertCircle className="h-3.5 w-3.5" /> {promoError}
                    </p>
                  )}
                </div>

                <button onClick={placeOrder} className="btn-primary w-full">
                  <ShoppingCart className="h-4 w-4" /> Place Order
                </button>
              </div>
            </div>
          </div>

          {/* Balance card */}
          <div className="lg:col-span-2">
            <div className="card relative overflow-hidden p-6">
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-neon-500/20 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-neon-300" />
                  <h2 className="font-display text-lg font-semibold">Balance</h2>
                </div>
                <p className="mt-4 font-display text-4xl font-bold text-gradient">{formatINR(balance)}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-xs text-white/40">Total Spent</p>
                    <p className="mt-0.5 font-semibold text-white">{formatINR(totalSpent)}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-xs text-white/40">Orders</p>
                    <p className="mt-0.5 font-semibold text-white">{orders.length}</p>
                  </div>
                </div>
                <button onClick={onDeposit} className="btn-grape mt-5 w-full !py-2.5">
                  <Plus className="h-4 w-4" /> Add Funds
                </button>
                <p className="mt-3 text-center text-xs text-white/30">UPI · Cards · Net Banking · Wallets</p>
              </div>
            </div>

            {/* Quick links */}
            <div className="card mt-4 p-5">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-grape-300" />
                <h3 className="text-sm font-semibold">Quick Stats</h3>
              </div>
              <div className="mt-4 space-y-3">
                <QuickStat label="Completed" value={orders.filter((o) => o.status === 'Completed').length} color="text-accent-green" />
                <QuickStat label="In Progress" value={orders.filter((o) => o.status === 'In Progress').length} color="text-neon-300" />
                <QuickStat label="Pending" value={orders.filter((o) => o.status === 'Pending').length} color="text-accent-amber" />
                <QuickStat label="Partial" value={orders.filter((o) => o.status === 'Partial').length} color="text-accent-red" />
              </div>
            </div>
          </div>
        </div>

        {/* Order History */}
        <div ref={orderHistoryRef} className="mt-6 card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <History className="h-5 w-5 text-neon-300" />
            <h2 className="font-display text-lg font-semibold">Order History</h2>
            <span className="chip ml-auto border border-white/10 bg-white/5 text-white/50">{orders.length} orders</span>
          </div>

          {/* desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-5 py-3 font-medium">Order ID</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">Quantity</th>
                  <th className="px-5 py-3 font-medium">Charge</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((o) => (
                  <OrderRow key={o.id} o={o} />
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <div className="divide-y divide-white/5 md:hidden">
            {orders.map((o) => (
              <OrderCard key={o.id} o={o} />
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium shadow-glow animate-countUp ${
            toast.kind === 'success'
              ? 'border-accent-green/40 bg-accent-green/15 text-accent-green'
              : 'border-accent-red/40 bg-accent-red/15 text-accent-red'
          }`}
        >
          {toast.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {successOrder && (
        <OrderSuccessModal
          orderId={successOrder.id}
          amount={successOrder.amount}
          onViewStatus={() => {
            setSuccessOrder(null);
            orderHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          onBackHome={() => {
            setSuccessOrder(null);
            onNavigate('home');
          }}
          onClose={() => setSuccessOrder(null)}
        />
      )}
    </section>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof Link2;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </span>
      {children}
    </label>
  );
}

function StatMini({
  icon: Icon,
  label,
  value,
  color,
  glow,
}: {
  icon: typeof Wallet;
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

function QuickStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/50">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

const statusStyles: Record<OrderStatus, { chip: string; icon: typeof Clock }> = {
  Pending: { chip: 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber', icon: Clock },
  'In Progress': { chip: 'border-neon-400/30 bg-neon-500/10 text-neon-300', icon: Loader2 },
  Completed: { chip: 'border-accent-green/30 bg-accent-green/10 text-accent-green', icon: CheckCircle2 },
  Partial: { chip: 'border-accent-red/30 bg-accent-red/10 text-accent-red', icon: AlertCircle },
  Rejected: { chip: 'border-accent-red/30 bg-accent-red/10 text-accent-red', icon: AlertCircle },
};

function OrderRow({ o }: { o: Order }) {
  const Icon = platformIcon[o.platform];
  const meta = platformMeta[o.platform];
  const st = statusStyles[o.status];
  const StatusIcon = st.icon;
  return (
    <tr className="transition-colors hover:bg-white/[0.03]">
      <td className="px-5 py-3 font-mono text-xs text-white/60">{o.id}</td>
      <td className="px-5 py-3 text-white/50">{o.date}</td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className={`grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="font-medium text-white/90">{o.serviceName}</p>
            <p className="max-w-[200px] truncate text-xs text-white/30">{o.link}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3 text-white/70">{o.quantity.toLocaleString('en-IN')}</td>
      <td className="px-5 py-3 font-semibold text-neon-300">{formatINR(o.charge)}</td>
      <td className="px-5 py-3">
        <span className={`chip border ${st.chip}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${o.status === 'In Progress' ? 'animate-spin' : ''}`} /> {o.status}
        </span>
      </td>
    </tr>
  );
}

function OrderCard({ o }: { o: Order }) {
  const Icon = platformIcon[o.platform];
  const meta = platformMeta[o.platform];
  const st = statusStyles[o.status];
  const StatusIcon = st.icon;
  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-white/50">{o.id}</span>
        <span className={`chip border ${st.chip}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${o.status === 'In Progress' ? 'animate-spin' : ''}`} /> {o.status}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white`}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-sm font-medium text-white/90">{o.serviceName}</p>
      </div>
      <p className="mt-2 truncate text-xs text-white/30">{o.link}</p>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-white/50">{o.quantity.toLocaleString('en-IN')} units</span>
        <span className="font-semibold text-neon-300">{formatINR(o.charge)}</span>
      </div>
    </div>
  );
}
