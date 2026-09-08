import {
  h, icon, pill, labelCls, openModal,
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
    description = `Classified as ${level} (risk score: ${score}) reflecting mild, balanced conditions across all evaluated parameters. ${controlsNote}`;
  }

  return { recall, description, action, level, score };
}

export function generateLegacyRationale(likelihood, impact, riskLevel) {
  const l = (likelihood || 'Medium').toLowerCase();
  const i = (impact || 'Medium').toLowerCase();

  let recall = '';
  let description = '';
  let action = '';

  if (riskLevel === 'Critical' || (l === 'high' && i === 'high')) {
    recall = 'Urgent Priority: Both likelihood of occurrence and potential impact are at peak qualitative levels, requiring immediate intervention.';
    description = `Classified as ${riskLevel} because frequent occurrence (Likelihood: ${likelihood}) coincides with severe consequences to campus facilities or student well-being (Impact: ${impact}).`;
    action = 'Enact immediate corrective mitigation and elevate to campus security coordinators.';
  } else if (riskLevel === 'High' || l === 'high' || i === 'high') {
    recall = 'Elevated Attention: Significant exposure driven by either frequent probability or heavy potential damage.';
    description = `Classified as ${riskLevel} due to elevated ${l === 'high' ? 'likelihood of occurrence' : 'impact severity'}. Proactive intervention is required to avoid escalation into a critical incident.`;
    action = 'Assign responsible staff for prioritized remediation within 5 business days.';
  } else if (riskLevel === 'Moderate' || riskLevel === 'Medium') {
    recall = 'Standard Supervisory Oversight: Manageable operational risk with balanced probability and consequence.';
    description = `Classified as ${riskLevel} because moderate likelihood is paired with moderate impact. Standard departmental protocols and supervisory rounds adequately contain the risk.`;
    action = 'Review during scheduled monthly safety checks and track mitigations.';
  } else {
    recall = 'Routine Awareness: Minor hazard with limited consequence and low probability of occurrence.';
    description = `Classified as ${riskLevel} because neither the likelihood nor the consequence represents an active operational threat under normal school routines.`;
    action = 'Continue baseline monitoring and standard facility inspections.';
  }

  return { recall, description, action };
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

  const card = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible max-w-xl w-full' },
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
        { label: 'Exploit Likelihood', val: el },
        { label: 'Exploit Impact', val: ei },
        { label: 'Asset Value', val: av },
        { label: 'Security Controls', val: sc },
      ].map((item) =>
        h('div', { class: 'p-2 rounded-xl bg-gray-50 border border-gray-100' },
          h('span', { class: 'block text-[10px] uppercase font-bold text-gray-500 truncate', title: item.label }, item.label),
          h('span', { class: 'block text-sm font-extrabold text-gray-900 mt-0.5 font-mono' }, `${item.val}/5`),
        )),
    );
    body.appendChild(factorsGrid);

    const rationale = generateRiskRationale({ threat: t, vulnerability: v, exploit_likelihood: el, exploit_impact: ei, asset_value: av, security_controls: sc }, score, level);
    const whyCard = h('div', { class: 'rounded-2xl p-4 bg-gray-50 border border-gray-100 space-y-3' },
      h('div', { class: 'flex items-center justify-between' },
        h('div', { class: 'flex items-center gap-1.5' },
          icon('info', 'text-pink-600 text-sm'),
          h('h4', { class: 'text-xs font-bold uppercase tracking-wider text-gray-700' }, 'Why This Risk Level? (Plain-Language Explanation)'),
        ),
        pill(level, level === 'Critical' || level === 'High' ? 'red' : level === 'Moderate' ? 'amber' : 'green'),
      ),
      h('div', { class: 'p-3 rounded-xl bg-white border border-gray-200/70 shadow-xs space-y-1' },
        h('span', { class: 'block text-[10px] uppercase font-bold text-gray-400 tracking-wider' }, 'Simple Recall Rule'),
        h('p', { class: 'text-xs font-semibold text-gray-900 leading-snug' }, rationale.recall),
        h('p', { class: 'text-[11px] text-pink-700 font-medium pt-0.5' }, `Recommended Action: ${rationale.action}`),
      ),
      h('div', { class: 'space-y-1' },
        h('span', { class: 'block text-[10px] uppercase font-bold text-gray-400 tracking-wider' }, 'Key Contributing Drivers (In Context)'),
        h('p', { class: 'text-xs text-gray-600 leading-relaxed' }, rationale.description),
      ),
    );
    body.appendChild(whyCard);

    const breakdownText = [
      'Risk = (Threat × Vulnerability × (Exploit Likelihood × Exploit Impact) × Asset Value) − Security Controls',
      `= (${t} × ${v} × (${el} × ${ei}) × ${av}) − ${sc}`,
      `= ${t * v} × ${el * ei} × ${av} − ${sc}`,
      `Risk Score = ${score}`,
      `Risk Level: ${level} (${band})`,
    ].join('\n');

    body.appendChild(h('div', {},
      h('label', { class: labelCls }, 'Calculation Breakdown'),
      h('pre', {
        class: 'p-4 rounded-2xl bg-gray-900 text-gray-100 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto whitespace-pre select-all shadow-inner',
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
    const legacyRationale = generateLegacyRationale(r.likelihood, r.impact, r.risk_level);
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
      h('div', { class: 'rounded-2xl p-4 bg-gray-50 border border-gray-100 space-y-3' },
        h('div', { class: 'flex items-center gap-1.5' },
          icon('info', 'text-pink-600 text-sm'),
          h('h4', { class: 'text-xs font-bold uppercase tracking-wider text-gray-700' }, 'Why This Risk Level? (Qualitative Explanation)'),
        ),
        h('div', { class: 'p-3 rounded-xl bg-white border border-gray-200/70 shadow-xs space-y-1' },
          h('span', { class: 'block text-[10px] uppercase font-bold text-gray-400 tracking-wider' }, 'Simple Recall Rule'),
          h('p', { class: 'text-xs font-semibold text-gray-900 leading-snug' }, legacyRationale.recall),
          h('p', { class: 'text-[11px] text-pink-700 font-medium pt-0.5' }, `Recommended Action: ${legacyRationale.action}`),
        ),
        h('div', { class: 'space-y-1' },
          h('span', { class: 'block text-[10px] uppercase font-bold text-gray-400 tracking-wider' }, 'Evaluation Context'),
          h('p', { class: 'text-xs text-gray-600 leading-relaxed' }, legacyRationale.description),
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
