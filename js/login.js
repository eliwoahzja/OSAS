import { h } from './ui.js';
import * as auth from './auth.js';
import { passwordResetCall, readResetLink } from './password-reset.js';

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

export function showLogin({ onSuccess, onBack, recovery = auth.passwordRecovery() }) {
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

  function otpForm({ kind, email, eyebrow, title, lead, submitLabel, verify, resend, back, remember = false }) {
    const { EMAIL_OTP_MIN_LENGTH: OTP_MIN, EMAIL_OTP_MAX_LENGTH: OTP_MAX } = auth;
    const err = mkErr();
    const code = h('input', {
      type: 'text', class: 'lg-input lg-code', inputmode: 'numeric', autocomplete: 'one-time-code',
      maxlength: String(OTP_MAX), placeholder: '••••••', required: true, 'aria-label': 'Email verification code',
    });
    code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, OTP_MAX); err.clear(); });

    const submit = h('button', { type: 'submit', class: 'lg-btn' }, submitLabel);
    const resendBtn = h('button', { type: 'button', class: 'lg-link lg-inline', disabled: true }, '');
    const rememberDevice = remember ? h('label', { class: 'lg-remember' },
      h('input', { type: 'checkbox', class: 'lg-remember-input' }),
      h('span', { class: 'lg-remember-box', 'aria-hidden': 'true' }),
      h('span', {}, 'Remember this device for 30 days'),
    ) : null;

    let ticker = null;
    const stop = () => { if (ticker) { clearInterval(ticker); timers.delete(ticker); ticker = null; } };
    const tick = () => {
      const { until } = readCooldown(kind, email);
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      if (left > 0) {
        resendBtn.disabled = true;
        resendBtn.textContent = `Resend code in ${fmt(left)}`;
      } else {
        stop();
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend code';
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
        if (code.value.length < OTP_MIN || code.value.length > OTP_MAX || !/^\d+$/.test(code.value)) {
           err.show(`Enter the complete ${OTP_MIN}–${OTP_MAX}-digit code from your email. It expires in 10 minutes.`);
          return;
        }
        submit.disabled = true;
        submit.classList.add('is-loading');
        submit.textContent = 'Verifying…';
        try {
          await verify(code.value, Boolean(rememberDevice && rememberDevice.querySelector('input').checked));
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
      h('p', { class: 'lg-hint' }, 'Type the 6-digit code sent to your email. It expires in 10 minutes.'),
      err.el,
      rememberDevice,
      submit,
      h('div', { class: 'lg-row' },
        back ? h('button', { type: 'button', class: 'lg-link lg-inline', onclick: back.fn }, back.label) : h('span'),
        resendBtn,
      ),
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
      type: 'text', class: 'lg-input', placeholder: 's26XXXXXXX or you@example.com',
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
        let addr = '';
        try {
          // The server resolves the student ID to its saved verification email.
          addr = auth.accountAddress(email.value);
        } catch (bad) {
          err.show(bad.message || 'Enter your student ID or email.');
          return;
        }
        submit.disabled = true;
        submit.classList.add('is-loading');
        submit.textContent = 'Checking…';
        try {
          const r = await auth.signIn(addr, password.value);
          if (r.step === 'pin') {
            stepTo(() => renderPin(r.email));
          } else if (r.step === 'signed-in') {
            finish();
          } else {
            armCooldown('login', r.email);
            stepTo(() => renderOtp(r.email));
          }
        } catch (ex) {
          if (ex.unconfirmed) {
            const contact = addr || email.value.trim().toLowerCase();
            if (readCooldown('signup', contact).until <= Date.now()) {
              try { await auth.resendSignup(contact); armCooldown('signup', contact); } catch {}
            }
            openVerifyModal(contact);
          } else {
            err.show(ex.message || 'Sign-in failed.');
          }
          submit.disabled = false;
          submit.classList.remove('is-loading');
          submit.textContent = 'Sign In';
        }
      },
    },
      h('p', { class: 'lg-eyebrow' }, 'LOGIN'),
      h('h2', { class: 'lg-title' }, 'Welcome Back'),
      h('p', { class: 'lg-lead' }, 'Sign in to access the St. Agnes Academy OSAS Dashboard.'),
      field({ label: 'Student ID', icon: 'id-card', input: email }),
      field({ label: 'Password', icon: 'lock', input: password, trailing: eyeToggle([password]) }),
      h('button', { type: 'button', class: 'lg-link', onclick: () => stepTo(() => renderForgotPassword(email.value)) }, 'Forgot password?'),
      notice,
      err.el,
      submit,
      h('p', { class: 'lg-hint' }, 'An OTP will be sent to your email shortly after you login.'),
    );
    card.appendChild(form);
    return () => (prefillEmail ? password : email).focus({ preventScroll: true });
  }

  function renderForgotPassword(prefillEmail = '', errorText = '') {
    stopTimers();
    card.innerHTML = '';
    const err = mkErr();
    if (errorText) err.show(errorText, { quiet: true });
    const email = h('input', {
      type: 'text', class: 'lg-input', placeholder: 's260000001 or you@example.com',
      autocomplete: 'username', required: true, value: prefillEmail,
    });
    const notice = h('p', { class: 'lg-notice lg-hidden', role: 'status' });
    const submit = h('button', { type: 'submit', class: 'lg-btn' }, 'Send Reset Link');
    const form = h('form', {
      class: 'lg-form',
      onsubmit: async (e) => {
        e.preventDefault();
        err.clear();
        let contact = '';
        try { contact = auth.accountAddress(email.value); }
        catch (bad) { err.show(bad.message || 'Enter your student ID or email.'); email.focus(); return; }
        const wait = Math.ceil((readCooldown('recovery', contact).until - Date.now()) / 1000);
        if (wait > 0) { err.show(`Please wait ${fmt(wait)} before requesting another link.`); return; }
        submit.disabled = true;
        submit.textContent = 'Sending…';
        try {
          await auth.requestPasswordReset(contact);
          armCooldown('recovery', contact);
          notice.textContent = 'If this account exists, a password reset link has been sent. Check your inbox and spam folder.';
          notice.classList.remove('lg-hidden');
        } catch (error) {
          err.show(error.message || 'Could not send the reset email.');
        } finally {
          submit.disabled = false;
          submit.textContent = 'Send Reset Link';
        }
      },
    },
      h('p', { class: 'lg-eyebrow' }, 'Account recovery'),
      h('h2', { class: 'lg-title' }, 'Forgot Password'),
      h('p', { class: 'lg-lead' }, 'Enter your student ID or email. The reset link goes to that account\u2019s saved email address.'),
      field({ label: 'Student ID', icon: 'envelope', input: email }),
      notice,
      err.el,
      submit,
      h('button', { type: 'button', class: 'lg-link', onclick: async () => {
        try { await auth.cancelPasswordRecovery(); stepTo(() => renderCredentials(email.value)); }
        catch (error) { err.show(error.message); }
      } }, '← Back to sign in'),
    );
    card.appendChild(form);
    return () => email.focus({ preventScroll: true });
  }

  function renderResetPassword(addr) {
    stopTimers();
    card.innerHTML = '';
    const err = mkErr();
    const password = h('input', { type: 'password', class: 'lg-input', placeholder: 'New password', autocomplete: 'new-password', required: true, minlength: '8' });
    const confirm = h('input', { type: 'password', class: 'lg-input', placeholder: 'Re-enter password', autocomplete: 'new-password', required: true, minlength: '8' });
    const checklist = passwordChecklist(password);
    const submit = h('button', { type: 'submit', class: 'lg-btn' }, 'Save New Password');
    const form = h('form', {
      class: 'lg-form',
      onsubmit: async (e) => {
        e.preventDefault();
        err.clear();
        const unmet = checklist.firstUnmet();
        if (unmet) { err.show(unmet + '.'); password.focus(); return; }
        if (password.value !== confirm.value) { err.show('The two passwords do not match.'); confirm.focus(); return; }
        submit.disabled = true;
        submit.textContent = 'Saving…';
        try {
          await auth.updateRecoveredPassword(password.value);
          stepTo(() => renderCredentials(addr, 'Password updated. Sign in with your new password to continue.'));
        } catch (error) {
          err.show(error.message || 'Could not update your password.');
          submit.disabled = false;
          submit.textContent = 'Save New Password';
        }
      },
    },
      h('p', { class: 'lg-eyebrow' }, 'Account recovery'),
      h('h2', { class: 'lg-title' }, 'Choose a New Password'),
      h('p', { class: 'lg-lead' }, 'Set a new password for ', h('strong', {}, addr)),
      field({ label: 'New password', icon: 'lock', input: password, trailing: eyeToggle([password, confirm]), extra: checklist.el }),
      field({ label: 'Confirm password', icon: 'lock', input: confirm }),
      err.el,
      submit,
      h('button', { type: 'button', class: 'lg-link', onclick: async () => {
        try { await auth.cancelPasswordRecovery(); stepTo(() => renderCredentials(addr)); }
        catch (error) { err.show(error.message); }
      } }, '← Cancel and sign in'),
    );
    card.appendChild(form);
    return () => password.focus({ preventScroll: true });
  }

  function renderNewPassword(reset) {
    stopTimers(); card.replaceChildren();
    const err = mkErr();
    const back = h('button', { type: 'button', class: 'lg-link', onclick: () => stepTo(() => renderForgotPassword()) }, 'Request a new reset link');
    if (!/^[a-f0-9-]{36}$/i.test(reset.id) || !/^[a-f0-9]{64}$/.test(reset.token)) {
      card.append(h('div', { class: 'lg-form' }, h('h2', { class: 'lg-title' }, 'Reset link unavailable'), h('p', { class: 'lg-lead' }, 'Open the complete link from your approval email, or request a new one.'), back));
      return () => back.focus();
    }
    const password = h('input', { type: 'password', 'aria-label': 'New password', class: 'lg-input', required: true, minlength: '8', maxlength: '128', autocomplete: 'new-password' });
    const confirm = h('input', { type: 'password', 'aria-label': 'Confirm new password', class: 'lg-input', required: true, minlength: '8', maxlength: '128', autocomplete: 'new-password' });
    const save = h('button', { type: 'submit', class: 'lg-btn' }, 'Save new password');
    const form = h('form', { class: 'lg-form', onsubmit: async (event) => {
      event.preventDefault(); err.clear();
      if (password.value !== confirm.value) { err.show('The two passwords do not match.'); return; }
      save.disabled = true; save.textContent = 'Saving…';
      try {
        const data = await passwordResetCall({ action: 'complete', id: reset.id, token: reset.token, password: password.value });
        password.value = ''; confirm.value = ''; reset.token = '';
        await auth.signOut();
        history.replaceState(null, '', location.pathname + location.search + '#/dashboard');
        renderCredentials(data.student_id || '', data.message)();
      } catch (error) { err.show(error.message); save.disabled = false; save.textContent = 'Save new password'; }
    } }, h('p', { class: 'lg-eyebrow' }, 'Approved account request'),
    h('h2', { class: 'lg-title' }, 'Choose a new password'),
    h('p', { class: 'lg-lead' }, 'This link expires 30 minutes after approval and works once.'),
    field({ label: 'New password', icon: 'lock', input: password, trailing: eyeToggle([password, confirm]) }),
    field({ label: 'Confirm new password', icon: 'lock', input: confirm }), err.el, save, back);
    card.appendChild(form);
    return () => password.focus({ preventScroll: true });
  }

  function renderPin(addr) {
    stopTimers();
    card.innerHTML = '';
    const LEN = 4;
    let value = '';
    let busy = false;

    const err = mkErr();
    const dots = Array.from({ length: LEN }, () => h('span', { class: 'lg-pin-dot' }));
    const dotRow = h('div', { class: 'lg-pin-dots', role: 'status', 'aria-live': 'polite', 'aria-label': 'PIN entry' }, dots);
    const scan = h('div', { class: 'lg-pin-scan' }, h('span', { class: 'lg-pin-ring' }), h('span', { class: 'lg-pin-ring lg-pin-ring-2' }), fa('lock'));

    const paint = () => dots.forEach((d, i) => d.classList.toggle('is-filled', i < value.length));

    async function submitPin() {
      busy = true;
      try {
        await auth.verifyPin(value);
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
        busy = false;
        err.show(ex.message || 'Could not verify the PIN.');
        if (/expired/i.test(ex.message || '')) setTimeout(() => stepTo(() => renderCredentials(addr)), 1200);
      }
    }

    function press(d) {
      if (busy || value.length >= LEN) return;
      err.clear();
      value += d;
      paint();
      if (value.length === LEN) submitPin();
    }
    function back() {
      if (busy || !value) return;
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
    return () => {};
  }

  function renderOtp(addr) {
    stopTimers();
    card.innerHTML = '';
    const otp = otpForm({
      kind: 'login', email: addr,
      eyebrow: 'Two-step verification', title: 'Check your email',
      lead: 'We sent a verification code to', submitLabel: 'Verify & Sign In',
      remember: true,
      verify: async (code, shouldRemember) => { await auth.verifyCode(addr, code); if (shouldRemember) auth.rememberDevice(addr); finish(); },
      resend: () => auth.sendCode(addr),
      back: { label: '← Use a different account', fn: () => stepTo(() => renderCredentials(addr)) },
    });
    card.appendChild(otp.form);
    return () => otp.focus();
  }

  async function finish() {
    if (!reduceMotion()) {
      anim(card, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-14px) scale(.97)', opacity: 0 }], { duration: 380, easing: 'ease-in' });
      await done(anim(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: 'ease-in', delay: 120 }));
    }
    overlay.remove();
    document.documentElement.classList.remove('lg-open');
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
  const overlay = h('div', { id: 'login-overlay', class: `lg-root${onBack ? ' lg-with-return' : ''}` }, brand, side);
  const close = () => { stopTimers(); closeModal(true); overlay.remove(); document.documentElement.classList.remove('lg-open'); };
  if (onBack) overlay.append(h('button', { type: 'button', class: 'lg-public-return', onclick: () => { close(); onBack(); } }, fa('arrow-left'), 'Back to safety guide'));
  document.body.appendChild(overlay);
  document.documentElement.classList.add('lg-open');
  const reset = readResetLink();
  if (reset) history.replaceState(null, '', location.pathname + location.search + '#/reset-password');
  const focusFirst = recovery.active ? renderResetPassword(recovery.email)
    : recovery.error ? renderForgotPassword('', recovery.error)
    : reset ? renderNewPassword(reset) : renderCredentials();
  if (!reduceMotion()) {
    anim(brand, [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'none' }], { duration: 900, easing: EASE_OUT });
    [...brandInner.children].forEach((el, i) => {
      anim(el, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 250 + i * 90, easing: EASE_OUT });
    });
    anim(card, [{ opacity: 0, transform: 'translateY(32px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 150, easing: EASE_OUT });
    revealChildren(card.firstElementChild, { base: 350, step: 60 });
  }
  focusFirst();
  return close;
}
