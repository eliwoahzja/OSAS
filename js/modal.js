import { h } from './ui.js';
import { movePresence, reducedMotion } from './motion.js';
import { coverLoading } from './loading.js';

const stack = [];
let sequence = 0;
let background = [];

// Shared popup behavior for forms, viewers and confirmations.
export function openModal(content, options = {}) {
  const previousFocus = document.activeElement;
  const overlay = h('div', { class: 'osas-modal-overlay' });
  const card = h('div', { class: 'osas-modal-card', tabindex: '-1' }, content);
  const dialog = card;
  if (content.matches('[role="dialog"]')) {
    for (const name of ['aria-label','aria-labelledby']) if (content.hasAttribute(name)) card.setAttribute(name, content.getAttribute(name));
    content.removeAttribute('role'); content.removeAttribute('aria-modal'); content.removeAttribute('aria-labelledby');
  }
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
  let dirty = false;
  let confirmation = null;
  const loading = coverLoading(card, { kind: 'popup', fields: content.querySelectorAll('input,select,textarea').length || 3, label: 'Loading dialog', until: options.ready });
  const changed = event => {
    if (event.target.matches('input, select, textarea') && options.confirmDiscard !== false) dirty = true;
  };
  content.addEventListener('input', changed);
  content.addEventListener('change', changed);
  const beforeUnload = event => { if (dirty && !isClosing) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  content.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!dirty || !button || (!/^(cancel|close)$/i.test(button.textContent.trim()) && !button.querySelector('.fa-xmark, .fa-times'))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    requestClose(() => button.click());
  }, true);

  const focusable = () => [...dialog.querySelectorAll(
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )].filter(element => element.tabIndex >= 0 && !element.disabled && !element.closest('[inert]') && element.getClientRects().length);

  const onKey = event => {
    if (stack.at(-1) !== instance || isClosing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); requestClose(); }
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
  overlay.addEventListener('click', event => { if (event.target === overlay && stack.at(-1) === instance) requestClose(); });

  requestAnimationFrame(() => {
    if (isClosing) return;
    // Some viewers append their heading immediately after openModal returns.
    const heading = content.querySelector('h2, h3');
    content.querySelectorAll('label:not([for])').forEach(label => {
      const field = label.parentElement?.querySelector('input:not([type="checkbox"]):not([type="radio"]), select, textarea');
      if (!field || field.labels?.length) return;
      field.id ||= 'osas-dialog-field-' + (++sequence);
      label.htmlFor = field.id;
    });
    if (!dialog.hasAttribute('aria-labelledby') && heading) {
      heading.id ||= 'osas-dialog-title-' + (++sequence);
      dialog.setAttribute('aria-labelledby', heading.id);
    } else if (!heading && !dialog.hasAttribute('aria-label')) {
      dialog.setAttribute('aria-label', options.label || 'OSAS dialog');
    }
    const existingClose = content.querySelector('button:has(.fa-xmark), button:has(.fa-times)');
    if (existingClose) existingClose.setAttribute('aria-label', existingClose.getAttribute('aria-label') || 'Close dialog');
    const dismiss = h('button', {
      type: 'button', class: 'osas-modal-dismiss', 'aria-label': 'Close dialog', onclick: () => requestClose(),
    }, h('span', { 'aria-hidden': 'true' }, '×'));
    card.appendChild(dismiss);
    loading.ready.then(ready => {
      if (!ready || isClosing) return;
      if (existingClose) dismiss.remove();
      if (stack.at(-1) === instance) dialog.focus({ preventScroll: true });
    });
    overlay.classList.add('active');
    void movePresence(card, true);
    if (stack.at(-1) === instance && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
  });

  function requestClose(discard = close) {
    if (options.canClose?.() === false) { options.onDismissBlocked?.(); return; }
    if (!dirty) { discard(); return; }
    if (confirmation || isClosing) return;
    const body = h('div', { class: 'p-6 sm:p-8 space-y-4' },
      h('h3', {}, 'Discard unsaved changes?'),
      h('p', { class: 'text-sm text-gray-600' }, 'Your changes have not been saved. Keep editing to finish, or discard them to leave.'),
      h('div', { class: 'flex flex-wrap justify-end gap-3' },
        h('button', { type: 'button', class: 'btn-ghost', onclick: () => confirmation.close() }, 'Keep editing'),
        h('button', { type: 'button', class: 'btn-primary', onclick: () => {
          dirty = false; confirmation.close(); discard();
        } }, 'Discard changes')));
    confirmation = openModal(body, { onClose: () => { confirmation = null; } });
  }

  function close() {
    if (isClosing) return;
    isClosing = true;
    dirty = false;
    loading.clear();
    confirmation?.close();
    window.removeEventListener('beforeunload', beforeUnload);
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
      if (previousFocus?.isConnected && !previousFocus.closest('[inert], .is-closing')) previousFocus.focus({ preventScroll: true });
      else stack.at(-1)?.dialog.focus({ preventScroll: true });
    }
    try { options.onClose?.(); } catch {}
    if (reducedMotion()) overlay.remove();
    else void movePresence(card, false).finally(() => overlay.remove());
  }

  return { close, requestClose, ready: loading.ready };
}
