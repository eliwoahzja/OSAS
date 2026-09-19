import {
  h, icon, pill, formatDate, inputCls, labelCls,
  toast, openModal,
} from '../ui.js';
import * as api from '../api.js';
import { loadTable } from './table-loader.js';
import {
  generateRiskRationale, generateLegacyRationale,
  showRiskExplanationModal, showRiskRationaleDetailsModal, getRiskDriverSummary,
} from './risk-rationale.js';

export {
  generateRiskRationale, generateLegacyRationale,
  showRiskExplanationModal, showRiskRationaleDetailsModal, getRiskDriverSummary,
};

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

const RISK_LOCAL_KEY = 'osas_risk_custom_details_v1';

function getRiskLocalDetails() {
  try {
    const data = JSON.parse(localStorage.getItem(RISK_LOCAL_KEY) || '{}');
    const defaultHazard = 'electrical wiring in science wing lab 2';
    if (!data[defaultHazard] && !data['RS-001'] && !data['253c3c4f-e165-44c9-af61-29b8d64a321e']) {
      const defaultDetail = {
        custom_reason: 'Aging 220V breaker wiring and degraded rubber insulation in Science Wing Lab 2; recurring circuit overheating near active student lab workbenches poses an immediate arc flash and fire ignition hazard.',
        threat: 5,
        vulnerability: 4,
        exploit_likelihood: 5,
        exploit_impact: 4,
        asset_value: 3,
        security_controls: 4,
        risk_score: 1196,
      };
      data[defaultHazard] = defaultDetail;
      data['RS-001'] = defaultDetail;
      data['253c3c4f-e165-44c9-af61-29b8d64a321e'] = defaultDetail;
      try { localStorage.setItem(RISK_LOCAL_KEY, JSON.stringify(data)); } catch {}
    }
    return data;
  } catch {
    return {};
  }
}

export function enrichRiskWithLocalDetails(r) {
  if (!r) return r;
  const store = getRiskLocalDetails();
  const idKey = r.id ? String(r.id) : '';
  const hazardKey = r.hazard ? String(r.hazard).toLowerCase().trim() : '';
  const local = store[idKey] || store[hazardKey] || {};
  return {
    ...r,
    custom_reason: r.custom_reason || local.custom_reason || null,
    threat: r.threat ?? local.threat ?? null,
    vulnerability: r.vulnerability ?? local.vulnerability ?? null,
    exploit_likelihood: r.exploit_likelihood ?? local.exploit_likelihood ?? null,
    exploit_impact: r.exploit_impact ?? local.exploit_impact ?? null,
    asset_value: r.asset_value ?? local.asset_value ?? null,
    security_controls: r.security_controls ?? local.security_controls ?? null,
    risk_score: r.risk_score ?? local.risk_score ?? null,
  };
}

export function saveRiskLocalDetails(id, hazard, details) {
  try {
    const store = getRiskLocalDetails();
    if (id) store[String(id)] = { ...(store[String(id)] || {}), ...details };
    if (hazard) store[String(hazard).toLowerCase().trim()] = { ...(store[String(hazard).toLowerCase().trim()] || {}), ...details };
    localStorage.setItem(RISK_LOCAL_KEY, JSON.stringify(store));
  } catch {}
}

