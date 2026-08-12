import Icon from './Icons.jsx';

const COLORS = {
  pink: { blob: 'bg-pink-50', icon: 'bg-pink-50 text-pink-600' },
  blue: { blob: 'bg-blue-50', icon: 'bg-blue-50 text-blue-600' },
  emerald: { blob: 'bg-emerald-50', icon: 'bg-emerald-50 text-emerald-600' },
  amber: { blob: 'bg-amber-50', icon: 'bg-amber-50 text-amber-600' },
  red: { blob: 'bg-red-50', icon: 'bg-red-50 text-red-600' },
  purple: { blob: 'bg-purple-50', icon: 'bg-purple-50 text-purple-600' },
};

export default function StatCard({ stat }) {
  const c = COLORS[stat.color] || COLORS.pink;

  return (
    <article className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden group">
      <div
        className={`absolute -right-8 -bottom-8 w-32 h-32 ${c.blob} rounded-full opacity-50`}
      />
      <div className="relative z-10">
        <div
          className={`w-8 h-8 rounded-xl ${c.icon} flex items-center justify-center mb-4`}
        >
          <Icon name={stat.icon} className="text-sm" />
        </div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {stat.label}
        </p>
        <p className="text-[32px] font-extrabold text-gray-900 mt-2 leading-none">
          {stat.value}
        </p>
        <p className="text-[11px] text-gray-500 mt-5 whitespace-pre-line">{stat.hint}</p>
      </div>
    </article>
  );
}
