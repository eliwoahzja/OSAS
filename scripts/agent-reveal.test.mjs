import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { animateFormattedReply, revealDuration } from '../js/agent-reveal.js';

function richTree() {
  const plain = { nodeType: 3, nodeValue: 'Hello ' };
  const bold = { nodeType: 3, nodeValue: 'Student!' };
  const strong = { nodeType: 1, childNodes: [bold], tagName: 'STRONG' };
  const para = { nodeType: 1, childNodes: [plain, strong], tagName: 'P' };
  const root = { nodeType: 1, childNodes: [para] };
  return { root, plain, bold, strong };
}

test('fast replies reveal formatted text in place, without rebuilding DOM nodes', () => {
  const { root, plain, bold, strong } = richTree();
  const tasks = new Map();
  let seq = 0;
  const priorRAF = globalThis.requestAnimationFrame;
  const priorCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = fn => { const id = ++seq; tasks.set(id, fn); return id; };
  globalThis.cancelAnimationFrame = id => tasks.delete(id);
  const tick = timestamp => {
    const [id, callback] = tasks.entries().next().value;
    tasks.delete(id);
    callback(timestamp);
  };
  try {
    const cancel = animateFormattedReply(root, { reducedMotion: false });
    assert.equal(plain.nodeValue, '');
    assert.equal(bold.nodeValue, '');
    assert.strictEqual(root.childNodes[0].childNodes[1], strong);
    tick(0);
    assert.ok(plain.nodeValue.length > 0);
    assert.equal(bold.nodeValue, '');
    tick(revealDuration(14) / 2);
    assert.ok(plain.nodeValue.length > 0);
    tick(revealDuration(14));
    assert.equal(plain.nodeValue, 'Hello ');
    assert.equal(bold.nodeValue, 'Student!');
    assert.equal(tasks.size, 0);
    cancel();
  } finally {
    globalThis.requestAnimationFrame = priorRAF;
    globalThis.cancelAnimationFrame = priorCancel;
  }
});

test('honors reduced motion and responds immediately', () => {
  const { root, plain, bold } = richTree();
  animateFormattedReply(root, { reducedMotion: true });
  assert.equal(plain.nodeValue, 'Hello ');
  assert.equal(bold.nodeValue, 'Student!');
});

test('short and lengthy messages remain quick', () => {
  assert.ok(revealDuration(10) >= 100);
  assert.ok(revealDuration(2000) <= 1500);
});

test('launcher is icon-only and student chatbot remains mounted without admin tool access', () => {
  const agent = readFileSync(new URL('../js/agent.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/agent.css', import.meta.url), 'utf8');
  assert.ok(agent.includes("icon('comment-dots', 'text-xl')"));
  assert.ok(!agent.includes("h('span', { class: 'agent-fab-label' }"));
  assert.ok(agent.includes("if (!isSignedIn())"));
  assert.ok(agent.includes("if (!isAdmin()) {\n    const answer = studentNavigationAnswer(rawMessage);"));
  assert.ok(agent.includes("stopReplyReveal = animateFormattedReply"));
  assert.match(css, /\.agent-fab\s*\{[^}]*width:\s*52px;/);
  assert.match(css, /\.agent-fab\s*\{[^}]*border-radius:\s*50%;/);
});
