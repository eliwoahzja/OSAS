import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMarkdownBlocks, renderMarkdownMessage } from '../js/agent-markdown.js';

class FakeNode {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this._text = ''; this.className = ''; }
  appendChild(node) { this.children.push(node); return node; }
  setAttribute(key, value) { this.attrs[key] = value; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
}

globalThis.document = {
  createElement: tag => new FakeNode(tag),
  createTextNode: text => { const n = new FakeNode('#text'); n.textContent = text; return n; },
};

const all = node => [node, ...node.children.flatMap(all)];

test('renders unlabeled AI records as structured fields', () => {
  const input = 'Student Record:\nName: Maria Cruz\nEmail: maria@school.edu.ph\nGrade: 11\nStatus: Active';
  const blocks = parseMarkdownBlocks(input);
  assert.deepEqual(blocks.map(x => x.type), ['section', 'fields']);
  assert.equal(blocks[1].items.length, 4);
  const dom = renderMarkdownMessage(input);
  assert.ok(all(dom).some(x => x.tag === 'dl' && x.className === 'agent-record-fields'));
  assert.equal(all(dom).filter(x => x.tag === 'dt').length, 4);
  assert.equal(all(dom).filter(x => x.tag === 'dd').length, 4);
  assert.ok(dom.textContent.includes('maria@school.edu.ph'));
});

test('preserves headings, numbered lists and separate paragraphs', () => {
  const input = '**Matching students**\n\n1. **Maria Cruz**\n2. **Ana Cruz**\n\nConfirm which student you mean.';
  const blocks = parseMarkdownBlocks(input);
  assert.deepEqual(blocks.map(x => x.type), ['section', 'list', 'paragraph']);
  const dom = renderMarkdownMessage(input);
  assert.ok(all(dom).some(x => x.tag === 'ol'));
  assert.ok(all(dom).some(x => x.tag === 'strong'));
  assert.equal(dom.children[0].className, 'agent-section-heading');
});

test('does not turn normal sentences or unfamiliar labels into record fields', () => {
  const input = 'Note: Check the student record before notifying a parent.';
  assert.deepEqual(parseMarkdownBlocks(input).map(x => x.type), ['paragraph']);
});

test('treats raw HTML from tool results as inert text', () => {
  const dom = renderMarkdownMessage('Name: <img src=x onerror=alert(1)>\nRole: client');
  assert.equal(all(dom).filter(x => x.tag === 'img').length, 0);
  assert.ok(dom.textContent.includes('<img src=x onerror=alert(1)>'));
});

test('keeps formatted replies without a branded response heading or divider', () => {
  const login = readFileSync(new URL('../js/login.js', import.meta.url), 'utf8');
  const agent = readFileSync(new URL('../js/agent.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/agent.css', import.meta.url), 'utf8');
  assert.ok(!login.includes('Students enter an emailed code. Administrators enter their PIN.'));
  assert.ok(!agent.includes('agent-reply-heading'));
  assert.ok(agent.includes('renderMarkdownMessage(content)'));
  assert.ok(agent.includes('animateFormattedReply'));
  assert.ok(css.includes('.agent-record-fields'));
  assert.ok(!css.includes('.agent-reply-heading'));
});
