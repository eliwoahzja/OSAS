import { h } from './ui.js';

export function openModal(content) {
  const overlay = h('div', {
    class: 'fixed inset-0 z-[80] bg-black/60 overflow-y-auto opacity-0 transition-opacity duration-300',
  });
  const spacer = h('div', {
    class: 'min-h-full flex items-center justify-center p-4 sm:p-6 py-10',
    onclick: (e) => {
      if (e.target === spacer) close();
    },
  });

  const card = h('div', {
    class: 'bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-2xl opacity-0 scale-95 transition-all duration-300 relative',
  });

  spacer.appendChild(card);
  overlay.appendChild(spacer);
  card.appendChild(content);
  document.body.appendChild(overlay);

  // Trigger enter transition
  requestAnimationFrame(() => {
    overlay.classList.remove('opacity-0');
    card.classList.remove('opacity-0', 'scale-95');
    card.classList.add('opacity-100', 'scale-100');
  });

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  let isClosing = false;
  function close() {
    if (isClosing) return;
    isClosing = true;
    document.removeEventListener('keydown', onKey);
    
    overlay.classList.add('opacity-0');
    card.classList.remove('opacity-100', 'scale-100');
    card.classList.add('opacity-0', 'scale-95');
    
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }

  return { close };
}
