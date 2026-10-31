const INLINE = /\[([^\]\n]{1,180})\]\((https?:\/\/[^\s)]+)\)|\x60([^\x60\n]+)\x60|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_|~~([^~\n]+)~~/g;
const FENCE = /^ {0,3}(\x60{3,}|~{3,})([a-zA-Z0-9_+#.-]*)\s*$/;
const HEADING = /^ {0,3}(#{1,4})\s+(.+)$/;
const LIST = /^ {0,3}([-+*]|\d+[.)])\s+(.+)$/;
const QUOTE = /^ {0,3}>\s?(.*)$/;
const RULE = /^ {0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/;

export function parseInlineMarkdown(value) {
  const text = String(value ?? '');
  const tokens = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) tokens.push({ type: 'text', text: text.slice(last, match.index) });
    if (match[1] !== undefined) tokens.push({ type: 'link', text: match[1], href: match[2] });
    else if (match[3] !== undefined) tokens.push({ type: 'code', text: match[3] });
    else if (match[4] !== undefined || match[5] !== undefined) tokens.push({ type: 'strong', text: match[4] ?? match[5] });
    else if (match[6] !== undefined || match[7] !== undefined) tokens.push({ type: 'em', text: match[6] ?? match[7] });
    else if (match[8] !== undefined) tokens.push({ type: 'del', text: match[8] });
    last = match.index + match[0].length;
  }
  if (last < text.length || !tokens.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((item) => item.trim());
}

function isSeparator(line) {
  const columns = cells(line);
  return columns.length > 1 && columns.every((col) => /^:?-{3,}:?$/.test(col));
}

export function parseMarkdownBlocks(value) {
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const close = new RegExp('^ {0,3}' + (marker === '\x60' ? '\\x60' : '~') + '{' + fence[1].length + ',}\\s*$');
      const body = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) body.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push({ type: 'codeblock', language: fence[2], text: body.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].replace(/\s+#+\s*$/, '') });
      i++; continue;
    }
    if (RULE.test(line)) { blocks.push({ type: 'rule' }); i++; continue; }
    const list = LIST.exec(line);
    if (list) {
      const ordered = /\d/.test(list[1][0]);
      const start = ordered ? Number.parseInt(list[1], 10) : 1;
      const items = [];
      while (i < lines.length) {
        const match = LIST.exec(lines[i]);
        if (!match || /\d/.test(match[1][0]) !== ordered) break;
        const parts = [match[2]];
        i++;
        while (i < lines.length && /^ {2,}\S/.test(lines[i]) && !LIST.test(lines[i])) parts.push(lines[i++].trim());
        items.push(parts.join(' '));
      }
      blocks.push({ type: 'list', ordered, start, items });
      continue;
    }
    if (QUOTE.test(line)) {
      const parts = [];
      while (i < lines.length && QUOTE.test(lines[i])) parts.push(QUOTE.exec(lines[i++])[1]);
      blocks.push({ type: 'quote', text: parts.join('\n') });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const headers = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(cells(lines[i++]).slice(0, headers.length));
      blocks.push({ type: 'table', headers, rows });
      continue;
    }
    const parts = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !FENCE.test(lines[i]) && !HEADING.test(lines[i]) &&
      !RULE.test(lines[i]) && !LIST.test(lines[i]) && !QUOTE.test(lines[i])) {
      if (i + 1 < lines.length && lines[i].includes('|') && isSeparator(lines[i + 1])) break;
      parts.push(lines[i++].trim());
    }
    blocks.push({ type: 'paragraph', text: parts.join('\n') });
  }
  return blocks;
}

function appendInline(parent, text) {
  for (const token of parseInlineMarkdown(text)) {
    if (token.type === 'text') {
      const parts = token.text.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i) parent.appendChild(document.createElement('br'));
        if (parts[i]) parent.appendChild(document.createTextNode(parts[i]));
      }
      continue;
    }
    const type = token.type === 'strong' ? 'strong' : token.type === 'em' ? 'em' :
      token.type === 'del' ? 'del' : token.type === 'link' ? 'a' : 'code';
    const el = document.createElement(type);
    if (token.type === 'link') {
      el.setAttribute('href', token.href);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    el.textContent = token.text;
    parent.appendChild(el);
  }
}

export function renderMarkdownMessage(content) {
  const root = document.createElement('div');
  root.className = 'agent-rich-text';
  for (const block of parseMarkdownBlocks(content)) {
    let element;
    if (block.type === 'heading') {
      element = document.createElement('h' + block.level);
      appendInline(element, block.text);
    } else if (block.type === 'paragraph') {
      element = document.createElement('p');
      appendInline(element, block.text);
    } else if (block.type === 'quote') {
      element = document.createElement('blockquote');
      appendInline(element, block.text);
    } else if (block.type === 'rule') {
      element = document.createElement('hr');
    } else if (block.type === 'codeblock') {
      element = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = block.text;
      element.appendChild(code);
    } else if (block.type === 'list') {
      element = document.createElement(block.ordered ? 'ol' : 'ul');
      if (block.ordered && block.start !== 1) element.start = block.start;
      for (const item of block.items) {
        const li = document.createElement('li');
        appendInline(li, item);
        element.appendChild(li);
      }
    } else if (block.type === 'table') {
      element = document.createElement('div');
      element.className = 'agent-table-scroll';
      const table = document.createElement('table');
      const head = document.createElement('thead');
      const header = document.createElement('tr');
      for (const label of block.headers) {
        const th = document.createElement('th');
        appendInline(th, label);
        header.appendChild(th);
      }
      head.appendChild(header);
      table.appendChild(head);
      const body = document.createElement('tbody');
      for (const row of block.rows) {
        const tr = document.createElement('tr');
        for (let i = 0; i < block.headers.length; i++) {
          const td = document.createElement('td');
          appendInline(td, row[i] || '');
          tr.appendChild(td);
        }
        body.appendChild(tr);
      }
      table.appendChild(body);
      element.appendChild(table);
    }
    if (element) root.appendChild(element);
  }
  return root;
}
