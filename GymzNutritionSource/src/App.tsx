import { useState, useEffect, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, Settings, Bot, Activity, Users, Zap } from 'lucide-react';

const WAITLIST_ANCHOR = '#waitlist';

async function submitWaitlistLead(payload: {
  fullName: string;
  email: string;
  gymName: string;
  memberCount: string;
}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Waitlist is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/website_inquiries`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      'Content-Profile': 'public',
    },
    body: JSON.stringify({
      full_name: payload.fullName,
      email: payload.email,
      interest: `Waitlist — ${payload.gymName} (${payload.memberCount})`,
      message: `Gym owner joined waitlist from gymzandnutrition page.`,
      source: 'gymzandnutrition_waitlist',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || 'Failed to join waitlist.');
  }
}

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'bg-white/90 backdrop-blur-xl border-b border-black/5 h-16 shadow-sm' : 'bg-transparent h-24'}`}>
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
          <img src="/logo.png" alt="Gymz Logo" className="h-10 w-auto group-hover:scale-110 transition-transform" />
          <span className="text-2xl font-black tracking-tighter text-[#050B14]">Gymz</span>
        </div>
        <div className="hidden md:flex items-center gap-10 text-[10px] font-black text-[#050B14]/40 uppercase tracking-[0.3em]">
          <a href="#results" className="hover:text-[#050B14] hover:tracking-[0.4em] transition-all">Results</a>
          <a href="#how-it-works" className="hover:text-[#050B14] hover:tracking-[0.4em] transition-all">How it Works</a>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={WAITLIST_ANCHOR}
            className="relative group overflow-hidden bg-[#050B14] hover:bg-primary text-white hover:text-black px-6 py-3 rounded-full text-xs font-black transition-all animate-pulse-glow"
          >
            <span className="relative z-10">Join Owner Waitlist</span>
            <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </a>
        </div>
      </div>
    </nav>
  );
};

const DashboardCard = () => (
  <div className="animate-fade-in-up relative w-full max-w-sm aspect-square bg-white border border-black/5 rounded-[3rem] p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden group">
    <div className="absolute top-0 right-0 p-6">
      <div className="px-3 py-1 bg-primary/20 border border-primary/30 rounded-full text-[10px] font-black text-black animate-pulse tracking-widest">
        REAL-TIME PROFIT
      </div>
    </div>
    
    <div className="flex flex-col h-full justify-between">
      <div>
        <h4 className="text-[10px] font-black text-black/30 mb-1 uppercase tracking-[0.2em]">Retention Engine</h4>
        <h3 className="text-2xl font-black text-[#050B14] mb-6 group-hover:text-primary transition-colors">98.2% Loyalty</h3>
        
        <div className="relative w-48 h-48 mx-auto mb-8 group-hover:scale-105 transition-transform duration-500">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-black/5" />
            <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="552" strokeDashoffset="480" className="text-primary" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-[#050B14]">2.4x</span>
            <span className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em] mt-1">ROI Index</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black/5 p-4 rounded-2xl border border-black/5 text-center group-hover:bg-primary/10 transition-colors">
          <div className="text-[10px] font-bold text-black/30 uppercase mb-1 tracking-widest">Revenue</div>
          <div className="text-xl font-black text-black">+$12.4k</div>
        </div>
        <div className="bg-black/5 p-4 rounded-2xl border border-black/5 text-center">
          <div className="text-[10px] font-bold text-black/30 uppercase mb-1 tracking-widest">Churn</div>
          <div className="text-xl font-black text-black">0.4%</div>
        </div>
      </div>
    </div>
  </div>
);

