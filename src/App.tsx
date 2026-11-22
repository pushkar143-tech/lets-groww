import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import LiveCounters from '@/components/LiveCounters';
import WhyChooseUs from '@/components/WhyChooseUs';
import Footer from '@/components/Footer';
import ServicesPage from '@/pages/ServicesPage';
import Dashboard from '@/pages/Dashboard';
import DepositPage from '@/pages/DepositPage';
import GiftCodesPage from '@/pages/GiftCodesPage';
import AuthPage from '@/pages/AuthPage';
import AdminDepositsPage from '@/pages/AdminDepositsPage';
import AdminOrdersPage from '@/pages/AdminOrdersPage';
import AdminServicesPage from '@/pages/AdminServicesPage';
import AdminGiftCodesPage from '@/pages/AdminGiftCodesPage';
import AdminUsersPage from '@/pages/AdminUsersPage';
import InboxDrawer from '@/components/InboxDrawer';
import AccountStatusModals from '@/components/AccountStatusModals';
import { useNotifications } from '@/lib/useNotifications';
import { supabase } from '@/lib/supabase';
import type { Service } from '@/data/services';

type View = 'home' | 'services' | 'dashboard' | 'deposit' | 'redeem-gift-code' | 'admin-deposits' | 'admin-orders' | 'admin-services' | 'admin-gift-codes' | 'admin-users';
type Role = 'user' | 'admin';
type AccountStatus = 'Active' | 'Restricted' | 'Suspended';

export default function App() {
  const [view, setView] = useState<View>(
    window.location.pathname === '/admin/deposits' ? 'admin-deposits'
    : window.location.pathname === '/admin/orders' ? 'admin-orders'
    : window.location.pathname === '/admin/services' ? 'admin-services'
    : window.location.pathname === '/admin/gift-codes' ? 'admin-gift-codes'
    : window.location.pathname === '/admin/users' ? 'admin-users'
    : window.location.pathname === '/redeem-gift-code' ? 'redeem-gift-code'
    : 'home',
  );
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>('user');
  const [authLoading, setAuthLoading] = useState(true);
  const [preselectedService, setPreselectedService] = useState<Service | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>('Active');
  const [statusReason, setStatusReason] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session) {
        await loadRole(data.session.user.id, setRole);
        await loadAccountStatus(data.session.user.id, setAccountStatus, setStatusReason);
      }
      setAuthLoading(false);
    };
    void loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      (async () => {
        setSession(nextSession);
        if (nextSession) {
          await loadRole(nextSession.user.id, setRole);
          await loadAccountStatus(nextSession.user.id, setAccountStatus, setStatusReason);
        } else {
          setRole('user');
          setAccountStatus('Active');
          setStatusReason(null);
        }
        setAuthLoading(false);
      })();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const navigate = useCallback((nextView: string) => {
    const destination =
      nextView === 'admin-deposits' ? '/admin/deposits'
      : nextView === 'admin-orders' ? '/admin/orders'
      : nextView === 'admin-services' ? '/admin/services'
      : nextView === 'admin-gift-codes' ? '/admin/gift-codes'
      : nextView === 'admin-users' ? '/admin/users'
      : nextView === 'home' ? '/' : `/${nextView}`;
    window.history.pushState({}, '', destination);
    setView(nextView as View);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOrder = useCallback((service: Service) => {
    setPreselectedService(service);
    navigate('dashboard');
  }, [navigate]);

  const consumePreselect = useCallback(() => setPreselectedService(null), []);
  const signOut = async () => { await supabase.auth.signOut(); navigate('home'); };

  const currentUserId = session?.user.id ?? null;
  const { notifications, unreadCount, markRead } = useNotifications(role === 'user' ? currentUserId : null);

  // Realtime: update account status when profiles change
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`account-status-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentUserId}` },
        (payload) => {
          const next = payload.new as { account_status?: string; status_reason?: string | null };
          if (next.account_status) setAccountStatus(next.account_status as AccountStatus);
          if ('status_reason' in next) setStatusReason(next.status_reason ?? null);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUserId]);

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-ink-950 text-white/50">Loading Lets Groww…</div>;

  const protectedView = view === 'dashboard' || view === 'deposit' || view === 'redeem-gift-code' || view === 'admin-deposits' || view === 'admin-orders' || view === 'admin-services' || view === 'admin-gift-codes' || view === 'admin-users';
  if (protectedView && !session) return <AuthPage />;
  if ((view === 'admin-deposits' || view === 'admin-orders' || view === 'admin-services' || view === 'admin-gift-codes' || view === 'admin-users') && role !== 'admin') return <AccessDenied onNavigate={() => navigate('home')} />;

  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <Navbar view={view} onNavigate={navigate} userEmail={session?.user.email ?? null} role={role} onSignOut={signOut} unreadNotifications={unreadCount} onOpenInbox={() => setInboxOpen(true)} />
      {view === 'home' && <main><Hero onNavigate={navigate} /><LiveCounters /><WhyChooseUs /><CTABanner onNavigate={navigate} /></main>}
      {view === 'services' && <main><ServicesPage onOrder={handleOrder} /></main>}
      {view === 'dashboard' && <main><Dashboard preselectedService={preselectedService} onConsumePreselect={consumePreselect} onDeposit={() => navigate('deposit')} onNavigate={navigate} userId={session?.user.id ?? ''} /></main>}
      {view === 'deposit' && <main><DepositPage onNavigate={navigate} /></main>}
      {view === 'redeem-gift-code' && <main><GiftCodesPage userId={session?.user.id ?? ''} /></main>}
      {view === 'admin-deposits' && <main><AdminDepositsPage onNavigate={navigate} /></main>}
      {view === 'admin-orders' && <main><AdminOrdersPage onNavigate={navigate} /></main>}
      {view === 'admin-services' && <main><AdminServicesPage onNavigate={navigate} /></main>}
      {view === 'admin-gift-codes' && <main><AdminGiftCodesPage onNavigate={navigate} /></main>}
      {view === 'admin-users' && <main><AdminUsersPage onNavigate={navigate} /></main>}
      <Footer onNavigate={navigate} />
      {session && role === 'user' && (
        <AccountStatusModals status={accountStatus} statusReason={statusReason} userId={session.user.id} onSignOut={signOut} />
      )}
      {session && (
        <InboxDrawer open={inboxOpen} onClose={() => setInboxOpen(false)} notifications={notifications} unreadCount={unreadCount} onMarkRead={markRead} />
      )}
    </div>
  );
}

