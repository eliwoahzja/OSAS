/**
 * Campus Risk Assessment Engine
 *
 * Implements the standard institutional risk formula:
 *   Risk = (Threat × Vulnerability × (Exploit Likelihood × Exploit Impact) × Asset Value) - Security Controls
 *
 * Parameter Scales:
 *   All factors are rated from 1 to 5 (Bond 1 - 5 rating scale):
 *     1: Minimal / Very Low
 *     2: Minor / Low
 *     3: Moderate / Medium
 *     4: Significant / High
 *     5: Severe / Critical
 *
 * Official Risk Level Thresholds:
 *   1 – 250     : Low
 *   251 – 500   : Moderate
 *   501 – 750   : High
 *   751 – 1000+ : Critical
 */

import { h, icon } from './ui.js';

export const RISK_SCALE = [
  { min: 1, max: 250, label: 'Low', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { min: 251, max: 500, label: 'Moderate', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { min: 501, max: 750, label: 'High', color: 'red', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  { min: 751, max: Infinity, label: 'Critical', color: 'rose', bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-300' },
];

export function getRiskLevel(score) {
  if (score >= 751) return 'Critical';
  if (score >= 501) return 'High';
  if (score >= 251) return 'Moderate';
  return 'Low';
}

export function computeRiskScore(data = {}) {
  const t = Math.max(1, Math.min(5, Math.round(Number(data.threat ?? data.threat_rating) || 1)));
  const v = Math.max(1, Math.min(5, Math.round(Number(data.vulnerability ?? data.vulnerability_rating) || 1)));
  const el = Math.max(1, Math.min(5, Math.round(Number(data.exploit_likelihood ?? data.exploitLikelihood) || 1)));
  const ei = Math.max(1, Math.min(5, Math.round(Number(data.exploit_impact ?? data.exploitImpact) || 1)));
  const av = Math.max(1, Math.min(5, Math.round(Number(data.asset_value ?? data.assetValue) || 1)));
  const sc = Math.max(1, Math.min(5, Math.round(Number(data.security_controls ?? data.securityControls) || 1)));

  // Institutional risk formula calculated in background:
  // Risk = (Threat × Vulnerability × (Exploit Likelihood × Exploit Impact) × Asset Value) - Security Controls
  const tv = t * v;
  const exploit = el * ei;
  const gross = tv * exploit * av;
  const score = Math.max(0, gross - sc);
  const level = getRiskLevel(score);

  return {
    threat: t,
    vulnerability: v,
    exploit_likelihood: el,
    exploit_impact: ei,
    asset_value: av,
    security_controls: sc,
    tv,
    exploit,
    gross,
    score,
    level,
  };
}

/**
 * Renders a clean, compact 5-segment rating bar for safety factor ratings.
 */
export function factorSegments(val, max = 5, color = 'pink') {
  const current = Math.max(0, Math.min(max, Number(val) || 0));
  const activeColor =
    color === 'red'
      ? 'bg-red-500'
      : color === 'rose'
      ? 'bg-rose-600'
      : color === 'amber'
      ? 'bg-amber-500'
      : color === 'emerald'
      ? 'bg-emerald-500'
      : color === 'blue'
      ? 'bg-blue-600'
      : 'bg-pink-600';

  const segments = [];
  for (let i = 1; i <= max; i++) {
    segments.push(
      h('span', {
        class: `h-1.5 w-3.5 rounded-full transition-colors ${
          i <= current ? activeColor : 'bg-gray-200'
        }`,
      }),
    );
  }
  return h('div', { class: 'inline-flex items-center gap-1 shrink-0', title: `${current} of ${max}` }, ...segments);
}

/**
 * Institutional Header for the Risk Assessment Register.
 */
export function riskRegisterHeader(risks = []) {
  const total = risks.length;
  const critical = risks.filter((r) => (Number(r.risk_score) || computeRiskScore(r).score) >= 751).length;
  const high = risks.filter((r) => {
    const s = Number(r.risk_score) || computeRiskScore(r).score;
    return s >= 501 && s <= 750;
  }).length;
  const moderate = risks.filter((r) => {
    const s = Number(r.risk_score) || computeRiskScore(r).score;
    return s >= 251 && s <= 500;
  }).length;
  const low = risks.filter((r) => (Number(r.risk_score) || computeRiskScore(r).score) <= 250).length;

  return h('div', { class: 'bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 space-y-6 mb-6' },
    h('div', { class: 'flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5' },
      h('div', { class: 'space-y-1' },
        h('div', { class: 'flex items-center gap-2' },
          h('span', { class: 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-pink-50 text-pink-600 border border-pink-100 tracking-wider' },
            'Campus Safety Register',
          ),
          h('span', { class: 'text-xs text-gray-400 font-semibold' }, 'OSAS Facility Assessment Framework'),
        ),
        h('h3', { class: 'text-2xl font-black text-gray-900 tracking-tight' },
          'Hazard & Risk Assessment Register',
        ),
        h('p', { class: 'text-xs text-gray-500 max-w-2xl' },
          'Continuous evaluation of physical hazards, structural vulnerabilities, and active safeguarding controls across all Saint Agnes Academy facilities.',
        ),
      ),
      h('div', { class: 'flex items-center gap-2' },
        critical + high > 0
          ? h('span', { class: 'px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1.5' },
              h('span', { class: 'w-2 h-2 rounded-full bg-red-500 animate-pulse' }),
              `${critical + high} Requiring Priority Action`,
            )
          : h('span', { class: 'px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5' },
              icon('check_circle', 'text-xs'),
              'All Hazards Within Safe Limits',
            ),
      ),
    ),

    // Four Clean Metric Cards with Visual Rating Bars
    h('div', { class: 'grid grid-cols-2 md:grid-cols-4 gap-3.5' },
      [
        {
          label: 'Critical Priority',
          count: critical,
          badge: 'Immediate Action',
          border: 'border-rose-200/80',
          bg: 'bg-rose-50/40',
          text: 'text-rose-900',
          barColor: 'bg-rose-500',
          pct: total ? Math.round((critical / total) * 100) : 0,
        },
        {
          label: 'Elevated Risk',
          count: high,
          badge: 'Scheduled Controls',
          border: 'border-red-200/80',
          bg: 'bg-red-50/40',
          text: 'text-red-900',
          barColor: 'bg-red-500',
          pct: total ? Math.round((high / total) * 100) : 0,
        },
        {
          label: 'Monitored Range',
          count: moderate,
          badge: 'Routine Inspection',
          border: 'border-amber-200/80',
          bg: 'bg-amber-50/40',
          text: 'text-amber-900',
          barColor: 'bg-amber-500',
          pct: total ? Math.round((moderate / total) * 100) : 0,
        },
        {
          label: 'Safe Baseline',
          count: low,
          badge: 'Standard Operations',
          border: 'border-emerald-200/80',
          bg: 'bg-emerald-50/40',
          text: 'text-emerald-900',
          barColor: 'bg-emerald-500',
          pct: total ? Math.round((low / total) * 100) : 0,
        },
      ].map((card) =>
        h('div', { class: `p-4 rounded-2xl border ${card.border} ${card.bg} space-y-2` },
          h('div', { class: 'flex items-center justify-between' },
            h('span', { class: 'text-xs font-bold text-gray-700' }, card.label),
            h('span', { class: 'text-[10px] font-semibold text-gray-400' }, card.badge),
          ),
          h('div', { class: 'flex items-baseline gap-2' },
            h('span', { class: `text-2xl font-black ${card.text}` }, String(card.count)),
            h('span', { class: 'text-xs text-gray-500 font-semibold' }, `(${card.pct}%)`),
          ),
          h('div', { class: 'w-full h-1.5 rounded-full bg-gray-200/80 overflow-hidden' },
            h('div', {
              class: `h-full rounded-full ${card.barColor} transition-all duration-500`,
              style: { width: `${card.pct}%` },
            }),
          ),
        ),
      ),
    ),
  );
}
