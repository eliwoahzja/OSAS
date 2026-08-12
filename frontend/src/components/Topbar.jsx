import { useEffect, useState } from 'react';
import Icon from './Icons.jsx';

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export default function Topbar({ onMenuClick }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header
      data-purpose="top-header"
      className="bg-transparent px-10 py-6 flex items-center justify-between shrink-0"
    >
      <div className="flex items-center gap-4">
        <button
          className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 shadow-sm cursor-pointer"
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
          <Icon name="bars" size={16} />
        </button>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-0.5">
            Administrator Workspace
          </p>
          <h2 className="text-2xl font-bold text-gray-900 leading-none">Admin Dashboard</h2>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <Icon name="calendar" size={18} className="text-gray-400" />
          <div className="text-sm leading-tight">
            <p className="text-gray-500 text-[10px]">Today</p>
            <p className="font-bold text-gray-900 text-xs">{dateFmt.format(now)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 cursor-pointer ml-4">
          <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-sm">
            LA
          </div>
          <div className="leading-tight hidden sm:block">
            <p className="text-sm font-bold text-gray-900">Local Administrator</p>
            <p className="text-[11px] text-gray-500">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