async function loadRole(userId: string, setRole: (role: Role) => void) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  setRole(data?.role === 'admin' ? 'admin' : 'user');
}

async function loadAccountStatus(userId: string, setStatus: (s: AccountStatus) => void, setReason: (r: string | null) => void) {
  const { data } = await supabase.from('profiles').select('account_status, status_reason').eq('id', userId).maybeSingle();
  setStatus((data?.account_status as AccountStatus) ?? 'Active');
  setReason(data?.status_reason ?? null);
}

function AccessDenied({ onNavigate }: { onNavigate: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-ink-950 px-4 text-center"><div><h1 className="font-display text-3xl font-bold">Admin access required</h1><p className="mt-3 text-sm text-white/50">This area is available only to approved administrators.</p><button onClick={onNavigate} className="btn-primary mt-6">Return Home</button></div></main>;
}

function CTABanner({ onNavigate }: { onNavigate: (v: string) => void }) {
  return <section className="relative py-16"><div className="mx-auto max-w-5xl px-4 sm:px-6"><div className="card relative overflow-hidden p-8 text-center sm:p-12"><div className="absolute inset-0 bg-gradient-to-r from-neon-500/10 via-transparent to-grape-500/10" /><div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-neon-500/20 blur-3xl" /><div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-grape-500/20 blur-3xl" /><div className="relative"><h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Ready to <span className="text-gradient">Grow Viral</span>?</h2><p className="mx-auto mt-3 max-w-lg text-sm text-white/50">Join 50,000+ creators and resellers. Create your account, add funds, and place your first order in under a minute.</p><div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"><button onClick={() => onNavigate('dashboard')} className="btn-primary w-full sm:w-auto">Get Started Now</button><button onClick={() => onNavigate('services')} className="btn-ghost w-full sm:w-auto">Browse Services</button></div></div></div></div></section>;
}
