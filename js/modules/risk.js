import {
  h, icon, pill, formatDate, inputCls, labelCls,
  toast, openModal,
} from '../ui.js';
import * as api from '../api.js';
import { loadTable } from './table-loader.js';
import {
  generateRiskRationale, generateLegacyRationale,
  showRiskExplanationModal,
} from './risk-rationale.js';

export {
  generateRiskRationale, generateLegacyRationale,
  showRiskExplanationModal,
};

/**
 * Quantitative Campus Risk Scoring Formula.
 * 
 * WHY:
 * Formula: (Threat × Vulnerability × (Exploit Likelihood × Exploit Impact) × Asset Value) − Security Controls
 * Calibrated against maximum possible score (5^5) - 1 = 3,124 vs normal distribution of campus hazards:
 * - Low: 1-250
 * - Moderate: 251-500
 * - High: 501-750
 * - Critical: 751+
 */
export function computeRiskScore(factors) {
  const threat = Number(factors.threat) || 0;
  const vulnerability = Number(factors.vulnerability) || 0;
  const exploit_likelihood = Number(factors.exploit_likelihood) || 0;
  const exploit_impact = Number(factors.exploit_impact) || 0;
  const asset_value = Number(factors.asset_value) || 0;
  const security_controls = Number(factors.security_controls) || 0;
  return (threat * vulnerability * (exploit_likelihood * exploit_impact) * asset_value) - security_controls;
}

export function scoreToLevel(score) {
  const s = Number(score);
  if (s >= 751) return 'Critical';
  if (s >= 501) return 'High';
  if (s >= 251) return 'Moderate';
  return 'Low';
}

export function levelBandRange(level) {
  switch (level) {
    case 'Critical': return '751+';
    case 'High': return '501-750';
    case 'Moderate': return '251-500';
    case 'Low':
    default:
      return '1-250';
  }
}

export function factorTo3Scale(val) {
  const n = Number(val);
  if (n <= 2) return 'Low';
  if (n <= 3) return 'Medium';
  return 'High';
}