const Hero = () => (
  <section className="pt-48 pb-32 px-6 relative overflow-hidden bg-white">
    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(204,255,0,0.15)_0%,transparent_50%)]" />
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
      <div className="animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-black text-[10px] font-black uppercase tracking-[0.3em] mb-8">
          <Zap size={14} className="fill-black" />
          <span>Stop the Churn. Grow the Profit.</span>
        </div>
        <h1 className="text-6xl md:text-8xl font-black mb-8 leading-[0.95] tracking-tight text-[#050B14]">
          The Solution <br />
          <span className="text-primary italic">Pays for Itself</span>
        </h1>
        <p className="text-xl text-black/50 mb-12 max-w-xl leading-relaxed font-medium">
          Gym owners don't need more features. You need <span className="text-black font-bold">members who stay</span> and <span className="text-black font-bold">revenue that grows.</span> 
          We turn your existing iron into a retention engine.
        </p>
        <div className="flex flex-col sm:flex-row gap-6 mb-16">
          <a href={WAITLIST_ANCHOR} className="bg-[#050B14] hover:bg-primary text-white hover:text-black px-10 py-5 rounded-2xl font-black flex items-center justify-center gap-3 group transition-all text-xl shadow-2xl shadow-black/10">
            Join the Waitlist
            <ArrowRight className="group-hover:translate-x-2 transition-transform" />
          </a>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {[
            { label: "Rev Growth", value: "2.4x", icon: Activity },
            { label: "Retention", value: "98%", icon: Users },
            { label: "Engagement", value: "9x", icon: Zap },
            { label: "ROI", value: "< 6mo", icon: ClipboardCheck },
          ].map((stat, i) => (
            <div key={i} className="group cursor-default">
              <div className="text-3xl font-black text-[#050B14] group-hover:text-primary transition-colors duration-300">{stat.value}</div>
              <div className="text-[10px] font-bold text-black/30 uppercase tracking-[0.2em] mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center lg:justify-end relative animate-fade-in-up [animation-delay:200ms]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-primary/20 rounded-full blur-[180px] -z-10" />
        <DashboardCard />
      </div>
    </div>
  </section>
);

const FeaturesSection = () => (
  <section id="results" className="py-40 px-6 bg-[#F8F9FA]">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-32 animate-fade-in-up">
        <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter text-[#050B14]">Stop Managing. <br /><span className="text-primary italic">Start Scaling.</span></h2>
        <p className="text-black/40 max-w-2xl mx-auto text-xl leading-relaxed font-medium">We fixed the "membership bleed." Our ecosystem turns a standard gym workout into an addictive, results-driven feedback loop.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {[
          {
            title: "For Owners",
            accent: "Profit",
            benefits: [
              "Kill churn with AI-driven member nudges",
              "Double revenue via digital subscription layers",
              "Modernize your brand at 1/10th the gear cost",
              "Automate operations to reclaim your free time",
              "Data that proves ROI every single morning"
            ]
          },
          {
            title: "For Members",
            accent: "Results",
            benefits: [
              "Never guess your next set or weight again",
              "Feel the progress with real-time rep metrics",
              "Unlock achievements that make training addictive",
              "Direct 1:1 line to your human coach",
              "No plateaus. Just consistent, visible growth"
            ]
          },
          {
            title: "For Coaches",
            accent: "Scale",
            benefits: [
              "Manage 5x more clients with zero extra work",
              "See every lift without being physically there",
              "Automated tracking replaces the clipboard",
              "Scale your income with premium digital tiers",
              "Highest client retention in the fitness industry"
            ]
          }
        ].map((target, i) => (
          <div key={i} className={`animate-fade-in-up p-12 rounded-[3.5rem] bg-white border ${i === 1 ? 'border-primary' : 'border-black/5'} shadow-sm hover:shadow-xl transition-all duration-500 group`}>
            <h3 className="text-3xl font-black mb-10 text-[#050B14] leading-tight">
              {target.title}: <br />
              <span className={`${i === 1 ? 'text-primary' : 'text-black/30'} group-hover:text-primary transition-colors`}>{target.accent}</span>
            </h3>
            <ul className="space-y-6">
              {target.benefits.map((benefit, j) => (
                <li key={j} className="flex gap-4 text-black/50 group-hover:text-black transition-colors">
                  <CheckCircle2 size={24} className="text-primary shrink-0" />
                  <span className="text-base font-bold leading-tight">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const HowItWorks = () => (
  <section id="how-it-works" className="py-40 px-6 bg-white relative">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-32 animate-fade-in-up">
        <h2 className="text-5xl md:text-7xl font-black mb-8 italic tracking-tighter text-[#050B14]">How It <span className="text-primary NOT-italic">Actually</span> Works</h2>
        <p className="text-black/40 max-w-2xl mx-auto text-xl font-medium">The engine behind 98% member retention. Simple. Tactical. Effective.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative animate-fade-in-up [animation-delay:200ms]">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-black/5 to-transparent -z-10 hidden lg:block" />
        {[
          { step: "01", title: "Retrofit Fast", desc: "sensors and tablets turn your existing iron into smart assets. Overnight.", icon: Settings },
          { step: "02", title: "The Hook", desc: "Members get hooked on the real-time feedback and gamified progression.", icon: Zap },
          { step: "03", title: "Retention AI", desc: "Our system flags exactly who is about to quit before they even know it.", icon: Bot },
          { step: "04", title: "Stack Profit", desc: "Watch your take-home pay double through high retention and digital tiers.", icon: Activity },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center text-center group bg-white p-4">
            <div className="w-20 h-20 rounded-2xl bg-black/[0.03] border border-black/5 flex items-center justify-center text-2xl font-black text-primary mb-8 group-hover:border-primary group-hover:bg-primary/5 group-hover:-translate-y-2 transition-all shadow-sm">
              {item.step}
            </div>
            <h3 className="text-xl font-black mb-4 text-[#050B14] group-hover:text-primary transition-colors">{item.title}</h3>
            <p className="text-black/30 text-sm leading-relaxed font-medium">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const FinalCTA = () => {
  const [formState, setFormState] = useState({
    fullName: '',
    email: '',
    gymName: '',
    memberCount: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string>('');

  const onChange = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback('');

    try {
      await submitWaitlistLead(formState);
      setFeedback('You are in. We will contact you in 1 business day with rollout details.');
      setFormState({
        fullName: '',
        email: '',
        gymName: '',
        memberCount: '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join waitlist right now.';
      setFeedback(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="waitlist" className="py-40 px-6">
      <div className="animate-fade-in-up max-w-5xl mx-auto bg-primary rounded-[4rem] p-16 md:p-24 text-center relative overflow-hidden shadow-[0_48px_96px_-12px_rgba(204,255,0,0.4)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/40 rounded-full blur-[128px] -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <h2 className="text-5xl md:text-8xl font-black mb-10 text-black leading-[0.9] tracking-tighter">Owner Waitlist</h2>
          <p className="text-black/70 text-xl md:text-2xl mb-16 max-w-2xl mx-auto font-bold leading-relaxed">
            Be first to launch Gymz at your gym. Limited onboarding slots each month.
          </p>

          <form onSubmit={onSubmit} className="max-w-md mx-auto space-y-4 text-left">
            <input
              type="text"
              required
              value={formState.fullName}
              onChange={(e) => onChange('fullName', e.target.value)}
              placeholder="Owner full name"
              className="w-full bg-white/20 border-2 border-white/20 rounded-3xl p-6 text-black placeholder:text-black/40 focus:outline-none focus:bg-white focus:border-black/10 transition-all font-bold"
            />
            <input
              type="email"
              required
              value={formState.email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="Business email"
              className="w-full bg-white/20 border-2 border-white/20 rounded-3xl p-6 text-black placeholder:text-black/40 focus:outline-none focus:bg-white focus:border-black/10 transition-all font-bold"
            />
            <input
              type="text"
              required
              value={formState.gymName}
              onChange={(e) => onChange('gymName', e.target.value)}
              placeholder="Gym name"
              className="w-full bg-white/20 border-2 border-white/20 rounded-3xl p-6 text-black placeholder:text-black/40 focus:outline-none focus:bg-white focus:border-black/10 transition-all font-bold"
            />
            <input
              type="text"
              required
              value={formState.memberCount}
              onChange={(e) => onChange('memberCount', e.target.value)}
              placeholder="Current members (e.g. 250)"
              className="w-full bg-white/20 border-2 border-white/20 rounded-3xl p-6 text-black placeholder:text-black/40 focus:outline-none focus:bg-white focus:border-black/10 transition-all font-bold"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-black text-white hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100 px-10 py-6 rounded-3xl font-black transition-all text-2xl mt-8 shadow-2xl"
            >
              {submitting ? 'Joining Waitlist...' : 'Join the Waitlist'}
            </button>
            <p className="text-sm text-black/70 font-semibold">
              {feedback || 'No spam. Owner applications only.'}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="py-24 px-6 border-t border-black/5 bg-[#F8F9FA]">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-16">
      <div className="flex flex-col gap-6 items-center md:items-start text-center md:text-left">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Gymz Logo" className="h-10 w-auto opacity-80" />
          <span className="text-2xl font-black text-[#050B14] tracking-tighter uppercase">Gymz</span>
        </div>
        <p className="text-sm text-black/20 font-medium leading-relaxed max-w-xs">Connecting humans and hardware to create the ultimate high-conversion gym experience.</p>
      </div>
      
      <div className="flex flex-col items-center md:items-end gap-8">
        <div className="text-2xl font-black text-[#050B14] tracking-tighter hover:text-primary transition-all cursor-pointer">hello@gymz.app</div>
        <div className="flex flex-col items-center md:items-end gap-2">
          <div className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em]">© 2026 Gymz. All rights reserved.</div>
          <div className="flex gap-10 text-[10px] font-black text-black/30 uppercase tracking-[0.2em]">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </div>
  </footer>
);

export default function App() {
  return (
    <div className="min-h-screen bg-white text-[#050B14] selection:bg-primary selection:text-black">
      <Navbar />
      <Hero />
      <FeaturesSection />
      <HowItWorks />
      <FinalCTA />
      <Footer />
    </div>
  );
}
