import {
  h, icon, pill, labelCls, openModal, formatDate,
} from '../ui.js';
import {
  computeRiskScore, scoreToLevel, levelBandRange,
} from './risk.js';

export function generateRiskRationale(factors, score, level) {
  const t = Number(factors.threat) || 0;
  const v = Number(factors.vulnerability) || 0;
  const el = Number(factors.exploit_likelihood) || 0;
  const ei = Number(factors.exploit_impact) || 0;
  const av = Number(factors.asset_value) || 0;
  const sc = Number(factors.security_controls) || 0;

  let recall = '';
  let action = '';
  switch (level) {
    case 'Critical':
      recall = 'Immediate Containment Required: Extreme compounding exposure with severe consequence to student safety or school operations; takes emergency precedence over routine tasks.';
      action = 'Halt or isolate affected facilities immediately, notify OSAS leadership, and deploy emergency mitigation within 24 hours.';
      break;
    case 'High':
      recall = 'Elevated Action Priority: Substantial hazard with serious damage potential or high exploit probability; requires expedited remediation.';
      action = 'Implement formal corrective measures and review risk status weekly until resolved.';
      break;
    case 'Moderate':
      recall = 'Controlled Supervisory Oversight: Manageable operational hazard with balanced exposure; handled under standard campus safety routines.';
      action = 'Schedule targeted maintenance or procedural updates during regular operational cycles.';
      break;
    case 'Low':
    default:
      recall = 'Routine Baseline Monitoring: Minor residual hazard; existing controls effectively suppress risk under normal conditions.';
      action = 'Maintain current preventive controls and inspect during periodic safety audits.';
      break;
  }

  const elevated = [];
  if (t >= 4) elevated.push(`severe threat source intensity (${t}/5)`);
  if (v >= 4) elevated.push(`pronounced structural or procedural vulnerability (${v}/5)`);
  if (el >= 4 && ei >= 4) elevated.push(`both frequent exploit probability (${el}/5) and severe operational impact (${ei}/5)`);
  else if (el >= 4) elevated.push(`frequent probability of exploit (${el}/5)`);
  else if (ei >= 4) elevated.push(`severe damage consequence (${ei}/5)`);
  if (av >= 4) elevated.push(`critical student safety or high-value campus assets (${av}/5)`);

  let controlsNote = '';
  if (sc <= 2) {
    controlsNote = `Existing security controls (${sc}/5) are minimal, leaving little protection against escalation.`;
  } else if (sc >= 4) {
    controlsNote = `Strong existing security controls (${sc}/5) actively subtract from the overall exposure, but the compounding multipliers still elevate the net score.`;
  } else {
    controlsNote = `Standard baseline safeguards (${sc}/5) are in place.`;
  }

  let description = '';
  if (elevated.length > 0) {
    description = `Classified as ${level} (risk score: ${score}) primarily driven by ${elevated.join(', ')}. ${controlsNote}`;
  } else {
    description = `Classified as ${level} (risk score: ${score}) with all parameters remaining within standard operational limits. ${controlsNote}`;
  }

  return { recall, action, description, level, score };
}

export function generateLegacyRationale(likelihood, impact, riskLevel) {
  const l = (likelihood || 'Medium').toLowerCase();
  const i = (impact || 'Medium').toLowerCase();

  let recall = '';
  let action = '';
  let description = '';

  if (riskLevel === 'Critical' || (l === 'high' && i === 'high')) {
    recall = 'Critical Incident Exposure: High probability hazard with severe physical or institutional consequences.';
    action = 'Enact immediate corrective mitigation and coordinate with campus safety personnel.';
    description = 'Evaluated using the qualitative matrix: High likelihood paired with High severity impact triggers immediate safety intervention.';
  } else if (riskLevel === 'High' || l === 'high' || i === 'high') {
    recall = 'High Operational Priority: Elevated frequency or severity requiring active administrative tracking.';
    action = 'Assign responsible staff for prioritized remediation within 5 business days.';
    description = `Evaluated using the qualitative matrix: Elevated ${l === 'high' ? 'likelihood of occurrence' : 'impact severity'} demands proactive intervention before condition deteriorates.`;
  } else if (riskLevel === 'Moderate' || riskLevel === 'Medium') {
    recall = 'Moderate Manageable Risk: Standard campus operational variance within tolerable mitigation limits.';
    action = 'Review during scheduled safety rounds and maintain tracking.';
    description = 'Evaluated using the qualitative matrix: Both likelihood and impact are within moderate parameters manageable under standard operational procedures.';
  } else {
    recall = 'Low Baseline Risk: Minor routine concern managed effectively with standard precautions.';
    action = 'Continue baseline monitoring and standard facility inspections.';
    description = 'Evaluated using the qualitative matrix: Low occurrence probability and minimal impact profile.';
  }

  return { recall, action, description };
}

