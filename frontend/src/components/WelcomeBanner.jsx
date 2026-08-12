import { useEffect, useState } from 'react';
import Icon from './Icons.jsx';

const fullDateFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

export default function WelcomeBanner() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section
      data-purpose="welcome-banner"
      className="bg-maroon-gradient rounded-3xl p-8 md:p-12 text-white relative overflow-hidden shadow-sm"
    >
      <div className="absolute right-0 top-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_70%)] opacity-50" />

      <div className="relative z-10 flex justify-between items-center h-full">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-8 h-[2px] bg-pink-400 block" />
            <p className="text-[11px] font-bold tracking-[0.2em] text-pink-100 uppercase">
              OSAS Overview
            </p>
          </div>

          <h1 className="text-4xl md:text-[44px] font-extrabold mb-5 leading-[1.1] tracking-tight">
            Welcome Back, OSAS
            <br />
            Administrator!
          </h1>

          <p className="text-[15px] text-gray-200 mb-8 max-w-xl font-light">
            Manage student affairs, safety protocols, and emergency responses. Monitor
            school activities and ensure a secure environment.
          </p>

          <div className="inline-flex items-center gap-3 bg-white/5 rounded-2xl px-5 py-3 border border-white/10 backdrop-blur-md">
            <Icon name="clock" size={16} className="text-pink-200" />
            <div>
              <p className="text-[9px] text-gray-300 uppercase tracking-widest font-bold">
                Current Date and Time
              </p>
              <p className="text-sm font-bold mt-0.5">
                {fullDateFmt.format(now)} at {timeFmt.format(now)}
              </p>
            </div>
          </div>
        </div>

        <div className="hidden md:block pr-8">
          <div className="w-44 h-44 rounded-full border border-white/10 flex items-center justify-center p-2 bg-black/5 relative">
            <div className="absolute inset-0 rounded-full border border-dashed border-pink-300/30" />
            <img
              src="/logo.png"
              alt="SAAC Seal"
              className="w-32 h-32 object-contain relative z-10"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
