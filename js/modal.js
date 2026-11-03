import { h } from './ui.js';

const stack = [];
let sequence = 0;
let background = [];

// Shared popup behavior for forms, viewers and confirmations.
export function openModal(content, options = {}) {
  const previousFocus = document.activeElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const overlay = h('div', { class: 'osas-modal-overlay' });
  const card = h('div', { class: 'osas-modal-card', tabindex: '-1' }, content);
  const dialog = content.matches('[role="dialog"]') ? content : card;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('tabindex', '-1');
  content.classList.add('osas-modal-content');
  overlay.appendChild(card);

  if (!stack.length) {
    background = [...document.querySelectorAll('#sidebar, #dashboard-shell, #public-safety, .agent-root')]
      .map(element => ({ element, inert: element.inert }));
    background.forEach(({ element }) => { element.inert = true; });
    document.documentElement.classList.add('osas-dialog-open');
  }
  stack.at(-1)?.dialog.setAttribute('inert', '');
  const instance = { dialog, close };
  stack.push(instance);
  overlay.style.zIndex = String(80 + stack.length);
  document.body.appendChild(overlay);
  let isClosing = false;

  const focusable = () => [...dialog.querySelectorAll(
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )].filter(element => element.tabIndex >= 0 && !element.disabled && !element.closest('[inert]') && element.getClientRects().length);

  const onKey = event => {
    if (stack.at(-1) !== instance || isClosing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const controls = focusable();
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); dialog.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', event => { if (event.target === overlay && stack.at(-1) === instance) close(); });

  requestAnimationFrame(() => {
    if (isClosing) return;
    // Some viewers append their heading immediately after openModal returns.
    const heading = content.querySelector('h2, h3');
    if (!dialog.hasAttribute('aria-labelledby') && heading) {
      heading.id ||= 'osas-dialog-title-' + (++sequence);
      dialog.setAttribute('aria-labelledby', heading.id);
    } else if (!heading && !dialog.hasAttribute('aria-label')) {
      dialog.setAttribute('aria-label', options.label || 'OSAS dialog');
    }
    overlay.classList.add('active');
    if (stack.at(-1) === instance && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
  });

  function close() {
    if (isClosing) return;
    isClosing = true;
    document.removeEventListener('keydown', onKey);
    const wasTop = stack.at(-1) === instance;
    stack.splice(stack.indexOf(instance), 1);
    stack.at(-1)?.dialog.removeAttribute('inert');
    overlay.classList.remove('active');
    overlay.classList.add('is-closing');
    if (!stack.length) {
      background.forEach(({ element, inert }) => { element.inert = inert; });
      background = [];
      document.documentElement.classList.remove('osas-dialog-open');
    }
    if (wasTop) {
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
      else stack.at(-1)?.dialog.focus({ preventScroll: true });
    }
    if (reduceMotion) overlay.remove();
    else setTimeout(() => overlay.remove(), 200);
  }

  return { close };
}
