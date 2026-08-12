export default function DonutChart({ data, size = 190, thickness = 22, centerLabel = 'Total' }) {
  const active = data.filter((d) => d.value > 0);
  const total = active.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) return null;

  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let acc = 0;
  const segments = active.map((d) => {
    const len = (d.value / total) * circumference;
    const seg = { ...d, dash: `${len} ${circumference - len}`, offset: acc };
    acc += len;
    return seg;
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={thickness}
          />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={s.dash}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-extrabold text-gray-900 leading-none">{total}</span>
          <span className="text-[11px] text-gray-500 mt-1">{centerLabel}</span>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {segments.map((d) => (
          <li key={d.label} className="flex items-center gap-2.5 text-[13px]">
            <span className="w-3 h-3 rounded-[4px] shrink-0" style={{ background: d.color }} />
            <span className="text-gray-700 font-medium flex-1">{d.label}</span>
            <span className="text-gray-400 font-semibold tabular-nums">{d.value}</span>
            <span className="text-gray-900 font-bold tabular-nums w-11 text-right">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
