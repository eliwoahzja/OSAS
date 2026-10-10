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
        ? h('p', { class: 'lg-lead lg-center lg-lead-sub' }, 'Open the email we just sent and tap the ', h('strong', {}, 'Verify Now'), ' button (or scan its QR code) to unlock your account.')
        : null,
    );
    const goUnlock = h('button', { type: 'button', class: 'lg-btn', onclick: () => closeModal() }, 'Got it — check my email');
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

  function openUnlockScreen(params = {}) {
    // The unlock page may ONLY be reached via the emailed "Verify Now" link/QR:
    // the link carries a one-time invite token (k). No token -> explain and send back.
    const pageToken = String(params.k || '').trim();
    const prefillEmail = String(params.email || '').toLowerCase();
    const linkedCode = String(params.code || '').toUpperCase();
    lastUnlockEmail = prefillEmail;
    if (!pageToken) {
      card.innerHTML = '';
      const err = mkErr();
      const form = h('div', { class: 'lg-form lg-verify' },
        h('p', { class: 'lg-eyebrow lg-center' }, 'Account security'),
        h('div', { class: 'lg-locked-icon' }, fa('lock')),
        h('h2', { class: 'lg-title lg-center' }, 'Open this from your email'),
        h('p', { class: 'lg-lead lg-center' }, 'For your security, account unlocking can only be started from the "Verify Now" button (or QR code) in the lock email sent to you.'),
        err.el,
        h('div', { class: 'lg-row' },
          h('button', { type: 'button', class: 'lg-link lg-inline', onclick: () => stepTo(() => renderCredentials(prefillEmail)) }, '← Back to sign in'),
        ),
      );
      card.appendChild(form);
      return () => {};
    }
    stopTimers();
    card.innerHTML = '';
    const err = mkErr();
    const notice = h('p', { class: 'lg-notice lg-hidden', role: 'status' });

    const email = h('input', {
      type: 'email', class: 'lg-input', placeholder: 'you@saac.edu.ph',
      autocomplete: 'username', required: true, value: prefillEmail,
      ...(linkedCode ? { readonly: 'readonly' } : {}),
    });
    // GitHub-style code input: individual cells, two groups of 4 (XXXX-XXXX),
    // backed by a hidden input that holds the full value.
    const codeInput = h('input', {
      type: 'text', class: 'lg-hidden-real', maxlength: '9', required: true,
      'aria-label': 'Unlock code', autocomplete: 'off', spellcheck: 'false', tabindex: '-1',
    });
    codeInput.classList.add('lg-sr-only');
    const codeCells = [];
    const buildCells = () => {
      const wrap = h('div', { class: 'lg-otp', role: 'group', 'aria-label': 'Unlock code' });
      const groups = [0, 1].map(() => h('div', { class: 'lg-otp-group' }));
      const dash = h('div', { class: 'lg-otp-dash' }, fa('minus'));
      for (let i = 0; i < 8; i++) {
        const cell = h('input', {
          type: 'text', class: 'lg-otp-cell', maxlength: '1', inputmode: 'text',
          autocomplete: 'off', spellcheck: 'false', 'aria-label': `Unlock code character ${i + 1}`,
        });
        cell.addEventListener('input', () => {
          cell.value = cell.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
          if (cell.value && i < 7) codeCells[i + (i < 4 ? 1 : 5)]?.focus();
          syncFromCells();
        });
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !cell.value) {
            const prev = i > 4 ? codeCells[i - 1] : (i > 0 ? codeCells[i - 1] : null);
            if (prev) { prev.focus(); prev.value = ''; syncFromCells(); e.preventDefault(); }
          } else if (e.key === 'ArrowLeft' && i > 0) codeCells[i - 1].focus();
          else if (e.key === 'ArrowRight' && i < 7) codeCells[i + 1].focus();
        });
        cell.addEventListener('paste', (e) => {
          e.preventDefault();
          const text = (e.clipboardData || window.clipboardData).getData('text') || '';
          applyCodeValue(text);
          (codeCells[Math.min(7, text.replace(/-/g, '').length)] || codeCells[0]).focus();
        });
        codeCells.push(cell);
      }
      groups[0].append(codeCells[0], codeCells[1], codeCells[2], codeCells[3]);
      groups[1].append(codeCells[4], codeCells[5], codeCells[6], codeCells[7]);
      wrap.append(groups[0], dash, groups[1]);
      return wrap;
    };
    function syncFromCells() {
      codeInput.value = codeCells.map((c) => c.value).join('');
      err.clear();
    }
    function applyCodeValue(text) {
      const compact = String(text).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      codeCells.forEach((c, i) => { c.value = compact[i] || ''; });
      codeInput.value = compact;
      err.clear();
    }

    const submit = h('button', { type: 'submit', class: 'lg-btn' }, 'Verify & Unlock');

    async function verify(addr2, code, opts = {}) {
      const tokenOverride = opts.token ? String(opts.token).trim() : '';
      err.clear();
      notice.classList.add('lg-hidden');
      if (!authGwAvailable()) { err.show('The unlock service is not available right now. Please contact the OSAS office.'); return; }
      if (!addr2) { err.show('Enter the email of the locked account.'); email.focus(); return; }
      if (String(code).replace(/[^A-Z0-9]/gi, '').length < 8) { err.show('Enter the 8-character unlock code from your email, e.g. NSVF-N4D7.'); (codeCells.find((c) => !c.value) || codeCells[0]).focus(); return; }
      const btn = opts.btn || submit;
      const original = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.classList.add('is-loading'); btn.textContent = 'Verifying…'; }
      try {
        const r = await auth.unlockWithCode(addr2, code, tokenOverride || pageToken);
        notice.textContent = 'Account unlocked!';
        notice.classList.remove('lg-hidden');
        err.clear();
        if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); btn.textContent = original; }
        stopCamera();
        setTimeout(() => stepTo(() => openPasswordStep(addr2, r.reset_token)), 1300);
      } catch (ex) {
        if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); btn.textContent = original; }
        err.show(ex.message || 'Could not unlock the account.');
        if (opts.fromScan) switchTab('code');
        codeCells.forEach((c) => { c.classList.add('is-error'); setTimeout(() => c.classList.remove('is-error'), 900); });
        (codeCells.find((c) => !c.value) || codeCells[0]).focus();
      }
    }

    /* ---------------- tabs: Scan QR | Type code ---------------- */
    let cameraStream = null;
    let scanLoop = null;
    let jsQRlib = null;

    function stopCamera() {
      if (scanLoop) { clearInterval(scanLoop); scanLoop = null; }
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        cameraStream = null;
      }
      const v = document.getElementById('lg-scan-video');
      if (v) v.srcObject = null;
      const ph = document.getElementById('lg-scan-placeholder');
      if (ph) ph.classList.remove('lg-hidden');
    }

    async function loadJsQR() {
      if (jsQRlib !== null) return jsQRlib;
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm');
        jsQRlib = mod.default || mod;
      } catch { jsQRlib = false; }
      return jsQRlib;
    }

    async function decodeFrame(video) {
      const w = video.videoWidth, hh = video.videoHeight;
      if (!w || !hh) return null;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = hh;
      cv.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0);
      if ('BarcodeDetector' in window) {
        try {
          const det = new window.BarcodeDetector({ formats: ['qr_code'] });
          const found = await det.detect(cv);
          if (found && found.length) return found[0].rawValue;
        } catch { /* fall through to jsQR */ }
      }
      const lib = await loadJsQR();
      if (!lib) return null;
      const img = cv.getContext('2d').getImageData(0, 0, w, hh);
      const res = lib(img.data, w, hh);
      return res && res.data ? res.data : null;
    }

    function onQrDecoded(text) {
      // Expect .../#/unlock?email=..&code=..&k=..
      let scannedToken = pageToken;
      const m = /[?&]email=([^&]+)[&].*?code=([^&\s]+)/i.exec(text) || /[?&]code=([^&\s]+).*?[?&]email=([^&]+)/i.exec(text);
      let addr2 = prefillEmail, code = '';
      try {
        const url = new URL(text);
        const q = new URLSearchParams(url.hash.includes('?') ? url.hash.slice(url.hash.indexOf('?') + 1) : url.search);
        if (q.get('email')) addr2 = q.get('email').toLowerCase();
        if (q.get('code')) code = q.get('code').toUpperCase();
        if (q.get('k')) scannedToken = q.get('k').trim();
      } catch {
        if (m) { /* fallback pair order */ }
      }
      if (!code && m) {
        // pair order fallback: first attempt assumed email,code
        const a = decodeURIComponent(m[1] || ''), b = decodeURIComponent(m[2] || '');
        if (a.includes('@')) addr2 = a.toLowerCase();
        if (b.replace(/[^A-Z0-9]/gi, '').length >= 8) code = b.toUpperCase();
      }
      if (!code) { err.show('That QR code does not contain an unlock code.'); return; }
      if (!scannedToken) { err.show('That QR code is missing its verify invite. Use the latest email.'); return; }
      stopCamera();
      verify(addr2, code, { fromScan: true, token: scannedToken });
    }

    async function startCamera() {
      const ph = document.getElementById('lg-scan-placeholder');
      const video = document.getElementById('lg-scan-video');
      const scanBtn = document.getElementById('lg-scan-start');
      if (!video) return;
      err.clear();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        err.show('This browser cannot open the camera. Type the code instead.');
        switchTab('code');
        return;
      }
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch {
        err.show('Camera access was denied. Allow the camera, or type the code instead.');
        switchTab('code');
        return;
      }
      video.srcObject = cameraStream;
      await video.play().catch(() => {});
      if (ph) ph.classList.add('lg-hidden');
      if (scanBtn) scanBtn.classList.add('lg-hidden');
      if (scanLoop) clearInterval(scanLoop);
      scanLoop = setInterval(async () => {
        if (!cameraStream) return;
        try {
          const text = await decodeFrame(video);
          if (text) onQrDecoded(text);
        } catch { /* keep scanning */ }
      }, 350);
    }

    const scanPane = h('div', { class: 'lg-pane' },
      h('div', { class: 'lg-scan-box' },
        h('video', { id: 'lg-scan-video', class: 'lg-scan-video', playsinline: '', muted: '', autoplay: '' }),
        h('div', { id: 'lg-scan-placeholder', class: 'lg-scan-placeholder' }, fa('qrcode')),
        h('p', { class: 'lg-hint' }, 'Point your camera at the QR code in your email.'),
      ),
      h('button', { id: 'lg-scan-start', type: 'button', class: 'lg-btn', onclick: startCamera }, 'Open camera & scan'),
    );

    const codePane = h('div', { class: 'lg-pane lg-hidden' },
      h('form', {
        class: 'lg-form',
        onsubmit: (e) => {
          e.preventDefault();
          verify(email.value.trim().toLowerCase(), codeInput.value);
        },
      },
        field({ label: 'Email', icon: 'user', input: email }),
        h('div', { class: 'lg-field' },
          h('label', { class: 'lg-label' }, 'Unlock code'),
          buildCells(),
        ),
        codeInput,
        notice,
        submit,
      ),
    );

    const tabScan = h('button', { type: 'button', class: 'lg-utab is-active', onclick: () => switchTab('scan') }, fa('qrcode'), h('span', {}, 'Scan QR code'));
    const tabCode = h('button', { type: 'button', class: 'lg-utab', onclick: () => switchTab('code') }, fa('keyboard'), h('span', {}, 'Type code'));

    function switchTab(which) {
      stopCamera();
      tabScan.classList.toggle('is-active', which === 'scan');
      tabCode.classList.toggle('is-active', which === 'code');
      scanPane.classList.toggle('lg-hidden', which !== 'scan');
      codePane.classList.toggle('lg-hidden', which !== 'code');
      err.clear();
      if (which === 'scan') {
        const startBtn = document.getElementById('lg-scan-start');
        if (startBtn) startBtn.classList.remove('lg-hidden');
      } else {
        setTimeout(() => (email.readOnly ? codeInput : email).focus(), 80);
      }
    }

    const form = h('div', { class: 'lg-form lg-verify' },
      h('p', { class: 'lg-eyebrow lg-center' }, 'Account security'),
      h('div', { class: 'lg-locked-icon' }, fa('user-shield')),
      h('h2', { class: 'lg-title lg-center' }, 'Verify it\u2019s you'),
      h('p', { class: 'lg-lead lg-center' }, 'Your account was locked. Verify your identity to unlock it', prefillEmail ? h('strong', {}, ` — ${prefillEmail}`) : '.'),
      h('div', { class: 'lg-utabs' }, tabScan, tabCode),
      err.el,
      scanPane,
      codePane,
      h('div', { class: 'lg-row' },
        h('button', { type: 'button', class: 'lg-link lg-inline', onclick: () => { stopCamera(); stepTo(() => renderCredentials(prefillEmail)); } }, '← Back to sign in'),
        authGwAvailable() ? sendNewCodeButton(prefillEmail, err, notice) : h('span'),
      ),
    );
    card.appendChild(form);

    // Arrived from the QR/email link with the code included: verify immediately.
    if (linkedCode && prefillEmail) {
      switchTab('code');
      applyCodeValue(linkedCode.replace(/-/g, ''));
      setTimeout(() => verify(prefillEmail, codeInput.value), 350);
      return () => {};
    }
    // Otherwise open on the scan tab (falls back to typing in any error case).
    return () => { switchTab('scan'); };
  }

  let lastUnlockEmail = '';
  function authGwAvailable() {
    return Boolean(window.OSAS && window.OSAS.AUTH_FN_URL);
  }
  function sendNewCodeButton(addr, err, notice) {
    const btn = h('button', {
      type: 'button', class: 'lg-link lg-inline',
      onclick: async (e) => {
        const b = e.currentTarget;
        const em = document.querySelector('#login-overlay .lg-pane:not(.lg-hidden) input[type="email"], #login-overlay input[type="email"]');
        const addr2 = em ? em.value.trim().toLowerCase() : (lastUnlockEmail || '');
        if (!addr2) { err.show('Enter the email of the locked account first.'); return; }
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

  function openPasswordStep(email, resetToken) {
    stopTimers();
    card.innerHTML = '';
    const err = mkErr();
    const notice = h('p', { class: 'lg-notice lg-hidden', role: 'status' });

    const password = h('input', { type: 'password', class: 'lg-input', placeholder: 'New password (min. 8 characters)', autocomplete: 'new-password', required: true, minlength: '8' });
    const confirm = h('input', { type: 'password', class: 'lg-input', placeholder: 'Re-enter new password', autocomplete: 'new-password', required: true, minlength: '8' });
    const checklist = passwordChecklist(password);
    const submit = h('button', { type: 'submit', class: 'lg-btn' }, 'Update password & sign in');

    const form = h('form', {
      class: 'lg-form lg-pwstep',
      onsubmit: async (e) => {
        e.preventDefault();
        err.clear();
        if (!resetToken) { err.show('Your unlock session is no longer valid. Start again from the email link.'); return; }
        if (!authGwAvailable()) { err.show('The unlock service is not available right now. Please contact the OSAS office.'); return; }
        const unmet = checklist.firstUnmet();
        if (unmet) { err.show(unmet + '.'); password.focus(); return; }
        if (password.value !== confirm.value) { err.show('The two passwords do not match.'); return; }
        submit.disabled = true; submit.classList.add('is-loading'); submit.textContent = 'Updating…';
        try {
          await auth.changePasswordAfterUnlock(resetToken, password.value);
          notice.textContent = 'Password updated! Taking you to sign in…';
          notice.classList.remove('lg-hidden');
          err.clear();
          setTimeout(() => stepTo(() => renderCredentials(email, 'Password changed. Sign in with your new password.')), 1200);
        } catch (ex) {
          err.show(ex.message || 'Could not set the new password.');
          submit.disabled = false; submit.classList.remove('is-loading'); submit.textContent = 'Update password';
        }
      },
    },
      h('p', { class: 'lg-eyebrow lg-center' }, 'You’re in'),
      h('div', { class: 'lg-locked-icon lg-pwstep-icon' }, fa('circle-check')),
      h('h2', { class: 'lg-title lg-center' }, 'Change your password?'),
      h('p', { class: 'lg-lead lg-center' }, 'Your account is unlocked. Want to set a new password now, or keep your current one and sign in?'),
      field({ label: 'New password', icon: 'lock', input: password, trailing: eyeToggle([password, confirm]), extra: checklist.el }),
      field({ label: 'Confirm new password', icon: 'lock', input: confirm }),
      notice,
      err.el,
      submit,
      h('div', { class: 'lg-row lg-center' },
        h('button', {
          type: 'button', class: 'lg-link lg-inline',
          onclick: () => stepTo(() => renderCredentials(email, 'Account unlocked. Sign in to continue.')),
        }, 'Skip for now — sign in'),
      ),
    );
    card.appendChild(form);
    return () => password.focus({ preventScroll: true });
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
  // Email/QR deep-link: ".../#/unlock?email=..&code=.." opens the verify
  // screen and auto-verifies when the code is included (QR scan flow).
  const unlockHash = (location.hash || '').replace(/\/$/, '');
  if (/^#\/unlock/i.test(unlockHash)) {
    const q = new URLSearchParams(unlockHash.includes('?') ? unlockHash.slice(unlockHash.indexOf('?') + 1) : '');
    const deepEmail = (q.get('email') || '').toLowerCase();
    const deepCode = (q.get('code') || '').toUpperCase();
    const deepToken = (q.get('k') || '').trim();
    try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    stepTo(() => openUnlockScreen({ email: deepEmail, code: deepCode, k: deepToken }));
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