function riskForm(el) {
  let closeModal = () => {};
  const form = h('form', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible max-w-2xl w-full' },
    h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between' },
      h('div', {},
        h('h3', { class: 'text-base font-bold text-gray-900' }, 'New Risk Assessment'),
        h('p', { class: 'text-xs text-gray-500 mt-0.5' }, 'Quantitative risk evaluation using Threat, Vulnerability, Exploit, Asset, & Controls (1–5 scale).'),
      ),
      h('button', {
        type: 'button',
        class: 'text-gray-400 hover:text-gray-600 text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors',
        onclick: () => closeModal(),
      }, icon('close')),
    ),
    h('div', { class: 'p-6 space-y-5 max-h-[80vh] overflow-y-auto' }),
  );

  const body = form.querySelector('.space-y-5');

  const f = {
    hazard: '',
    threat: 3,
    vulnerability: 3,
    exploit_likelihood: 3,
    exploit_impact: 3,
    asset_value: 3,
    security_controls: 3,
    mitigation: '',
    owner: '',
    review_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  };

  body.appendChild(h('div', {},
    h('label', { class: labelCls }, 'Hazard Description *'),
    h('input', {
      class: inputCls,
      placeholder: 'e.g. Chemical storage leak in Science Wing Lab 2',
      required: true,
      oninput: (e) => { f.hazard = e.target.value; },
    }),
  ));

  body.appendChild(h('div', { class: 'pt-1' },
    h('h4', { class: 'text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5' },
      icon('calculator', 'text-pink-600 text-sm'),
      'Quantitative Risk Factors (1 = Lowest, 5 = Highest)',
    ),
    h('p', { class: 'text-xs text-gray-400 mt-0.5' },
      'Formula: (Threat × Vulnerability × (Exploit Likelihood × Exploit Impact) × Asset Value) − Security Controls',
    ),
  ));

  const factorsGrid = h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5' });
  body.appendChild(factorsGrid);

  const FACTOR_DEFS = [
    { key: 'threat', label: 'Threat (1–5)', hint: 'Threat source potential & frequency' },
    { key: 'vulnerability', label: 'Vulnerability (1–5)', hint: 'Ease of exploitation & exposure' },
    { key: 'exploit_likelihood', label: 'Exploit Likelihood (1–5)', hint: 'Probability of occurrence' },
    { key: 'exploit_impact', label: 'Exploit Impact (1–5)', hint: 'Severity of potential damage' },
    { key: 'asset_value', label: 'Asset Value (1–5)', hint: 'Importance of people or assets' },
    { key: 'security_controls', label: 'Security Controls (1–5)', hint: 'Safeguards in place (subtracted)' },
  ];

  const updatePreview = () => {
    const score = computeRiskScore(f);
    const level = scoreToLevel(score);
    const band = levelBandRange(level);
    const t = Number(f.threat) || 0;
    const v = Number(f.vulnerability) || 0;
    const elScore = Number(f.exploit_likelihood) || 0;
    const ei = Number(f.exploit_impact) || 0;
    const av = Number(f.asset_value) || 0;
    const sc = Number(f.security_controls) || 0;

    scoreValueEl.textContent = String(score);
    const tone = level === 'Critical' || level === 'High' ? 'red' : level === 'Moderate' ? 'amber' : 'green';
    scoreLevelBadgeEl.replaceChildren(pill(level, tone));
    formulaEl.textContent = `(${t} × ${v} × (${elScore} × ${ei}) × ${av}) − ${sc} = ${score} (${level}, ${band})`;
    legacyDerivationEl.textContent = `Derived Legacy Scale: Likelihood = ${factorTo3Scale(elScore)} · Impact = ${factorTo3Scale(ei)}`;

    const rationale = generateRiskRationale(f, score, level);
    recallEl.textContent = `Recall: ${rationale.recall}`;
    descriptionEl.textContent = rationale.description;
  };

  FACTOR_DEFS.forEach((def) => {
    const input = h('input', {
      type: 'number',
      min: '1',
      max: '5',
      step: '1',
      value: f[def.key],
      required: true,
      class: `${inputCls} font-mono font-semibold`,
      oninput: (e) => {
        let val = parseInt(e.target.value, 10);
        if (Number.isNaN(val)) val = 1;
        if (val < 1) val = 1;
        if (val > 5) val = 5;
        f[def.key] = val;
        e.target.value = val;
        updatePreview();
      },
    });

    factorsGrid.appendChild(h('div', { class: 'bg-gray-50/80 rounded-2xl p-3 border border-gray-100' },
      h('label', { class: 'block text-xs font-bold text-gray-700 mb-1' }, def.label),
      input,
      h('p', { class: 'text-[11px] text-gray-400 mt-1 leading-tight' }, def.hint),
    ));
  });

  const scoreValueEl = h('span', { class: 'text-2xl font-extrabold text-gray-900 font-mono' }, '0');
  const scoreLevelBadgeEl = h('div', {});
  const formulaEl = h('p', { class: 'text-xs font-mono text-gray-700 mt-1 font-medium' });
  const legacyDerivationEl = h('p', { class: 'text-[11px] text-gray-500 mt-0.5' });
  const recallEl = h('p', { class: 'text-xs font-semibold text-gray-800 leading-snug' });
  const descriptionEl = h('p', { class: 'text-xs text-gray-600 mt-1 leading-relaxed' });

  const previewCard = h('div', { class: 'rounded-2xl bg-gradient-to-br from-pink-50/70 to-purple-50/40 border border-pink-100 p-4' },
    h('div', { class: 'flex items-center justify-between gap-2' },
      h('div', {},
        h('span', { class: 'text-[11px] font-bold uppercase tracking-wider text-pink-700 block' }, 'Computed Risk Score'),
        scoreValueEl,
      ),
      h('div', { class: 'text-right' },
        h('span', { class: 'text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1' }, 'Resulting Level'),
        scoreLevelBadgeEl,
      ),
    ),
    h('div', { class: 'mt-2.5 pt-2.5 border-t border-pink-100/80' },
      formulaEl,
      legacyDerivationEl,
    ),
    h('div', { class: 'mt-2.5 pt-2.5 border-t border-pink-100/80 bg-white/70 p-3 rounded-xl border border-pink-100/60' },
      h('span', { class: 'block text-[10px] font-bold uppercase tracking-wider text-pink-700 mb-1' }, 'Why This Rating? (Simple Recall & Drivers)'),
      recallEl,
      descriptionEl,
    ),
  );
  body.appendChild(previewCard);

  const metaGrid = h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1' },
    h('div', { class: 'sm:col-span-2' },
      h('label', { class: labelCls }, 'Mitigation Plan'),
      h('textarea', {
        class: `${inputCls} min-h-[60px]`,
        placeholder: 'Describe preventive controls, repair schedule, or response actions…',
        oninput: (e) => { f.mitigation = e.target.value; },
      }),
    ),
    h('div', {},
      h('label', { class: labelCls }, 'Risk Owner / Responsible Staff'),
      h('input', {
        class: inputCls,
        placeholder: 'e.g. Mr. Dela Peña',
        oninput: (e) => { f.owner = e.target.value; },
      }),
    ),
    h('div', {},
      h('label', { class: labelCls }, 'Review Date'),
      h('input', {
        type: 'date',
        class: inputCls,
        value: f.review_date,
        oninput: (e) => { f.review_date = e.target.value; },
      }),
    ),
  );
  body.appendChild(metaGrid);

  const errBox = h('p', { class: 'hidden text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  body.appendChild(errBox);

  const footer = h('div', { class: 'flex items-center gap-3 pt-2' },
    h('button', { type: 'submit', class: 'btn-primary' }, icon('security', 'text-sm'), 'Save Risk Assessment'),
    h('button', { type: 'button', class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel'),
  );
  body.appendChild(footer);

  updatePreview();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.hazard.trim()) {
      errBox.textContent = 'Hazard description is required.';
      errBox.classList.remove('hidden');
      return;
    }
    const score = computeRiskScore(f);
    const level = scoreToLevel(score);
    const derivedLikelihood = factorTo3Scale(f.exploit_likelihood);
    const derivedImpact = factorTo3Scale(f.exploit_impact);

    errBox.classList.add('hidden');
    const btn = footer.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      await api.insertRow('risks', {
        hazard: f.hazard.trim(),
        threat: Number(f.threat),
        vulnerability: Number(f.vulnerability),
        exploit_likelihood: Number(f.exploit_likelihood),
        exploit_impact: Number(f.exploit_impact),
        asset_value: Number(f.asset_value),
        security_controls: Number(f.security_controls),
        risk_score: score,
        risk_level: level,
        likelihood: derivedLikelihood,
        impact: derivedImpact,
        mitigation: f.mitigation.trim() || null,
        owner: f.owner.trim() || null,
        review_date: f.review_date || null,
      });

      toast(`Risk assessment for "${f.hazard.trim()}" saved.`);
      closeModal();
      el.innerHTML = '';
      riskAssessment(el);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Save Risk Assessment';
    }
  });

  closeModal = openModal(form).close;
}

