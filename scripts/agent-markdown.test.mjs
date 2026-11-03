import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInlineMarkdown, parseMarkdownBlocks, renderMarkdownMessage } from '../js/agent-markdown.js';

class FakeNode {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this._text = ''; this.className = ''; }
  appendChild(node) { this.children.push(node); return node; }
  setAttribute(key, value) { this.attrs[key] = value; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
}
globalThis.document = {
  createElement: tag => new FakeNode(tag),
  createTextNode: value => { const node = new FakeNode('#text'); node.textContent = value; return node; },
};
const tags = node => [node.tag, ...node.children.flatMap(tags)];

test('formats numbered account lists with bold and inline code', () => {
  const tick = String.fromCharCode(96);
  const input = '6. **Student Name** (' + tick + 'student@example.edu.ph' + tick + ') — Role: ' + tick + 'client' + tick + '\n7. **Another Student**';
  const root = renderMarkdownMessage(input);
  assert.equal(root.children[0].tag, 'ol');
  assert.equal(root.children[0].start, 6);
  assert.ok(tags(root).includes('strong'));
  assert.ok(tags(root).includes('code'));
  assert.ok(root.textContent.includes('Student Name'));
  assert.ok(!root.textContent.includes('**'));
});

test('supports headings, bullets, quote, code block, and table', () => {
  const fence = String.fromCharCode(96).repeat(3);
  const source = '# Records\n\n- **First**\n- **Second**\n\n> Note\n\n' + fence + 'json\n{"ok":true}\n' + fence + '\n\n| Name | Role |\n| --- | --- |\n| E | Admin |';
  const blocks = parseMarkdownBlocks(source);
  assert.deepEqual(blocks.map(block => block.type), ['heading', 'list', 'quote', 'codeblock', 'table']);
  const root = renderMarkdownMessage(source);
  assert.ok(tags(root).includes('table'));
  assert.ok(tags(root).includes('pre'));
});

test('renders untrusted content as text instead of executable HTML', () => {
  const root = renderMarkdownMessage('# Test\n\n<script>alert(1)</script>\n\n**<img src=x onerror=alert(1)>**\n\n[javascript](javascript:alert(1))');
  assert.ok(!tags(root).includes('script'));
  assert.ok(!tags(root).includes('img'));
  assert.ok(!tags(root).includes('a'));
  assert.ok(root.textContent.includes('<script>alert(1)</script>'));
});

test('HTTPS links include safe attributes', () => {
  const link = renderMarkdownMessage('[OSAS](https://example.com/path)').children[0].children[0];
  assert.equal(link.tag, 'a');
  assert.equal(link.attrs.href, 'https://example.com/path');
  assert.equal(link.attrs.rel, 'noopener noreferrer');
});

test('plain greetings remain intact', () => {
  assert.deepEqual(parseInlineMarkdown('Hello!'), [{ type: 'text', text: 'Hello!' }]);
  assert.equal(renderMarkdownMessage('Hello!').textContent, 'Hello!');
});
