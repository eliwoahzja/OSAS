import { useState } from 'react';
import Icon from './Icons.jsx';

export default function ModulePage({ icon, title, subtitle, actionLabel, actionIcon = 'add', children }) {
  const [toast, setToast] = useState(false);

  const showToast = () => {
    setToast(true);
    window.setTimeout(() => setToast(false), 3200);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
            <Icon name={icon} className="text-xl" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-0.5">
              Administrator Workspace
            </p>
            <h2 className="text-2xl font-bold text-gray-900 leading-none">{title}</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">{subtitle}</p>
          </div>
        </div>

        {actionLabel && (
          <button
            onClick={showToast}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-700 transition-colors cursor-pointer"
          >
            <Icon name={actionIcon} className="text-base" />
            {actionLabel}
          </button>
        )}
      </div>

      {children}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-[13px] font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <Icon name="check_circle" className="text-emerald-400" />
          <span>Sample data view — the entry form isn't wired to a backend yet.</span>
          <button
            onClick={() => setToast(false)}
            className="text-gray-400 hover:text-white cursor-pointer ml-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
