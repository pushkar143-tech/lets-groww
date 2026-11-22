import { Zap, Headphones, IndianRupee, ShieldCheck } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Instant Delivery',
    desc: 'Orders start within seconds. Most services deliver in minutes, not days.',
    color: 'text-neon-300',
    glow: 'bg-neon-500/15',
    border: 'group-hover:border-neon-400/40',
  },
  {
    icon: Headphones,
    title: '24/7 Support',
    desc: 'Real humans on standby around the clock to resolve any order issue.',
    color: 'text-grape-300',
    glow: 'bg-grape-500/15',
    border: 'group-hover:border-grape-400/40',
  },
  {
    icon: IndianRupee,
    title: 'Ultra-Cheap Rates',
    desc: 'Lowest prices in India with transparent per-1000 pricing for every tier.',
    color: 'text-accent-green',
    glow: 'bg-accent-green/15',
    border: 'group-hover:border-accent-green/40',
  },
  {
    icon: ShieldCheck,
    title: 'Safe &amp; Secure',
    desc: 'No login details ever needed. Encrypted payments and anonymous delivery.',
    color: 'text-accent-amber',
    glow: 'bg-accent-amber/15',
    border: 'group-hover:border-accent-amber/40',
  },
];

export default function WhyChooseUs() {
  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <span className="chip border border-white/10 bg-white/5 text-white/60">Why Lets Groww</span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Why Creators Choose <span className="text-gradient">Us</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/50">
            Built for speed, priced for everyone. The panel trusted by thousands of resellers and brands.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className={`card group p-6 transition-all duration-300 hover:-translate-y-1 ${f.border}`}
            >
              <span className={`grid h-12 w-12 place-items-center rounded-xl ${f.glow} ${f.color}`}>
                <f.icon className="h-6 w-6" />
              </span>
              <h3
                className="mt-4 text-base font-semibold text-white"
                dangerouslySetInnerHTML={{ __html: f.title }}
              />
              <p className="mt-2 text-sm text-white/50">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