export async function riskAssessment(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'hazard', label: 'Hazard', render: (r) => h('span', { class: 'font-semibold text-gray-900 block max-w-[300px]' }, r.hazard) },
    { key: 'likelihood', label: 'Likelihood', render: (r) => pill(r.likelihood, r.likelihood === 'High' ? 'red' : r.likelihood === 'Medium' ? 'amber' : 'green') },
    { key: 'impact', label: 'Impact', render: (r) => pill(r.impact, r.impact === 'High' ? 'red' : r.impact === 'Medium' ? 'amber' : 'green') },
    {
      key: 'risk_level',
      label: 'Risk Level',
      render: (r) => {
        const tone = r.risk_level === 'Critical' || r.risk_level === 'High' ? 'red' : (r.risk_level === 'Moderate' || r.risk_level === 'Medium') ? 'amber' : 'green';
        const pillEl = pill(r.risk_level, tone);
        return h('button', {
          type: 'button',
          class: 'inline-flex items-center gap-1.5 focus:outline-none hover:opacity-85 transition-opacity cursor-pointer text-left group',
          title: 'Click to view risk explanation & simple recall',
          onclick: (e) => {
            e.stopPropagation();
            showRiskExplanationModal(r);
          },
        },
        pillEl,
        r.risk_score != null ? h('span', { class: 'text-xs text-gray-400 font-mono font-medium group-hover:text-gray-600' }, `(${r.risk_score})`) : null,
        icon('info', 'text-gray-300 group-hover:text-pink-600 text-xs transition-colors'),
        );
      },
    },
    { key: 'mitigation', label: 'Mitigation Plan', render: (r) => h('span', { class: 'block max-w-[320px] text-gray-600' }, r.mitigation || '—') },
    { key: 'owner', label: 'Owner' },
    { key: 'review_date', label: 'Review Date', render: (r) => h('span', { class: 'whitespace-nowrap text-gray-500' }, formatDate(r.review_date)) },
  ];
  return loadTable(el, {
    table: 'risks', columns, iconName: 'security',
    title: 'Risk Assessment Tool',
    subtitle: 'Hazards with quantitative scoring, computed risk levels, mitigation plans, and review owners.',
    actionLabel: 'New Risk',
    onAction: () => riskForm(el),
    searchKeys: ['hazard', 'mitigation', 'owner', 'risk_level'],
    searchPlaceholder: 'Search by hazard or owner…',
    empty: { title: 'No risks assessed yet', text: 'Add the first hazard to start the risk register.' },
  });
}