export function getRiskDriverSummary(r) {
  if (!r) {
    return {
      isElevated: false,
      level: 'Low',
      score: null,
      drivers: [],
      reasons: [],
      shortSummary: 'Standard Limits',
      fullSummary: 'Standard Operational Limits',
    };
  }

  const isQuant = hasFactorData(r);
  const score = r.risk_score != null ? Number(r.risk_score) : (isQuant ? computeRiskScore(r) : null);
  const rawLevel = r.risk_level || (score != null ? scoreToLevel(score) : 'Medium');
  const level = String(rawLevel || 'Medium').trim();
  const isElevated = level === 'High' || level === 'Critical';

  const drivers = [];

  if (r.custom_reason) {
    drivers.push({
      label: 'Documented Justification',
      detail: r.custom_reason,
      isCustom: true,
    });
  }

  if (isQuant) {
    const t = Number(r.threat) || 0;
    const v = Number(r.vulnerability) || 0;
    const el = Number(r.exploit_likelihood) || 0;
    const ei = Number(r.exploit_impact) || 0;
    const av = Number(r.asset_value) || 0;
    const sc = Number(r.security_controls) || 0;

    if (t >= 4) drivers.push({ label: 'Elevated Threat', detail: `Threat rating: ${t}/5` });
    if (v >= 4) drivers.push({ label: 'High Vulnerability', detail: `Vulnerability: ${v}/5` });
    if (el >= 4 && ei >= 4) drivers.push({ label: 'High Likelihood & Impact', detail: `Likelihood ${el}/5 · Impact ${ei}/5` });
    else if (el >= 4) drivers.push({ label: 'Frequent Likelihood', detail: `Probability: ${el}/5` });
    else if (ei >= 4) drivers.push({ label: 'Severe Impact', detail: `Impact severity: ${ei}/5` });
    if (av >= 4) drivers.push({ label: 'High Asset/Safety Impact', detail: `Asset value: ${av}/5` });
    if (sc <= 2) drivers.push({ label: 'Limited Controls', detail: `Existing controls: ${sc}/5` });

    if (!drivers.length) {
      drivers.push({ label: `${level} Rating`, detail: `Composite score: ${score}` });
    }
  } else {
    const l = String(r.likelihood || 'Medium').toLowerCase();
    const i = String(r.impact || 'Medium').toLowerCase();

    if (l === 'high' && i === 'high') {
      drivers.push({ label: 'High Likelihood & Impact', detail: 'High probability combined with severe impact' });
    } else if (l === 'high') {
      drivers.push({ label: 'Frequent Occurrence', detail: 'High likelihood of incident occurrence' });
    } else if (i === 'high') {
      drivers.push({ label: 'High Impact', detail: 'Significant potential damage to campus safety or facilities' });
    } else if (l === 'medium' && i === 'medium') {
      drivers.push({ label: 'Moderate Operational Risk', detail: 'Moderate likelihood and impact' });
    } else {
      drivers.push({ label: 'Low Residual Risk', detail: 'Low likelihood with minor impact' });
    }
  }

  const reasons = drivers.map((d) => d.label);
  return {
    isElevated,
    level,
    score,
    drivers,
    reasons,
    shortSummary: r.custom_reason || reasons.slice(0, 2).join(' • '),
    fullSummary: drivers.map((d) => `${d.label}: ${d.detail}`).join('; '),
  };
}

