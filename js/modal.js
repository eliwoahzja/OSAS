import { h } from './ui.js';

export function openModal(content) {
  const overlay = h('div', {
    class: 'fixed inset-0 z-[80] bg-black/60 overflow-y-auto opacity-0 transition-opacity duration-300',
  });
  const spacer = h('div', {
    class: 'min-h-screen flex items-center justify-center p-4 sm:p-6 py-10',
    onclick: (e) => {
      if (e.target === spacer) close();
    },
  });
  const card = h('div', {
    class: 'bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-2xl opacity-0 scale-95 transition-all duration-300 relative',
  });

  const loader = h('div', { class: 'absolute inset-0 z-50 rounded-3xl flex flex-col items-center justify-center bg-black/30 backdrop-blur-md transition-opacity duration-300 text-center' },
    h('div', { class: 'w-12 h-12 rounded-full border-[3px] border-white/40 border-t-white animate-spin mb-4 drop-shadow-md' }),
    h('span', { class: 'text-[11px] font-bold tracking-[0.2em] text-white uppercase mb-2 drop-shadow-md' }, 'Please Wait'),
    h('p', { class: 'text-sm text-white font-medium drop-shadow-md' }, 'Content is loading...')
  );

  spacer.appendChild(card);
  overlay.appendChild(spacer);
  
  // Start with content immediately, but overlaid with blur loader
  card.appendChild(content);
  card.appendChild(loader);
  
  document.body.appendChild(overlay);

  // Trigger enter transition
  requestAnimationFrame(() => {
    overlay.classList.remove('opacity-0');
    card.classList.remove('opacity-0', 'scale-95');
    card.classList.add('opacity-100', 'scale-100');
  });

  // Artificial delay to buy time / rate limit
  let isClosing = false;
  setTimeout(() => {
    if (isClosing) return;
    loader.classList.add('opacity-0');
    setTimeout(() => {
      if (isClosing) return;
      if (loader.parentNode === card) card.removeChild(loader);
    }, 300);
  }, 1200);

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

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
