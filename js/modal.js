import { h } from './ui.js';

/**
 * Global accessible dialog / modal overlay.
 * 
 * WHY:
 * 1. Clamping max-h-[90vh] with overflow-y-auto ensures long incident/risk forms
 *    remain scrollable on 768px tablet screens without clipping submit buttons.
 * 2. Strict target check (e.target === overlay) prevents unintentional dismissals
 *    when users highlight text or drag their cursor outside input boxes.
 * 3. Removing keydown listener in close() avoids memory leaks across SPA navigation cycles.
 */
export function openModal(content) {
  const overlay = h('div', {
    class: 'fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4 overflow-y-auto',
    onclick: (e) => {
      // Only dismiss if user clicked the backdrop itself, not form controls inside
      if (e.target === overlay) close();
    },
  });

  const card = h('div', {
    class: 'bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto',
  });

  overlay.appendChild(card);
  card.appendChild(content);
  document.body.appendChild(overlay);

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  function close() {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  return { close };
}
