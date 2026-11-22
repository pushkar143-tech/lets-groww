import { useState } from 'react';
import { Menu, X, Zap, LayoutDashboard, LogIn, Wallet, ShieldCheck, LogOut, Gift, Bell } from 'lucide-react';
import { platformIcon } from '@/components/platformIcons';
import type { Platform } from '@/data/services';

interface NavbarProps {
  view: string;
  onNavigate: (view: string) => void;
  userEmail: string | null;
  role: 'user' | 'admin';
  onSignOut: () => Promise<void>;
  unreadNotifications: number;
  onOpenInbox: () => void;
}

const links: { label: string; view: string }[] = [
  { label: 'Home', view: 'home' },
  { label: 'Services', view: 'services' },
  { label: 'Pricing', view: 'services' },
];

export default function Navbar({ view, onNavigate, userEmail, role, onSignOut, unreadNotifications, onOpenInbox }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const go = (nextView: string) => { onNavigate(nextView); setOpen(false); };

  return <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 glass"><nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
    <button onClick={() => go('home')} className="group flex items-center gap-2.5"><span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-400 to-grape-500 shadow-neon"><Zap className="h-5 w-5 text-ink-950" strokeWidth={2.5} /><span className="absolute inset-0 rounded-xl ring-1 ring-white/30" /></span><span className="font-display text-lg font-bold tracking-tight">Lets<span className="text-gradient"> Groww</span></span></button>
    <div className="hidden items-center gap-1 md:flex">{links.map((link) => <button key={link.label} onClick={() => go(link.view)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${view === link.view ? 'text-neon-300' : 'text-white/70 hover:text-white'}`}>{link.label}</button>)}{userEmail && <button onClick={() => go('deposit')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${view === 'deposit' ? 'text-neon-300' : 'text-white/70 hover:text-white'}`}>Deposit</button>}{userEmail && <button onClick={() => go('redeem-gift-code')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${view === 'redeem-gift-code' ? 'text-grape-300' : 'text-white/70 hover:text-white'}`}>Gift Codes</button>}{role === 'admin' && <button onClick={() => go('admin-deposits')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${view === 'admin-deposits' || view === 'admin-orders' || view === 'admin-services' || view === 'admin-gift-codes' ? 'text-grape-300' : 'text-white/70 hover:text-white'}`}>Admin</button>}</div>
    <div className="hidden items-center gap-2 md:flex">{userEmail ? <><button onClick={onOpenInbox} className="relative rounded-xl border border-white/10 p-2.5 text-white/50 transition hover:border-neon-400/40 hover:text-neon-300" aria-label="Inbox">{unreadNotifications > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white shadow-glow">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span> : null}<Bell className="h-4 w-4" /></button><span className="max-w-40 truncate text-xs text-white/40">{userEmail}</span><button onClick={() => go('dashboard')} className="btn-ghost !px-4 !py-2"><LayoutDashboard className="h-4 w-4" /> Dashboard</button><button onClick={() => void onSignOut()} className="rounded-xl border border-white/10 p-2.5 text-white/50 hover:border-accent-red/40 hover:text-accent-red" aria-label="Sign out"><LogOut className="h-4 w-4" /></button></> : <button onClick={() => go('dashboard')} className="btn-primary !px-4 !py-2"><LogIn className="h-4 w-4" /> Sign In</button>}</div>
    <button onClick={() => setOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/5 md:hidden" aria-label="Toggle menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
  </nav>{open && <div className="border-t border-white/5 bg-ink-900/95 px-4 py-4 md:hidden"><div className="flex flex-col gap-1">{links.map((link) => <button key={link.label} onClick={() => go(link.view)} className="rounded-lg px-4 py-3 text-left text-sm font-medium text-white/80 hover:bg-white/5">{link.label}</button>)}{userEmail && <><button onClick={() => { onOpenInbox(); setOpen(false); }} className="flex items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium text-white/80 hover:bg-white/5"><span className="flex items-center gap-2"><Bell className="h-4 w-4" /> Inbox</span>{unreadNotifications > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</button><button onClick={() => go('deposit')} className="rounded-lg px-4 py-3 text-left text-sm font-medium text-white/80 hover:bg-white/5"><Wallet className="mr-2 inline h-4 w-4" /> Deposit</button><button onClick={() => go('redeem-gift-code')} className="rounded-lg px-4 py-3 text-left text-sm font-medium text-white/80 hover:bg-white/5"><Gift className="mr-2 inline h-4 w-4" /> Gift Codes</button><button onClick={() => go('dashboard')} className="rounded-lg px-4 py-3 text-left text-sm font-medium text-white/80 hover:bg-white/5"><LayoutDashboard className="mr-2 inline h-4 w-4" /> Dashboard</button>{role === 'admin' && <button onClick={() => go('admin-deposits')} className="rounded-lg px-4 py-3 text-left text-sm font-medium text-white/80 hover:bg-white/5"><ShieldCheck className="mr-2 inline h-4 w-4" /> Admin Panel</button>}<button onClick={() => void onSignOut()} className="rounded-lg px-4 py-3 text-left text-sm font-medium text-accent-red hover:bg-white/5"><LogOut className="mr-2 inline h-4 w-4" /> Sign Out</button></>}{!userEmail && <button onClick={() => go('dashboard')} className="btn-primary mt-2 w-full"><LogIn className="h-4 w-4" /> Sign In</button>}</div><div className="mt-4 flex items-center gap-3 overflow-x-auto pb-1">{(Object.keys(platformIcon) as Platform[]).map((platform) => { const Icon = platformIcon[platform]; return <span key={platform} className="chip border border-white/10 bg-white/5 text-white/60"><Icon className="h-3.5 w-3.5" /> {platform}</span>; })}</div></div>}</header>;
}