export function hasFactorData(r) {
  return r &&
    r.threat != null &&
    r.vulnerability != null &&
    r.exploit_likelihood != null &&
    r.exploit_impact != null &&
    r.asset_value != null &&
    r.security_controls != null;
}

export function showRiskExplanationModal(r) {
  let closeModal = () => {};
  const isQuantitative = hasFactorData(r);

  const card = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible max-w-2xl w-full' },
    h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between' },
      h('div', {},
        h('h3', { class: 'text-base font-bold text-gray-900' }, isQuantitative ? 'Quantitative Risk Calculation' : 'Qualitative Risk Evaluation'),
        h('p', { class: 'text-xs text-gray-500 mt-0.5 truncate max-w-md' }, r.hazard || 'Risk Explanation'),
      ),
      h('button', {
        type: 'button',
        class: 'text-gray-400 hover:text-gray-600 text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors',
        onclick: () => closeModal(),
      }, icon('close')),
    ),
    h('div', { class: 'p-6 space-y-5 max-h-[80vh] overflow-y-auto' }),
  );

  const body = card.querySelector('.space-y-5');
  const driverSummary = getRiskDriverSummary(r);



  if (isQuantitative) {
    const t = Number(r.threat);
    const v = Number(r.vulnerability);
    const el = Number(r.exploit_likelihood);
    const ei = Number(r.exploit_impact);
    const av = Number(r.asset_value);
    const sc = Number(r.security_controls);
    const score = r.risk_score != null ? Number(r.risk_score) : computeRiskScore(r);
    const level = r.risk_level || scoreToLevel(score);
    const band = levelBandRange(level);

    const factorsGrid = h('div', { class: 'grid grid-cols-3 sm:grid-cols-6 gap-2 text-center' },
      [
        { label: 'Threat', val: t },
        { label: 'Vulnerability', val: v },
        { label: 'Likelihood', val: el },
        { label: 'Impact', val: ei },
        { label: 'Asset Value', val: av },
        { label: 'Controls', val: sc },
      ].map((item) =>
        h('div', { class: 'p-2 rounded-xl bg-gray-50 border border-gray-100' },
          h('span', { class: 'block text-[10px] uppercase font-bold text-gray-500', title: item.label }, item.label),
          h('span', { class: 'block text-sm font-extrabold text-gray-900 mt-0.5 font-mono' }, `${item.val}/5`),
        )),
    );
    body.appendChild(factorsGrid);

    const breakdownText = [
      'Risk = (Threat × Vulnerability × (Likelihood × Impact) × Asset) − Controls',
      `     = (${t} × ${v} × (${el} × ${ei}) × ${av}) − ${sc}`,
      `     = ${t * v} × ${el * ei} × ${av} − ${sc}`,
      `Risk Score = ${score}`,
      `Risk Level: ${level} (${band})`,
    ].join('\n');

    body.appendChild(h('div', {},
      h('label', { class: labelCls }, 'Calculation Breakdown'),
      h('pre', {
        class: 'p-4 rounded-2xl bg-gray-900 text-gray-100 font-mono text-xs leading-relaxed overflow-x-hidden whitespace-pre-wrap break-words select-all shadow-inner',
      }, breakdownText),
    ));

    const BANDS = [
      { range: '1–250', label: 'Low', tone: 'green' },
      { range: '251–500', label: 'Moderate', tone: 'amber' },
      { range: '501–750', label: 'High', tone: 'red' },
      { range: '751+', label: 'Critical', tone: 'red' },
    ];

    body.appendChild(h('div', { class: 'pt-1' },
      h('label', { class: labelCls }, 'Risk Bands Reference'),
      h('div', { class: 'grid grid-cols-2 sm:grid-cols-4 gap-2' },
        BANDS.map((b) => {
          const isCurrent = b.label.toLowerCase() === level.toLowerCase();
          return h('div', {
            class: `p-2.5 rounded-xl border text-center transition-all ${isCurrent ? 'bg-pink-50/80 border-pink-300 ring-2 ring-pink-400/20 shadow-xs' : 'bg-gray-50 border-gray-100 opacity-70'}`,
          },
          h('span', { class: 'block text-xs font-mono font-bold text-gray-700' }, b.range),
          h('div', { class: 'mt-1' }, pill(b.label, b.tone)),
          isCurrent ? h('span', { class: 'block text-[10px] font-bold text-pink-600 mt-1' }, 'Current Level') : null,
          );
        }),
      ),
    ));
  } else {
    body.appendChild(h('div', { class: 'space-y-4' },
      h('div', { class: 'p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-3' },
        h('div', { class: 'flex items-center justify-between border-b border-gray-200/70 pb-2.5' },
          h('span', { class: 'text-xs font-semibold text-gray-600' }, 'Evaluated Likelihood'),
          pill(r.likelihood || 'Medium', r.likelihood === 'High' ? 'red' : r.likelihood === 'Medium' ? 'amber' : 'green'),
        ),
        h('div', { class: 'flex items-center justify-between border-b border-gray-200/70 pb-2.5' },
          h('span', { class: 'text-xs font-semibold text-gray-600' }, 'Evaluated Impact'),
          pill(r.impact || 'Medium', r.impact === 'High' ? 'red' : r.impact === 'Medium' ? 'amber' : 'green'),
        ),
        h('div', { class: 'flex items-center justify-between pt-0.5' },
          h('span', { class: 'text-xs font-bold text-gray-900' }, 'Resulting Risk Level'),
          pill(r.risk_level || 'Medium', r.risk_level === 'Critical' || r.risk_level === 'High' ? 'red' : (r.risk_level === 'Moderate' || r.risk_level === 'Medium') ? 'amber' : 'green'),
        ),
      ),
      h('div', { class: 'text-xs text-gray-500 leading-relaxed bg-amber-50/70 border border-amber-200/60 rounded-xl p-3' },
        h('p', { class: 'font-semibold text-amber-800 mb-1' }, 'Legacy Qualitative Assessment'),
        h('p', {}, `This risk was evaluated using the qualitative 3×3 Likelihood and Impact matrix (Likelihood: ${r.likelihood || '—'}, Impact: ${r.impact || '—'}).`),
        h('p', { class: 'mt-1.5 text-[11px] text-amber-700' }, 'Quantitative factors (Threat, Vulnerability, Exploit, Asset Value, Controls) are not present on this legacy record. New assessments recorded via "New Risk" will feature full quantitative scoring.'),
      ),
    ));
  }

  body.appendChild(h('div', { class: 'pt-2 flex justify-end' },
    h('button', {
      type: 'button',
      class: 'btn-ghost',
      onclick: () => closeModal(),
    }, 'Close'),
  ));

  closeModal = openModal(card).close;
}

