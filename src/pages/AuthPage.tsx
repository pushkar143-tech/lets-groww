import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserPlus, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async () => {
    setError('');
    setSuccess('');
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid email and a password with at least 6 characters.');
      return;
    }
    setBusy(true);
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (result.error) {
      console.error('authentication failed', result.error);
      const message = result.error.message.toLowerCase();
      if (message.includes('email not confirmed')) {
        setError('Email not confirmed. Please contact support.');
      } else if (message.includes('invalid login')) {
        setError('The email or password is incorrect.');
      } else {
        setError(result.error.message);
      }
      return;
    }
    if (mode === 'signup' && !result.data.session) {
      setSuccess('Account created. Check your email to confirm your account, then sign in.');
      setMode('signin');
      return;
    }
    setSuccess('Signed in successfully.');
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-24">
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-20" />
      <div className="absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-neon-500/15 blur-[120px]" />
      <div className="card relative w-full max-w-md p-6 shadow-glow sm:p-8">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-neon-400 to-grape-500 shadow-neon">
            <Zap className="h-6 w-6 text-ink-950" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-2 text-sm text-white/50">{mode === 'signin' ? 'Sign in to manage orders and wallet deposits.' : 'Start growing with Lets Groww today.'}</p>
        </div>

        <div className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50"><Mail className="h-3.5 w-3.5" /> Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="input-field" />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50"><LockKeyhole className="h-3.5 w-3.5" /> Password</span>
            <span className="relative block">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" className="input-field pr-11" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white" aria-label="Toggle password visibility">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          {error && <p className="rounded-xl border border-accent-red/30 bg-accent-red/10 px-3 py-3 text-sm text-accent-red">{error}</p>}
          {success && <p className="rounded-xl border border-accent-green/30 bg-accent-green/10 px-3 py-3 text-sm text-accent-green">{success}</p>}

          <button onClick={submit} disabled={busy} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
            {mode === 'signin' ? <ArrowRight className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess(''); }} className="mt-6 w-full text-center text-sm text-white/45 hover:text-neon-300">
          {mode === 'signin' ? 'New to Lets Groww? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </main>
  );
}
