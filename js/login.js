import { h } from './ui.js';
import * as auth from './auth.js';

const fa = (name) => h('i', { class: `fa-solid fa-${name}`, 'aria-hidden': 'true' });

const COOLDOWNS = [60, 120, 240, 480];
const cdKey = (kind, email) => `osas.cd.${kind}.${String(email).toLowerCase()}`;
function readCooldown(kind, email) {
  try { return JSON.parse(sessionStorage.getItem(cdKey(kind, email))) || { n: 0, until: 0 }; }
  catch { return { n: 0, until: 0 }; }
}
function armCooldown(kind, email) {
  const cur = readCooldown(kind, email);
  const next = { n: cur.n + 1, until: Date.now() + COOLDOWNS[Math.min(cur.n, COOLDOWNS.length - 1)] * 1000 };
  try { sessionStorage.setItem(cdKey(kind, email), JSON.stringify(next)); } catch {}
  return next;
}
function clearCooldown(kind, email) { try { sessionStorage.removeItem(cdKey(kind, email)); } catch {} }
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const waitLabel = (n) => { const s = COOLDOWNS[Math.min(n, COOLDOWNS.length - 1)]; return `${s / 60} min`; };

const EASE = 'cubic-bezier(.76,0,.24,1)';
const EASE_SWAP = 'cubic-bezier(.6,.05,.26,.99)';
const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = (el, frames, opts) => (el && el.animate ? el.animate(frames, { fill: 'both', ...opts }) : null);
const done = (a) => (a ? a.finished.catch(() => {}) : Promise.resolve());

function field({ label, icon, input, trailing, hint, extra }) {
  return h('div', { class: 'lg-field' },
    h('label', { class: 'lg-label' }, label),
    h('div', { class: 'lg-input-wrap' },
      h('span', { class: 'lg-input-icon' }, fa(icon)),
      input,
      trailing || null,
    ),
    hint ? h('p', { class: 'lg-field-hint' }, hint) : null,
    extra || null,
  );
}

function mkErr() {
  const el = h('p', { class: 'lg-error lg-hidden', role: 'alert' });
  return {
    el,
    show: (m, { quiet } = {}) => {
      el.textContent = m;
      el.classList.remove('lg-hidden');
      if (quiet || reduceMotion()) return;
      anim(el, [
        { opacity: 0, transform: 'translateY(-6px)' },
        { opacity: 1, transform: 'translateX(-7px)', offset: 0.25 },
        { transform: 'translateX(6px)', offset: 0.45 },
        { transform: 'translateX(-4px)', offset: 0.65 },
        { transform: 'translateX(2px)', offset: 0.85 },
        { opacity: 1, transform: 'none' },
      ], { duration: 480, easing: 'ease-out' });
    },
    clear: () => el.classList.add('lg-hidden'),
  };
}