export function showRiskRationaleDetailsModal(r) {
  let closeModal = () => {};
  const isElevated = r.risk_level === 'Critical' || r.risk_level === 'High';
  const driverSummary = getRiskDriverSummary(r);

  const card = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible max-w-lg w-full' },
    h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between' },
      h('div', {},
        h('div', { class: 'flex items-center gap-2' },
          icon(isElevated ? 'warning' : 'rate_review', isElevated ? 'text-red-600' : 'text-pink-600'),
          h('h3', { class: 'text-base font-bold text-gray-900' }, 'Why It Is Rated'),
        ),
        h('p', { class: 'text-xs text-gray-500 mt-0.5 truncate max-w-md' }, r.hazard || 'Risk Evaluation Justification'),
      ),
      h('button', {
        type: 'button',
        class: 'text-gray-400 hover:text-gray-600 text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors',
        onclick: () => closeModal(),
      }, icon('close')),
    ),
    h('div', { class: 'p-6 space-y-4 max-h-[80vh] overflow-y-auto' }),
  );

  const body = card.querySelector('.space-y-4');

  body.appendChild(h('div', { class: 'flex items-center justify-between bg-gray-50 p-3.5 rounded-2xl border border-gray-100' },
    h('div', {},
      h('span', { class: 'text-[11px] font-bold text-gray-400 uppercase tracking-wider block' }, 'Assessed Hazard'),
      h('p', { class: 'text-sm font-bold text-gray-900 mt-0.5' }, r.hazard || 'Hazard Assessment'),
    ),
    h('div', { class: 'text-right' },
      h('span', { class: 'text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1' }, 'Risk Level'),
      pill(r.risk_level, isElevated ? 'red' : 'amber'),
    ),
  ));

  if (r.custom_reason) {
    body.appendChild(h('div', { class: `${isElevated ? 'bg-red-50/90 border-red-200' : 'bg-pink-50/90 border-pink-200'} border rounded-2xl p-4 space-y-2 shadow-xs` },
      h('div', { class: 'flex items-center justify-between' },
        h('h4', { class: `text-xs font-bold uppercase tracking-wider ${isElevated ? 'text-red-950' : 'text-pink-950'}` }, 'Admin Root Cause & Rationale'),
        h('span', { class: 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-gray-700 border border-gray-200' }, 'User Recorded'),
      ),
      h('div', { class: 'bg-white/95 p-3.5 rounded-xl border border-gray-100 text-xs text-gray-900 font-medium leading-relaxed whitespace-pre-wrap' },
        r.custom_reason,
      ),
      h('div', { class: 'flex items-center justify-between text-[11px] text-gray-500 pt-0.5' },
        r.owner ? h('span', {}, `Owner: ${r.owner}`) : h('span', {}, 'Evaluated by Administrator'),
        r.review_date ? h('span', {}, `Review: ${formatDate(r.review_date)}`) : null,
      ),
    ));
  } else if (driverSummary.drivers && driverSummary.drivers.length > 0) {
    body.appendChild(h('div', { class: 'bg-red-50/90 border border-red-200 rounded-2xl p-4 space-y-2.5 shadow-xs' },
      h('h4', { class: 'text-xs font-bold uppercase tracking-wider text-red-950' }, `Contributing Drivers for ${r.risk_level || 'Elevated'} Rating`),
      h('div', { class: 'space-y-2 pt-1' },
        driverSummary.drivers.map((d) => h('div', { class: 'flex items-start gap-2 text-xs bg-white/80 p-2.5 rounded-xl border border-red-100' },
          icon('warning', 'text-red-500 text-sm shrink-0 mt-0.5'),
          h('div', {},
            h('span', { class: 'font-bold text-red-950 block' }, d.label),
            h('span', { class: 'text-red-800/90 text-[11px] block mt-0.5' }, d.detail),
          ),
        )),
      ),
    ));
  }

  if (r.mitigation) {
    body.appendChild(h('div', { class: 'bg-gray-50 p-3.5 rounded-2xl border border-gray-100 space-y-1' },
      h('span', { class: 'text-[11px] font-bold text-gray-500 uppercase tracking-wider block' }, 'Mitigation Plan'),
      h('p', { class: 'text-xs text-gray-700 leading-relaxed' }, r.mitigation),
    ));
  }

  body.appendChild(h('div', { class: 'pt-2 flex justify-between items-center' },
    h('button', {
      type: 'button',
      class: 'text-xs text-pink-600 hover:text-pink-700 font-semibold flex items-center gap-1',
      onclick: () => {
        closeModal();
        showRiskExplanationModal(r);
      },
    },
      icon('calculator', 'text-xs'),
      'View Full Calculation',
    ),
    h('button', {
      type: 'button',
      class: 'btn-ghost',
      onclick: () => closeModal(),
    }, 'Close'),
  ));

  closeModal = openModal(card).close;
}