function riskForm(el) {
  let closeModal = () => {};
  let currentStep = 1;

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
    custom_reason: '',
  };

  const form = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible max-w-2xl w-full' });

  const headerSubtitle = h('p', { class: 'text-xs text-gray-500 mt-0.5' }, 'Step 1 of 2: Quantitative risk factors & operational parameters.');
  const stepIndicator = h('div', { class: 'flex items-center gap-1.5 text-xs font-semibold' },
    h('span', { class: 'px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-mono text-[11px] font-bold' }, 'Step 1: Factors'),
    icon('chevron_right', 'text-gray-300 text-xs'),
    h('span', { class: 'px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-mono text-[11px]' }, 'Step 2: Admin Rationale'),
  );

  const header = h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between gap-3' },
    h('div', {},
      h('h3', { class: 'text-base font-bold text-gray-900 flex items-center gap-2' },
        icon('security', 'text-pink-600 text-lg'),
        'New Risk Assessment',
      ),
      headerSubtitle,
    ),
    h('div', { class: 'flex items-center gap-2.5 shrink-0' },
      stepIndicator,
      h('button', {
        type: 'button',
        class: 'text-gray-400 hover:text-gray-600 text-lg w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors',
        onclick: () => closeModal(),
      }, icon('close')),
    ),
  );
  form.appendChild(header);

  const body = h('div', { class: 'p-6 max-h-[80vh] overflow-y-auto' });
  form.appendChild(body);

  const step1Wrap = h('div', { class: 'space-y-5' });
  body.appendChild(step1Wrap);

  step1Wrap.appendChild(h('div', {},
    h('label', { class: labelCls }, 'Hazard Description *'),
    h('input', {
      class: inputCls,
      placeholder: 'e.g. Chemical storage leak in Science Wing Lab 2',
      required: true,
      value: f.hazard,
      oninput: (e) => { f.hazard = e.target.value; },
    }),
  ));

  step1Wrap.appendChild(h('div', { class: 'pt-1' },
    h('h4', { class: 'text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5' },
      icon('calculator', 'text-pink-600 text-sm'),
      'Quantitative Risk Factors (1 = Lowest, 5 = Highest)',
    ),
    h('p', { class: 'text-xs text-gray-400 mt-0.5' },
      'Formula: (Threat × Vulnerability × (Exploit Likelihood × Exploit Impact) × Asset Value) − Security Controls',
    ),
  ));

  const factorsGrid = h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5' });
  step1Wrap.appendChild(factorsGrid);

  const FACTOR_DEFS = [
    { key: 'threat', label: 'Threat (1–5)', hint: 'Threat source potential & frequency' },
    { key: 'vulnerability', label: 'Vulnerability (1–5)', hint: 'Ease of exploitation & exposure' },
    { key: 'exploit_likelihood', label: 'Exploit Likelihood (1–5)', hint: 'Probability of occurrence' },
    { key: 'exploit_impact', label: 'Exploit Impact (1–5)', hint: 'Severity of potential damage' },
    { key: 'asset_value', label: 'Asset Value (1–5)', hint: 'Importance of people or assets' },
    { key: 'security_controls', label: 'Security Controls (1–5)', hint: 'Safeguards in place (subtracted)' },
  ];

  const scoreValueEl = h('span', { class: 'text-2xl font-extrabold text-gray-900 font-mono' }, '0');
  const scoreLevelBadgeEl = h('div', {});
  const formulaEl = h('p', { class: 'text-xs font-mono text-gray-700 mt-1 font-medium' });
  const legacyDerivationEl = h('p', { class: 'text-[11px] text-gray-500 mt-0.5' });
  const recallEl = h('p', { class: 'text-xs font-semibold text-gray-800 leading-snug' });
  const descriptionEl = h('p', { class: 'text-xs text-gray-600 mt-1 leading-relaxed' });
  const whyHighAlertEl = h('div', { class: 'hidden mt-2.5 p-3 rounded-xl bg-red-50/90 border border-red-200/80 text-xs text-red-800 shadow-xs' });

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
    legacyDerivationEl.textContent = `Derived Scale: Likelihood = ${factorTo3Scale(elScore)} · Impact = ${factorTo3Scale(ei)}`;

    const rationale = generateRiskRationale(f, score, level);
    recallEl.textContent = `Recall: ${rationale.recall}`;
    descriptionEl.textContent = rationale.description;

    const isHighOrCritical = level === 'High' || level === 'Critical';
    if (isHighOrCritical) {
      const driverInfo = getRiskDriverSummary(f);
      whyHighAlertEl.innerHTML = '';
      whyHighAlertEl.appendChild(h('div', { class: 'flex items-center gap-1.5 font-bold text-red-900 mb-1' },
        icon('warning', 'text-red-600 text-sm'),
        h('span', {}, `Calculated threshold factors for ${level}:`),
      ));
      const list = h('ul', { class: 'space-y-1 text-[11px] text-red-800' });
      driverInfo.drivers.forEach((d) => {
        list.appendChild(h('li', { class: 'flex items-start gap-1.5' },
          icon('arrow_right', 'text-red-500 text-xs shrink-0 mt-0.5'),
          h('span', {}, h('strong', { class: 'font-bold text-red-950' }, d.label), ` — ${d.detail}`),
        ));
      });
      whyHighAlertEl.appendChild(list);
      whyHighAlertEl.classList.remove('hidden');
    } else {
      whyHighAlertEl.classList.add('hidden');
    }
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
    whyHighAlertEl,
  );
  step1Wrap.appendChild(previewCard);

  const metaGrid = h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1' },
    h('div', { class: 'sm:col-span-2' },
      h('label', { class: labelCls }, 'Mitigation Plan'),
      h('textarea', {
        class: `${inputCls} min-h-[60px]`,
        placeholder: 'Describe preventive controls, repair schedule, or response actions…',
        value: f.mitigation,
        oninput: (e) => { f.mitigation = e.target.value; },
      }),
    ),
    h('div', {},
      h('label', { class: labelCls }, 'Risk Owner / Responsible Staff'),
      h('input', {
        class: inputCls,
        placeholder: 'e.g. Mr. Dela Peña',
        value: f.owner,
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
  step1Wrap.appendChild(metaGrid);

  const errBox1 = h('p', { class: 'hidden text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  step1Wrap.appendChild(errBox1);

  const step1Footer = h('div', { class: 'flex items-center justify-between gap-3 pt-2 border-t border-gray-100' },
    h('button', { type: 'button', class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel'),
    h('button', {
      type: 'button',
      class: 'btn-primary flex items-center gap-2',
      onclick: () => goToStep(2),
    },
      'Next',
      icon('arrow_forward', 'text-sm'),
    ),
  );
  step1Wrap.appendChild(step1Footer);

  const step2Wrap = h('div', { class: 'hidden space-y-5' });
  body.appendChild(step2Wrap);

  const step2SummaryCard = h('div', { class: 'rounded-2xl p-4 bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-3' });
  step2Wrap.appendChild(step2SummaryCard);

  const step2Heading = h('h4', { class: 'text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2' });
  const step2Helper = h('p', { class: 'text-xs text-gray-500 mt-1 leading-relaxed' });

  const customReasonTextarea = h('textarea', {
    class: `${inputCls} min-h-[130px] leading-relaxed font-normal`,
    placeholder: 'State the specific physical conditions, equipment defects, student activities, or failure modes that justify this rating (e.g. Degraded wiring running near wet prep sinks; sparks during high-current heating pose imminent fire and shock hazard)...',
    oninput: (e) => {
      f.custom_reason = e.target.value;
      if (errBox2) errBox2.classList.add('hidden');
    },
  });

  const chipsContainer = h('div', { class: 'flex flex-wrap gap-1.5 pt-1' });

  const rationaleSection = h('div', { class: 'bg-white border border-gray-200 rounded-2xl p-4 space-y-3' },
    h('div', {},
      step2Heading,
      step2Helper,
    ),
    h('div', { class: 'space-y-1.5' },
      h('div', { class: 'flex items-center justify-between' },
        h('label', { class: 'text-xs font-bold text-gray-700' }, 'Root Cause & Rating Justification *'),
      ),
      customReasonTextarea,
    ),
    h('div', { class: 'space-y-1 pt-1' },
      h('span', { class: 'block text-[11px] font-bold text-gray-500 uppercase tracking-wider' }, 'Contributing Factor Tags:'),
      chipsContainer,
    ),
  );
  step2Wrap.appendChild(rationaleSection);

  const errBox2 = h('p', { class: 'hidden text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  step2Wrap.appendChild(errBox2);

  const saveBtn = h('button', {
    type: 'button',
    class: 'btn-primary flex items-center gap-2',
    onclick: () => handleFinalSave(),
  }, icon('security', 'text-sm'), 'Save Risk Assessment');

  const step2Footer = h('div', { class: 'flex items-center justify-between gap-3 pt-2 border-t border-gray-100' },
    h('button', {
      type: 'button',
      class: 'btn-ghost flex items-center gap-1.5',
      onclick: () => goToStep(1),
    },
      icon('arrow_back', 'text-sm'),
      'Back to Factors',
    ),
    h('div', { class: 'flex items-center gap-2.5' },
      h('button', { type: 'button', class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel'),
      saveBtn,
    ),
  );
  step2Wrap.appendChild(step2Footer);

  const renderStep2Content = () => {
    const score = computeRiskScore(f);
    const level = scoreToLevel(score);
    const tone = level === 'Critical' || level === 'High' ? 'red' : level === 'Moderate' ? 'amber' : 'green';

    step2SummaryCard.innerHTML = '';
    step2SummaryCard.appendChild(h('div', { class: 'max-w-md' },
      h('span', { class: 'text-[10px] font-bold uppercase tracking-wider text-gray-400 block' }, 'Evaluated Hazard'),
      h('p', { class: 'text-sm font-bold text-gray-900 truncate' }, f.hazard || 'Untitled Hazard'),
      h('p', { class: 'text-xs text-gray-500 mt-0.5' }, `Score: ${score} · Likelihood: ${factorTo3Scale(f.exploit_likelihood)} · Impact: ${factorTo3Scale(f.exploit_impact)}`),
    ));
    step2SummaryCard.appendChild(h('div', { class: 'flex items-center gap-2' },
      h('span', { class: 'text-xs text-gray-500' }, 'Resulting Level:'),
      pill(level, tone),
    ));

    const isCriticalOrHigh = level === 'Critical' || level === 'High';
    step2Heading.innerHTML = '';
    step2Heading.appendChild(icon(isCriticalOrHigh ? 'warning' : 'rate_review', `${isCriticalOrHigh ? 'text-red-600' : 'text-pink-600'} text-base`));
    step2Heading.appendChild(h('span', {}, `Primary Reasons for ${level} Rating *`));

    step2Helper.textContent = `Explain why this hazard is rated ${level} and specify the underlying conditions, environmental hazards, or failure modes.`;

    chipsContainer.innerHTML = '';
    const suggestedChips = [];
    if (f.threat >= 4) suggestedChips.push('Severe threat source intensity');
    if (f.vulnerability >= 4) suggestedChips.push('High structural or protocol vulnerability');
    if (f.exploit_likelihood >= 4 && f.exploit_impact >= 4) suggestedChips.push('Dual Peak: frequent occurrence and severe impact');
    else if (f.exploit_likelihood >= 4) suggestedChips.push('High occurrence probability during class hours');
    else if (f.exploit_impact >= 4) suggestedChips.push('Severe injury and infrastructure damage potential');
    if (f.asset_value >= 4) suggestedChips.push('Direct risk to student life safety');
    if (f.security_controls <= 2) suggestedChips.push('Insufficient safeguards and missing containment');
    suggestedChips.push('Aging infrastructure failure', 'Proximity to high-density student areas');

    suggestedChips.forEach((chipText) => {
      chipsContainer.appendChild(h('button', {
        type: 'button',
        class: 'px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors clickable flex items-center gap-1',
        onclick: () => {
          const current = customReasonTextarea.value.trim();
          if (!current) {
            customReasonTextarea.value = chipText;
          } else if (!current.includes(chipText)) {
            customReasonTextarea.value = `${current}; ${chipText}`;
          }
          f.custom_reason = customReasonTextarea.value;
          customReasonTextarea.focus();
        },
      },
      icon('add', 'text-[11px] text-pink-500'),
      chipText,
      ));
    });

    customReasonTextarea.value = f.custom_reason || '';
  };

  const goToStep = (step) => {
    if (step === 2) {
      if (!f.hazard.trim()) {
        errBox1.textContent = 'Hazard description is required before proceeding to Step 2.';
        errBox1.classList.remove('hidden');
        return;
      }
      errBox1.classList.add('hidden');
      currentStep = 2;
      headerSubtitle.textContent = 'Step 2 of 2: Document why this hazard is rated at this level and its root causes.';
      stepIndicator.replaceChildren(
        h('span', { class: 'px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono text-[11px] font-bold flex items-center gap-1' },
          icon('check', 'text-[11px]'),
          'Step 1: Factors',
        ),
        icon('chevron_right', 'text-gray-300 text-xs'),
        h('span', { class: 'px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-mono text-[11px] font-bold' }, 'Step 2: Admin Rationale'),
      );
      renderStep2Content();
      step1Wrap.classList.add('hidden');
      step2Wrap.classList.remove('hidden');
      body.scrollTop = 0;
      setTimeout(() => customReasonTextarea.focus(), 50);
    } else {
      currentStep = 1;
      headerSubtitle.textContent = 'Step 1 of 2: Quantitative risk factors & operational parameters.';
      stepIndicator.replaceChildren(
        h('span', { class: 'px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-mono text-[11px] font-bold' }, 'Step 1: Factors'),
        icon('chevron_right', 'text-gray-300 text-xs'),
        h('span', { class: 'px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-mono text-[11px]' }, 'Step 2: Admin Rationale'),
      );
      step2Wrap.classList.add('hidden');
      step1Wrap.classList.remove('hidden');
      body.scrollTop = 0;
    }
  };

  const handleFinalSave = async () => {
    const score = computeRiskScore(f);
    const level = scoreToLevel(score);

    if (!f.custom_reason.trim()) {
      errBox2.textContent = `Please type out the reason or root cause why this assessment is rated ${level} before saving.`;
      errBox2.classList.remove('hidden');
      customReasonTextarea.focus();
      return;
    }

    errBox2.classList.add('hidden');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const derivedLikelihood = factorTo3Scale(f.exploit_likelihood);
    const derivedImpact = factorTo3Scale(f.exploit_impact);

    const payload = {
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
      custom_reason: f.custom_reason.trim(),
    };

    try {
      const res = await api.insertRow('risks', payload);
      saveRiskLocalDetails(res?.id || payload.hazard, payload.hazard, payload);

      toast(`Risk assessment for "${f.hazard.trim()}" saved.`);
      closeModal();
      el.innerHTML = '';
      riskAssessment(el);
    } catch (err) {
      errBox2.textContent = err.message;
      errBox2.classList.remove('hidden');
      saveBtn.disabled = false;
      saveBtn.replaceChildren(icon('security', 'text-sm'), 'Save Risk Assessment');
    }
  };

  updatePreview();
  closeModal = openModal(form, {
    badge: 'ASSESSMENT WIZARD',
    title: 'Loading Risk Evaluation Wizard…',
    subtitle: 'Preparing quantitative assessment matrix',
  }).close;
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
        const enriched = enrichRiskWithLocalDetails(r);
        const tone = enriched.risk_level === 'Critical' || enriched.risk_level === 'High' ? 'red' : (enriched.risk_level === 'Moderate' || enriched.risk_level === 'Medium') ? 'amber' : 'green';
        const pillEl = pill(enriched.risk_level, tone);
        return h('button', {
          type: 'button',
          class: 'inline-flex items-center gap-1.5 focus:outline-none hover:opacity-85 transition-opacity cursor-pointer text-left group',
          title: 'Click to view risk explanation & calculation',
          onclick: (e) => {
            e.stopPropagation();
            showRiskExplanationModal(enriched);
          },
        },
        pillEl,
        enriched.risk_score != null ? h('span', { class: 'text-xs text-gray-400 font-mono font-medium group-hover:text-gray-600' }, `(${enriched.risk_score})`) : null,
        icon('info', 'text-gray-300 group-hover:text-pink-600 text-xs transition-colors'),
        );
      },
    },
    {
      key: 'risk_rationale',
      label: 'Why It Is Rated / Driver',
      render: (r) => {
        const enriched = enrichRiskWithLocalDetails(r);
        const customReason = (enriched.custom_reason || '').trim();
        const driverInfo = getRiskDriverSummary(enriched);
        const isElevated = enriched.risk_level === 'Critical' || enriched.risk_level === 'High';

        if (customReason) {
          return h('button', {
            type: 'button',
            class: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${isElevated ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'} transition-colors clickable text-left group max-w-[260px]`,
            title: `Root Cause Rationale:\n${customReason}\n\n(Click for rationale breakdown)`,
            onclick: (e) => {
              e.stopPropagation();
              showRiskRationaleDetailsModal(enriched);
            },
          },
          icon(isElevated ? 'warning' : 'description', `${isElevated ? 'text-red-500' : 'text-gray-500'} text-xs shrink-0`),
          h('span', { class: 'truncate flex-1' }, customReason),
          );
        }

        if (isElevated) {
          return h('button', {
            type: 'button',
            class: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors clickable text-left group max-w-[240px]',
            title: `Click to view why this is ${enriched.risk_level}:\n${driverInfo.fullSummary}`,
            onclick: (e) => {
              e.stopPropagation();
              showRiskRationaleDetailsModal(enriched);
            },
          },
          icon('warning', 'text-red-500 text-xs shrink-0'),
          h('span', { class: 'truncate' }, `Why ${enriched.risk_level}: ${driverInfo.reasons[0] || 'Elevated Factors'}`),
          );
        }

        return h('span', {
          class: 'text-xs text-gray-500 block max-w-[220px] truncate',
          title: driverInfo.fullSummary || 'Baseline Operational Limits',
        }, driverInfo.shortSummary || 'Baseline Limits');
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