const PASSWORD_RULES = [
  { id: 'len', text: 'Must be at least 8 characters long', test: (v) => v.length >= 8 },
  { id: 'upper', text: 'Must have at least one uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', text: 'Must have at least one lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'num', text: 'Must have at least one number', test: (v) => /[0-9]/.test(v) },
];

const PW_RULES_ID = 'lg-pw-rules';

function passwordChecklist(input) {
  const rows = PASSWORD_RULES.map((r) => {
    const ring = h('span', { class: 'lg-rule-ring' });
    const icon = h('span', { class: 'lg-rule-icon' }, fa('xmark'), fa('check'), ring);
    const li = h('li', { class: 'lg-rule' }, icon, h('span', {}, r.text));
    return { r, li, icon, ring, met: false };
  });
  const fill = h('span', { class: 'lg-progress-fill' });
  const bar = h('div', {
    class: 'lg-progress', role: 'progressbar', 'aria-label': 'Password requirements met',
    'aria-valuemin': '0', 'aria-valuemax': String(PASSWORD_RULES.length), 'aria-valuenow': '0',
  }, fill);
  const list = h('ul', { class: 'lg-rules', id: PW_RULES_ID }, rows.map((x) => x.li));
  const panel = h('div', { class: 'lg-rules-panel' }, bar, list);
  const reveal = h('div', { class: 'lg-rules-reveal' }, panel);
  const wrap = h('div', { class: 'lg-rules-wrap' }, reveal);
  input.setAttribute('aria-describedby', PW_RULES_ID);

  let open = false;
  let closeTimer = null;
  let metCount = 0;
  const live = new Set();
  const play = (el, frames, opts) => {
    const a = anim(el, frames, opts);
    if (!a) return null;
    live.add(a);
    a.finished.catch(() => {}).then(() => live.delete(a));
    return a;
  };
  const stopAll = () => { live.forEach((a) => { try { a.cancel(); } catch {} }); live.clear(); };

  function setOpen(show) {
    if (show === open) return;
    open = show;
    stopAll();
    if (reduceMotion()) { wrap.style.height = show ? 'auto' : '0px'; return; }
    const from = wrap.getBoundingClientRect().height;
    const to = show ? reveal.offsetHeight : 0;
    wrap.style.height = `${to}px`;
    const grow = play(wrap, [{ height: `${from}px` }, { height: `${to}px` }], {
      duration: show ? 560 : 300, easing: show ? EASE_OUT : EASE_SWAP,
    });
    done(grow).then(() => {
      try { grow.cancel(); } catch {}
      if (show && open) wrap.style.height = 'auto';
    });
    play(panel, show ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], {
      duration: show ? 320 : 200, easing: show ? EASE_OUT : 'ease-in',
    });
    if (show) {
      rows.forEach((x, i) => play(x.li, [
        { opacity: 0, transform: 'translateY(-9px) scale(.97)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 520, delay: 90 + i * 70, easing: EASE_OUT }));
    }
  }

  const update = () => {
    let met = 0;
    rows.forEach((x) => {
      const ok = x.r.test(input.value);
      if (ok) met += 1;
      if (ok === x.met) return;
      x.met = ok;
      x.li.classList.toggle('is-met', ok);
      if (reduceMotion()) return;
      play(x.icon, ok
        ? [{ transform: 'scale(.55)' }, { transform: 'scale(1.32)', offset: .55 }, { transform: 'scale(1)' }]
        : [{ transform: 'scale(1.24)' }, { transform: 'scale(1)' }],
        { duration: ok ? 460 : 260, easing: ok ? EASE_OUT : EASE_SWAP });
      play(x.li, [
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(3px)', offset: .55 },
        { transform: 'none' },
      ], { duration: 440, easing: EASE_OUT });
      if (ok) play(x.ring, [
        { opacity: .85, transform: 'scale(.5)' },
        { opacity: 0, transform: 'scale(2.3)' },
      ], { duration: 640, easing: EASE_OUT });
    });
    if (met === metCount) return;
    metCount = met;
    fill.style.transform = `scaleX(${met / PASSWORD_RULES.length})`;
    bar.setAttribute('aria-valuenow', String(met));
    const complete = met === PASSWORD_RULES.length;
    panel.classList.toggle('is-complete', complete);
    input.classList.toggle('is-valid', complete);
  };

  const cancelClose = () => { clearTimeout(closeTimer); closeTimer = null; };
  const scheduleClose = () => { cancelClose(); closeTimer = setTimeout(() => setOpen(false), 140); };
  let boxBound = false;
  const bindBox = () => {
    if (boxBound) return;
    const box = input.parentElement;
    if (!box) return;
    boxBound = true;
    box.addEventListener('focusout', (e) => {
      if (!box.contains(e.relatedTarget)) scheduleClose();
    });
  };

  input.addEventListener('input', update);
  input.addEventListener('focus', () => { bindBox(); cancelClose(); setOpen(true); });

  return {
    el: wrap,
    open: () => setOpen(true),
    firstUnmet: () => (PASSWORD_RULES.find((r) => !r.test(input.value)) || {}).text || '',
  };
}

function revealChildren(form, { base = 80, step = 55, max = 420 } = {}) {
  if (reduceMotion() || !form) return;
  [...form.children].forEach((el, i) => {
    anim(el, [
      { opacity: 0, transform: 'translateY(14px) scale(.985)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 560, delay: base + Math.min(i * step, max), easing: EASE_OUT });
  });
}

function eyeToggle(inputs) {
  const eye = h('button', {
    type: 'button', class: 'lg-eye', 'aria-label': 'Show password',
    onclick: () => {
      const show = inputs[0].type === 'password';
      inputs.forEach((i) => { i.type = show ? 'text' : 'password'; });
      eye.innerHTML = '';
      eye.appendChild(fa(show ? 'eye-slash' : 'eye'));
    },
  }, fa('eye'));
  return eye;
}

export function showLogin({ onSuccess }) {
  document.getElementById('login-overlay')?.remove();

  const timers = new Set();
  const stopTimers = () => { timers.forEach(clearInterval); timers.clear(); };

  const brandInner = h('div', { class: 'lg-brand-inner' },
    h('img', { src: '/assets/logo.png', alt: 'SAAC seal', class: 'lg-logo' }),
    h('h1', { class: 'lg-brand-title' }, 'St. Agnes Academy'),
    h('p', { class: 'lg-brand-sub' }, 'Office of Student Affairs & Services'),
    h('p', { class: 'lg-brand-text' }, 'Secure access to the campus safety and disaster-risk dashboard of St. Agnes Academy.'),
    h('div', { class: 'lg-glass' },
      h('span', { class: 'lg-chip' }, 'One platform'),
      h('div', { class: 'lg-tiles' },
        ['Incidents', 'Drills', 'Inspections', 'Reports'].map((t) => h('div', { class: 'lg-tile' }, t)),
      ),
    ),
  );
  const brand = h('section', { class: 'lg-brand' }, brandInner);
  const card = h('div', { class: 'lg-card' });
  const side = h('section', { class: 'lg-side' }, card);

  function otpForm({ kind, email, eyebrow, title, lead, submitLabel, verify, resend, back }) {
    const err = mkErr();
    const code = h('input', {
      type: 'text', class: 'lg-input lg-code', inputmode: 'numeric', autocomplete: 'one-time-code',
      maxlength: '5', placeholder: '•••••', required: true, 'aria-label': 'Verification code',
      'aria-describedby': 'otp-format-hint',
    });
    code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 5); err.clear(); });

    const submit = h('button', { type: 'submit', class: 'lg-btn' }, submitLabel);
    const resendBtn = h('button', { type: 'button', class: 'lg-link lg-inline', disabled: true }, '');
    const note = h('p', { class: 'lg-hint' });

    let ticker = null;
    const stop = () => { if (ticker) { clearInterval(ticker); timers.delete(ticker); ticker = null; } };
    const tick = () => {
      const { n, until } = readCooldown(kind, email);
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      if (left > 0) {
        resendBtn.disabled = true;
        resendBtn.textContent = `Resend code in ${fmt(left)}`;
        note.textContent = `Each resend takes a little longer to unlock (up to 8 min). The next wait will be ${waitLabel(n)}.`;
      } else {
        stop();
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend code';
        note.textContent = 'Can’t find it? Check your spam folder. Codes expire after a while.';
      }
    };
    const startTicker = () => { stop(); tick(); if (!resendBtn.disabled) return; ticker = setInterval(tick, 1000); timers.add(ticker); };

    resendBtn.addEventListener('click', async () => {
      err.clear();
      resendBtn.disabled = true;
      resendBtn.textContent = 'Sending…';
      try {
        await resend();
        armCooldown(kind, email);
        startTicker();
      } catch (e) {
        err.show(e.message || 'Could not resend the code.');
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend code';
      }
    });

    const form = h('form', {
      class: 'lg-form',
      onsubmit: async (e) => {
        e.preventDefault();
        err.clear();
        if (code.value.length < 5) { err.show('Enter the 5-digit code from your email.'); return; }
        submit.disabled = true;
        submit.classList.add('is-loading');
        submit.textContent = 'Verifying…';
        try {
          await verify(code.value);
          stop();
          clearCooldown(kind, email);
        } catch (e2) {
          err.show(e2.message || 'Verification failed.');
          submit.disabled = false;
          submit.classList.remove('is-loading');
          submit.textContent = submitLabel;
          code.select();
        }
      },
    },
      h('p', { class: 'lg-eyebrow' }, eyebrow),
      h('h2', { class: 'lg-title' }, title),
      h('p', { class: 'lg-lead' }, lead, ' ', h('strong', {}, email)),
      field({ label: 'Verification code', icon: 'shield-halved', input: code }),
      err.el,
      submit,
      h('div', { class: 'lg-row' },
        back ? h('button', { type: 'button', class: 'lg-link lg-inline', onclick: back.fn }, back.label) : h('span'),
        resendBtn,
      ),
      note,
    );
    startTicker();
    return { form, focus: () => code.focus(), stop };
  }

  let modalEl = null;
  function openVerifyModal(email) {
    closeModal(true);
    const otp = otpForm({
      kind: 'signup', email,
      eyebrow: 'Verify your email', title: 'Enter your code',
      lead: 'We emailed a verification code to', submitLabel: 'Verify & Continue',
      verify: async (code) => { await auth.verifySignup(email, code); closeModal(true); finish(); },
      resend: () => auth.resendSignup(email),
      back: { label: '← Change email', fn: () => closeModal() },
    });
    const close = h('button', { type: 'button', class: 'lg-modal-x', 'aria-label': 'Close', onclick: () => closeModal() }, fa('xmark'));
    const modal = h('div', { class: 'lg-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Verify your email' }, close, otp.form);
    const backdrop = h('div', { class: 'lg-modal-backdrop' }, modal);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal(); });
    modalEl = { backdrop, modal, otp };
    overlay.appendChild(backdrop);
    if (!reduceMotion()) {
      anim(backdrop, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
      anim(modal, [{ opacity: 0, transform: 'translateY(24px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE_OUT });
    }
    otp.focus();
  }
  async function closeModal(instant = false) {
    if (!modalEl) return;
    const { backdrop, modal, otp } = modalEl;
    modalEl = null;
    otp.stop();
    if (!instant && !reduceMotion()) {
      anim(modal, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(.98)' }], { duration: 220, easing: 'ease-in' });
      await done(anim(backdrop, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in' }));
    }
    backdrop.remove();
  }
  document.addEventListener('keydown', function onKey(e) {
    if (!document.getElementById('login-overlay')) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'Escape' && modalEl) closeModal();
  });

  function renderCredentials(prefillEmail = '', noticeText = '') {
    stopTimers();
    card.innerHTML = '';
    const err = mkErr();
    const notice = h('p', { class: 'lg-notice' + (noticeText ? '' : ' lg-hidden'), role: 'status' }, noticeText);

    const email = h('input', {
      type: 'email', class: 'lg-input', placeholder: 'you@saac.edu.ph',
      autocomplete: 'username', required: true, value: prefillEmail,
    });
    const password = h('input', {
      type: 'password', class: 'lg-input', placeholder: 'Password',
      autocomplete: 'current-password', required: true,
    });
    const submit = h('button', { type: 'submit', class: 'lg-btn' }, 'Sign In');

    const form = h('form', {
      class: 'lg-form',
      onsubmit: async (e) => {
        e.preventDefault();
        err.clear();
        submit.disabled = true;
        submit.classList.add('is-loading');
        submit.textContent = 'Checking…';
        try {
          const r = await auth.signIn(email.value, password.value);
          if (r.step === 'pin') {
            stepTo(() => renderPin(r.email));
          } else {
            armCooldown('login', r.email);
            stepTo(() => renderOtp(r.email));
          }
        } catch (ex) {
          if (ex.locked) {
            openLockedModal(ex.email || email.value.trim().toLowerCase(), ex.unlockSent !== false);
            return;
          }
          if (ex.unconfirmed) {
            const addr = email.value.trim().toLowerCase();
            if (readCooldown('signup', addr).until <= Date.now()) {
              try { await auth.resendSignup(addr); armCooldown('signup', addr); } catch {}
            }
            openVerifyModal(addr);
          } else {
            err.show(ex.message || 'Sign-in failed.');
          }
          submit.disabled = false;
          submit.classList.remove('is-loading');
          submit.textContent = 'Sign In';
        }
      },
    },
      h('p', { class: 'lg-eyebrow' }, 'Secure entry'),
      h('h2', { class: 'lg-title' }, 'Welcome Back'),
      h('p', { class: 'lg-lead' }, 'Sign in to access the St. Agnes Academy OSAS Dashboard.'),
      field({ label: 'Email', icon: 'user', input: email }),
      field({ label: 'Password', icon: 'lock', input: password, trailing: eyeToggle([password]) }),
      h('p', { class: 'lg-switch' }, 'No account yet? ',
        h('button', { type: 'button', class: 'lg-switch-btn', onclick: () => switchTo(() => renderRegister()) }, 'Register now.')),
      h('p', { class: 'lg-switch lg-switch--locked' }, 'Account locked? ',
        h('button', { type: 'button', class: 'lg-switch-btn', onclick: () => stepTo(() => openUnlockScreen()) }, 'Unlock it here.')),
      notice,
      err.el,
      submit,
      h('p', { class: 'lg-hint' }, 'A 5-digit verification code will be emailed to you after your password is accepted.'),
    );
    card.appendChild(form);
    return () => (prefillEmail ? password : email).focus({ preventScroll: true });
  }

  function renderPin(addr) {
    stopTimers();
    card.innerHTML = '';
    const LEN = 4;
    let value = '';
    let locked = false;
    let lockTimer = null;

    const err = mkErr();
    const dots = Array.from({ length: LEN }, () => h('span', { class: 'lg-pin-dot' }));
    const dotRow = h('div', { class: 'lg-pin-dots', role: 'status', 'aria-live': 'polite', 'aria-label': 'PIN entry' }, dots);
    const scan = h('div', { class: 'lg-pin-scan' }, h('span', { class: 'lg-pin-ring' }), h('span', { class: 'lg-pin-ring lg-pin-ring-2' }), fa('fingerprint'));

    const paint = () => dots.forEach((d, i) => d.classList.toggle('is-filled', i < value.length));

    const stopLock = () => { if (lockTimer) { clearInterval(lockTimer); timers.delete(lockTimer); lockTimer = null; } };
    const setLocked = (on) => { locked = on; keys.forEach((k) => { k.disabled = on; }); form.classList.toggle('is-locked', on); };
    const startLock = () => {
      setLocked(true);
      stopLock();
      const tick = () => {
        const left = auth.pinLockSeconds();
        if (left <= 0) { stopLock(); setLocked(false); err.clear(); return; }
        err.show(`Too many wrong PINs. Try again in ${left}s.`, { quiet: true });
      };
      tick();
      lockTimer = setInterval(tick, 1000);
      timers.add(lockTimer);
    };

    async function submitPin() {
      locked = true;
      try {
        await auth.verifyPin(value);
        stopLock();
        dotRow.classList.add('is-ok');
        scan.classList.add('is-ok');
        scan.replaceChildren(fa('check'));
        keys.forEach((k) => { k.disabled = true; });
        setTimeout(finish, reduceMotion() ? 0 : 650);
      } catch (ex) {
        value = '';
        dotRow.classList.add('is-bad');
        if (!reduceMotion()) {
          anim(dotRow, [
            { transform: 'translateX(0)' }, { transform: 'translateX(-12px)' }, { transform: 'translateX(10px)' },
            { transform: 'translateX(-7px)' }, { transform: 'translateX(4px)' }, { transform: 'none' },
          ], { duration: 460, easing: 'ease-out' });
        }
        setTimeout(() => { dotRow.classList.remove('is-bad'); paint(); }, 420);
        if (ex.locked) { startLock(); } else { locked = false; err.show(ex.message || 'Could not verify the PIN.'); }
        if (/expired/i.test(ex.message || '')) setTimeout(() => stepTo(() => renderCredentials(addr)), 1200);
      }
    }

    function press(d) {
      if (locked || value.length >= LEN) return;
      err.clear();
      value += d;
      paint();
      if (value.length === LEN) submitPin();
    }
    function back() {
      if (locked || !value) return;
      value = value.slice(0, -1);
      paint();
    }

    const keys = [];
    const keyBtn = (label, onclick, extra = '') => {
      const b = h('button', { type: 'button', class: `lg-key ${extra}` }, label);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); onclick(); });
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick(); } });
      keys.push(b);
      return b;
    };
    const pad = h('div', { class: 'lg-keypad' },
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => keyBtn(d, () => press(d))),
      h('span'),
      keyBtn('0', () => press('0')),
      keyBtn(fa('delete-left'), back, 'lg-key-ghost'),
    );
    pad.lastChild.setAttribute('aria-label', 'Delete');

    const onKey = (e) => {
      if (!document.getElementById('login-overlay') || !document.querySelector('.lg-keypad')) { document.removeEventListener('keydown', onKey); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); back(); }
    };
    const onPaste = (e) => {
      if (!document.querySelector('.lg-keypad')) { document.removeEventListener('paste', onPaste); return; }
      const digits = ((e.clipboardData && e.clipboardData.getData('text')) || '').replace(/\D/g, '').slice(0, LEN);
      if (digits) { e.preventDefault(); [...digits].forEach(press); }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('paste', onPaste);

    const form = h('div', { class: 'lg-form lg-pin' },
      h('p', { class: 'lg-eyebrow' }, 'Admin verification'),
      scan,
      h('h2', { class: 'lg-title lg-center' }, 'Enter your PIN'),
      h('p', { class: 'lg-lead lg-center' }, 'Confirm it’s you, ', h('strong', {}, addr)),
      dotRow,
      err.el,
      pad,
      h('button', { type: 'button', class: 'lg-link', onclick: async () => { await auth.cancelPin(); stepTo(() => renderCredentials(addr)); } }, '← Use a different account'),
    );
    card.appendChild(form);
    if (auth.pinLockSeconds() > 0) startLock();
    return () => {};
  }

  function renderOtp(addr) {
    stopTimers();
    card.innerHTML = '';
    const otp = otpForm({
      kind: 'login', email: addr,
      eyebrow: 'Two-step verification', title: 'Check your email',
      lead: 'We sent a verification code to', submitLabel: 'Verify & Sign In',
      verify: async (code) => { await auth.verifyCode(addr, code); finish(); },
      resend: () => auth.sendCode(addr),
      back: { label: '← Use a different account', fn: () => stepTo(() => renderCredentials(addr)) },
    });
    card.appendChild(otp.form);
    return () => otp.focus();
  }


  function openLockedModal(addr, unlockSent) {
    closeModal(true);
    const locked = h('div', { class: 'lg-locked' },
      iconBig(),
      h('p', { class: 'lg-eyebrow lg-center' }, 'Account locked'),
      h('h2', { class: 'lg-title lg-center' }, 'Too many attempts'),
      h('p', { class: 'lg-lead lg-center' },
        'This account is locked after ', h('strong', {}, '5 wrong passwords'),
        '. ', unlockSent
          ? 'We emailed an unlock code to '
          : 'We could not email an unlock code to ',
        h('strong', {}, addr), '.',
      ),
      unlockSent
        ? h('p', { class: 'lg-lead lg-center lg-lead-sub' }, 'Click “Unlock my account” and type the code from the email (for example ', h('span', { class: 'lg-code-ex' }, 'NSVF-N4D7'), ').')
        : null,
    );
    const goUnlock = h('button', { type: 'button', class: 'lg-btn', onclick: () => { closeModal(true); openUnlockScreen(addr); } }, 'Unlock my account');
    const back = h('button', { type: 'button', class: 'lg-link lg-inline', onclick: () => closeModal() }, 'Close');
    const structured = h('div', { class: 'lg-locked-body lg-center' }, goUnlock, back);
    const modal = h('div', { class: 'lg-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Account locked' }, locked, structured);
    const backdrop = h('div', { class: 'lg-modal-backdrop' }, modal);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal(); });
    modalEl = { backdrop, modal, otp: { stop: () => {}, focus: () => {} } };
    overlay.appendChild(backdrop);
    if (!reduceMotion()) {
      anim(backdrop, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
      anim(modal, [{ opacity: 0, transform: 'translateY(24px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE_OUT });
    }
  }
  function iconBig() {
    return h('div', { class: 'lg-locked-icon' }, fa('lock'));
  }

  function openUnlockScreen(addr = '') {
    stopTimers();
    card.innerHTML = '';
    const err = mkErr();
    const notice = h('p', { class: 'lg-notice lg-hidden', role: 'status' });

    const email = h('input', {
      type: 'email', class: 'lg-input', placeholder: 'you@saac.edu.ph',
      autocomplete: 'username', required: true, value: addr,
    });
    const codeInput = h('input', {
      type: 'text', class: 'lg-input lg-code', maxlength: '9', placeholder: 'NSVF-N4D7',
      required: true, 'aria-label': 'Unlock code', autocomplete: 'off', spellcheck: 'false',
    });
    // Formats XXXX-XXXX while typing (auto-dash, uppercase, a-z/A-Z0-9 only).
    codeInput.addEventListener('input', () => {
      const raw = codeInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      const hadDash = codeInput.dataset.dash === '1';
      const compact = raw.replace(/-/g, '').slice(0, 8);
      let out = compact;
      if (hadDash || (compact.length > 4)) out = compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
      codeInput.dataset.dash = raw.includes('-') ? '1' : '0';
      codeInput.value = out;
      err.clear();
    });
    const submit = h('button', { type: 'submit', class: 'lg-btn' }, 'Unlock Account');

    const resendWrap = h('div', { class: 'lg-row' },
      h('button', { type: 'button', class: 'lg-link lg-inline', onclick: () => stepTo(() => renderCredentials()) }, '← Back to sign in'),
      sendNewCodeButton(addr, err, notice),
    );

    const form = h('form', {
      class: 'lg-form',
      onsubmit: async (e) => {
        e.preventDefault();
        err.clear();
        notice.classList.add('lg-hidden');
        const addr2 = email.value.trim().toLowerCase();
        if (!authGwAvailable()) { err.show('The unlock service is not available right now. Please contact the OSAS office.'); return; }
        if (!addr2) { err.show('Enter the email of the locked account.'); email.focus(); return; }
        if (codeInput.value.replace(/[^A-Z0-9]/g, '').length < 8) { err.show('Enter the 8-character unlock code from your email, e.g. NSVF-N4D7.'); codeInput.focus(); return; }
        submit.disabled = true;
        submit.classList.add('is-loading');
        submit.textContent = 'Unlocking…';
        try {
          await auth.unlockWithCode(addr2, codeInput.value);
          notice.textContent = 'Account unlocked! You can sign in again with your password.';
          notice.classList.remove('lg-hidden');
          submit.disabled = false;
          submit.classList.remove('is-loading');
          submit.textContent = 'Unlock Account';
          setTimeout(() => stepTo(() => renderCredentials(addr2, 'Account unlocked. Sign in to continue.')), 1400);
        } catch (ex) {
          err.show(ex.message || 'Could not unlock the account.');
          submit.disabled = false;
          submit.classList.remove('is-loading');
          submit.textContent = 'Unlock Account';
          codeInput.select();
        }
      },
    },
      h('p', { class: 'lg-eyebrow lg-center' }, 'Retry access'),
      h('div', { class: 'lg-locked-icon' }, fa('unlock-keyhole')),
      h('h2', { class: 'lg-title lg-center' }, 'Unlock your account'),
      h('p', { class: 'lg-lead lg-center' }, 'Type the unlock code we emailed you. It looks like ', h('span', { class: 'lg-code-ex' }, 'NSVF-N4D7'), '.'),
      field({ label: 'Email', icon: 'user', input: email }),
      field({ label: 'Unlock code', icon: 'shield-halved', input: codeInput }),
      notice,
      err.el,
      submit,
      resendWrap,
    );
    card.appendChild(form);
    return () => email.focus({ preventScroll: true });
  }

  function authGwAvailable() {
    return Boolean(window.OSAS && window.OSAS.AUTH_FN_URL);
  }
  function sendNewCodeButton(addr, err, notice) {
    const btn = h('button', {
      type: 'button', class: 'lg-link lg-inline',
      onclick: async (e) => {
        const b = e.currentTarget;
        const addr2 = document.querySelector('#login-overlay input[type="email"]').value.trim().toLowerCase();
        if (!addr2) { err.show('Enter the email of the locked account first.'); return; }
        b.disabled = true; b.textContent = 'Sending…';
        try {
          const r = await auth.sendUnlockCode(addr2);
          notice.textContent = (r && r.message) || 'A fresh unlock code was emailed.';
          notice.classList.remove('lg-hidden');
          err.clear();
        } catch (ex) {
          err.show(ex.message || 'Could not send the code.');
        }
        setTimeout(() => { b.disabled = false; b.textContent = 'Email me a new code'; }, 3000);
      },
    }, 'Email me a new code');
    return btn;
  }

  function renderRegister() {
    stopTimers();
    card.innerHTML = '';
    const err = mkErr();
    const name = h('input', { type: 'text', class: 'lg-input', placeholder: 'Juan Dela Cruz', autocomplete: 'name', required: true });
    const email = h('input', { type: 'email', class: 'lg-input', placeholder: 'you@saac.edu.ph', autocomplete: 'email', required: true });
    const password = h('input', { type: 'password', class: 'lg-input', placeholder: 'Create a password', autocomplete: 'new-password', required: true, minlength: '8' });
    const confirm = h('input', { type: 'password', class: 'lg-input', placeholder: 'Re-enter password', autocomplete: 'new-password', required: true, minlength: '8' });
    const submit = h('button', { type: 'submit', class: 'lg-btn' }, 'Create Account');

    const checklist = passwordChecklist(password);

    const form = h('form', {
      class: 'lg-form',
      onsubmit: async (e) => {
        e.preventDefault();
        err.clear();
        const unmet = checklist.firstUnmet();
        if (unmet) { err.show(unmet + '.'); password.focus(); return; }
        if (password.value !== confirm.value) { err.show('The two passwords do not match.'); return; }
        submit.disabled = true;
        submit.classList.add('is-loading');
        submit.textContent = 'Creating…';
        try {
          const r = await auth.register({ name: name.value, email: email.value, password: password.value });
          if (r.needsConfirm) {
            armCooldown('signup', r.email);
            openVerifyModal(r.email);
          } else {
            switchTo(() => renderCredentials(r.email, 'Account created. Sign in to continue.'));
          }
        } catch (ex) {
          err.show(ex.message || 'Could not create the account.');
        }
        submit.disabled = false;
          submit.classList.remove('is-loading');
        submit.textContent = 'Create Account';
      },
    },
      h('p', { class: 'lg-eyebrow' }, 'New here'),
      h('h2', { class: 'lg-title' }, 'Create Account'),
      h('p', { class: 'lg-lead' }, 'Register to get access to the St. Agnes Academy OSAS Dashboard.'),
      field({ label: 'Full name', icon: 'id-card', input: name }),
      field({ label: 'Email', icon: 'user', input: email }),
      field({ label: 'Password', icon: 'lock', input: password, trailing: eyeToggle([password, confirm]), extra: checklist.el }),
      field({ label: 'Confirm password', icon: 'lock', input: confirm }),
      h('p', { class: 'lg-switch' }, 'Already have an account? ',
        h('button', { type: 'button', class: 'lg-switch-btn', onclick: () => switchTo(() => renderCredentials()) }, 'Sign In.')),
      err.el,
      submit,
    );
    card.appendChild(form);
    return () => name.focus({ preventScroll: true });
  }

  async function finish() {
    if (!reduceMotion()) {
      anim(card, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-14px) scale(.97)', opacity: 0 }], { duration: 380, easing: 'ease-in' });
      await done(anim(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: 'ease-in', delay: 120 }));
    }
    overlay.remove();
    onSuccess();
  }

  async function stepTo(renderFn) {
    if (busy) return;
    if (reduceMotion()) { renderFn()?.(); return; }
    busy = true;
    try {
      const old = card.firstElementChild;
      const h0 = card.offsetHeight;
      await done(anim(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-18px)' }], { duration: 200, easing: 'ease-in' }));
      const focus = renderFn();
      const form = card.firstElementChild;
      card.style.overflow = 'hidden';
      const h1 = card.offsetHeight;
      anim(card, [{ height: `${h0}px` }, { height: `${h1}px` }], { duration: 420, easing: EASE_OUT, fill: 'none' });
      revealChildren(form, { base: 40 });
      await new Promise((r) => setTimeout(r, 420));
      if (focus) focus();
    } finally {
      card.style.overflow = '';
      busy = false;
    }
  }

  let busy = false;
  async function switchTo(renderFn) {
    if (busy) return;
    if (reduceMotion()) { overlay.classList.toggle('lg-flipped'); renderFn()?.(); return; }
    busy = true;
    try {
    const DUR = 1050;
    const b0 = brand.getBoundingClientRect();
    const s0 = side.getBoundingClientRect();
    const h0 = card.offsetHeight;
    const old = card.firstElementChild;
    overlay.classList.toggle('lg-flipped');
    const b1 = brand.getBoundingClientRect();
    const s1 = side.getBoundingClientRect();

    brand.style.zIndex = '2';
    const bAnim = anim(brand, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.12)', offset: 0.5 }, { filter: 'brightness(1)' }], { duration: DUR, easing: 'ease-in-out' });
    const dx = b0.left - b1.left;
    const dy = b0.top - b1.top;
    anim(brand, [
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: `translate(${dx * -0.02}px, ${dy * -0.02}px)`, offset: 0.86 },
      { transform: 'none' },
    ], { duration: DUR, easing: EASE_SWAP });
    void bAnim;
    anim(side, [
      { transform: `translate(${s0.left - s1.left}px, ${s0.top - s1.top}px)` },
      { transform: 'none' },
    ], { duration: DUR, easing: EASE_SWAP });
    anim(brandInner, [
      { transform: `translateX(${dx * 0.1}px)`, opacity: 0.6 },
      { transform: 'none', opacity: 1 },
    ], { duration: DUR, easing: EASE_SWAP });

    const EXIT_MS = 240;
    const SETTLE_MS = 150;
    await done(anim(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: EXIT_MS, easing: 'ease-in' }));
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    const focus = renderFn();
    const form = card.firstElementChild;
    card.style.overflow = 'hidden';
    const h1 = card.offsetHeight;
    anim(card, [
      { height: `${h0}px` },
      { height: `${h1 + 5}px`, offset: 0.82 },
      { height: `${h1}px` },
    ], { duration: 620, easing: EASE_OUT, fill: 'none' });
    revealChildren(form, { base: 120, step: 50, max: 380 });
    [...brandInner.children].forEach((el, i) => {
      anim(el, [
        { opacity: 0, transform: `translateX(${dx > 0 ? 28 : -28}px)` },
        { opacity: 1, transform: 'none' },
      ], { duration: 700, delay: 260 + i * 70, easing: EASE_OUT });
    });
    [...brandInner.querySelectorAll('.lg-tile')].forEach((el, i) => {
      anim(el, [{ transform: 'scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, delay: 560 + i * 70, easing: EASE_OUT });
    });

    const remaining = Math.max(0, DUR - EXIT_MS - SETTLE_MS);
    await new Promise((r) => setTimeout(r, remaining));
    if (focus) focus();
    } finally {
      card.style.overflow = '';
      brand.style.zIndex = '';
      busy = false;
    }
  }

  const overlay = h('div', { id: 'login-overlay', class: 'lg-root' }, brand, side);
  document.body.appendChild(overlay);
  const focusFirst = renderCredentials();
  // Email deep-link: ".../#/unlock" opens the unlock screen directly.
  if ((location.hash || '').replace(/\/$/, '').toLowerCase() === '#/unlock') {
    try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    stepTo(() => openUnlockScreen());
  }
  if (!reduceMotion()) {
    anim(brand, [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'none' }], { duration: 900, easing: EASE_OUT });
    [...brandInner.children].forEach((el, i) => {
      anim(el, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 250 + i * 90, easing: EASE_OUT });
    });
    anim(card, [{ opacity: 0, transform: 'translateY(32px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 150, easing: EASE_OUT });
    revealChildren(card.firstElementChild, { base: 350, step: 60 });
  }
  focusFirst();
}
