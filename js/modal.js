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

  const loader = h('div', { class: 'flex flex-col items-center justify-center py-24 px-8 text-center transition-opacity duration-300' },
    h('div', { class: 'w-10 h-10 rounded-full border-2 border-pink-100 border-t-pink-500 animate-spin mb-4 shadow-[0_0_10px_rgba(236,72,153,0.2)]' }),
    h('span', { class: 'text-[10px] font-bold tracking-[0.2em] text-pink-500 uppercase mb-2' }, 'Please Wait'),
    h('p', { class: 'text-sm text-gray-500' }, 'Content is loading...')
  );

  spacer.appendChild(card);
  overlay.appendChild(spacer);
  
  // Start with loader
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
      card.removeChild(loader);
      
      // Make content fade in smoothly
      content.style.opacity = '0';
      content.style.transition = 'opacity 300ms ease-in';
      card.appendChild(content);
      
      // Force reflow
      void content.offsetWidth;
      content.style.opacity = '1';
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
