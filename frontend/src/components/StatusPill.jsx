const TONES = {
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  pink: 'bg-pink-50 text-pink-600',
  gray: 'bg-gray-100 text-gray-500',
};

const STATUS_TONE = {
  passed: 'green',
  completed: 'green',
  resolved: 'green',
  delivered: 'green',
  active: 'green',
  ok: 'green',
  available: 'green',
  pending: 'amber',
  upcoming: 'amber',
  open: 'amber',
  sent: 'amber',
  medium: 'amber',
  overdue: 'red',
  cancelled: 'red',
  failed: 'red',
  high: 'red',
  critical: 'red',
  read: 'purple',
  reviewed: 'purple',
};

export default function StatusPill({ status, label, tone }) {
  const toneClass = TONES[tone || STATUS_TONE[String(status).toLowerCase()] || 'gray'];
  const text = label || String(status).replace(/[_-]/g, ' ');

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold capitalize whitespace-nowrap ${toneClass}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}
