import Icon from './Icons.jsx';
import { viewMeta } from '../data/mockData.js';

export default function PagePlaceholder({ view }) {
  const meta = viewMeta[view] || {
    title: view,
    subtitle: 'This module is not configured yet.',
    icon: 'dashboard',
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-0.5">
          Administrator Workspace
        </p>
        <h2 className="text-2xl font-bold text-gray-900 leading-none">{meta.title}</h2>
        <p className="text-sm text-gray-500 mt-1">{meta.subtitle}</p>
      </div>

      <section className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 flex flex-col items-center gap-3 text-center">
        <div className="w-16 h-16 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
          <Icon name={meta.icon} className="text-3xl" />
        </div>
        <span className="px-3 py-1 rounded-full bg-pink-50 text-pink-600 text-[10px] font-bold tracking-widest uppercase">
          In Development
        </span>
        <h3 className="text-lg font-extrabold text-gray-900">{meta.title}</h3>
        <p className="max-w-md text-[13px] text-gray-500">
          This module is next on the build list. Once wired up, it will follow the OSAS
          dashboard design system.
        </p>
        <button
          className="mt-2 px-4 py-2 rounded-xl bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition-colors cursor-pointer"
          onClick={() =>
            document
              .querySelector('[data-purpose="dashboard-content"]')
              ?.scrollTo({ top: 0, behavior: 'smooth' })
          }
        >
          Back to top
        </button>
      </section>
    </div>
  );
}
