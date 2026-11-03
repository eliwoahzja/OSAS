// A small shared motion vocabulary. Nothing waits for an animation to accept input.
export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const MOTION = Object.freeze({ press: 100, enter: 260, exit: 160, content: 220, ease: 'cubic-bezier(.16,1,.3,1)' });
const running = new WeakMap();

export function revealContent(root) {
  if (!root?.isConnected || !root.animate || reducedMotion()) return;
  const targets = [...root.children].slice(0, 6);
  (targets.length ? targets : [root]).forEach((element, index) => {
    element.animate([{ opacity: .35, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: MOTION.content, delay: Math.min(index * 25, 100), easing: MOTION.ease });
  });
}

export function movePresence(element, visible, { distance = 12, scale = .985 } = {}) {
  if (!element?.animate || reducedMotion()) return Promise.resolve();
  const previous = running.get(element);
  const current = getComputedStyle(element);
  const from = previous ? { opacity: current.opacity, transform: current.transform } :
    visible ? { opacity: 0, transform: `translateY(${distance}px) scale(${scale})` } : { opacity: current.opacity, transform: current.transform };
  previous?.cancel();
  const animation = element.animate([from, visible ? { opacity: 1, transform: 'none' } :
    { opacity: 0, transform: `translateY(${distance}px) scale(${scale})` }],
    { duration: visible ? MOTION.enter : MOTION.exit, easing: visible ? MOTION.ease : 'cubic-bezier(.4,0,1,1)', fill: 'both' });
  running.set(element, animation);
  return animation.finished.catch(() => {}).then(() => {
    if (running.get(element) === animation) { running.delete(element); if (visible) animation.cancel(); }
  });
}
