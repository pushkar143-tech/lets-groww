import { Zap, Mail, Phone, Send } from 'lucide-react';

interface FooterProps {
  onNavigate: (v: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="relative border-t border-white/5 bg-ink-900/60">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-400 to-grape-500 shadow-neon">
                <Zap className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
              </span>
              <span className="font-display text-lg font-bold">
                Lets<span className="text-gradient"> Groww</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-white/50">
              India's fastest SMM panel. High-quality social growth at the lowest prices — delivered instantly.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-sm font-semibold text-white">Quick Links</h4>
            <ul className="mt-4 space-y-2 text-sm text-white/50">
              <li><button onClick={() => onNavigate('home')} className="hover:text-neon-300">Home</button></li>
              <li><button onClick={() => onNavigate('services')} className="hover:text-neon-300">Services</button></li>
              <li><button onClick={() => onNavigate('services')} className="hover:text-neon-300">Pricing</button></li>
              <li><button onClick={() => onNavigate('dashboard')} className="hover:text-neon-300">Dashboard</button></li>
              <li><button onClick={() => onNavigate('deposit')} className="hover:text-neon-300">Deposit Funds</button></li>
            </ul>
          </div>

          {/* Platforms */}
          <div>
            <h4 className="text-sm font-semibold text-white">Platforms</h4>
            <ul className="mt-4 space-y-2 text-sm text-white/50">
              <li>Instagram</li>
              <li>YouTube</li>
              <li>TikTok / Reels</li>
              <li>Telegram · Facebook · X</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white">Get in touch</h4>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex flex-col items-start gap-2">
                <a href="mailto:letsgroww46@gmail.com" className="chip border border-white/10 bg-white/5 text-white/70 hover:border-neon-400/40">
                  <Mail className="h-3.5 w-3.5" /> letsgroww46@gmail.com
                </a>
                <a href="tel:+91922057665" className="chip border border-white/10 bg-white/5 text-white/70 hover:border-neon-400/40">
                  <Phone className="h-3.5 w-3.5" /> +91 922057665
                </a>
                <a
                  href="https://t.me/letsgrowwofficial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chip border border-sky-400/30 bg-sky-500/10 text-sky-300 hover:border-sky-400/60 hover:text-sky-200"
                >
                  <Send className="h-3.5 w-3.5" /> @letsgrowwofficial
                </a>
              </div>
            </div>
            <button onClick={() => onNavigate('dashboard')} className="btn-primary mt-4 w-full !py-2.5">
              <Send className="h-4 w-4" /> Start Growing
            </button>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-white/40 sm:flex-row">
          <p>© {new Date().getFullYear()} Lets Groww. All rights reserved.</p>
          <p>Made in India 🇮🇳 · Terms · Privacy · Refund Policy</p>
        </div>
      </div>
    </footer>
  );
}
