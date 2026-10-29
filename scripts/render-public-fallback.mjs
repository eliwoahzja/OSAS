import { readFileSync, writeFileSync } from 'node:fs';
import { GUIDES, DRILLS, REMINDERS } from '../js/landing.js';
const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const list = (items) => `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
const source = (label, url) => `<p class="safety-source"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></p>`;
const html = `<noscript><div class="safety-landing"><header class="safety-container safety-header"><p>St. Agnes Academy<br>Office of Student Affairs &amp; Services</p></header><main class="safety-container"><section class="safety-hero"><h1>Campus safety guide.</h1><p class="safety-lead">Read the response steps before your next school drill.</p></section>
<section class="safety-section"><h2>Disaster response</h2>${GUIDES.map((g) => `<details class="safety-drill-entry"><summary><h3>${esc(g.title)}</h3></summary><p>${esc(g.summary)}</p>${g.stages.map(([stage, title, items]) => `<h3>${esc(stage)}: ${esc(title)}</h3>${list(items)}`).join('')}${source(g.source, g.url)}${g.extraSource ? source(...g.extraSource) : ''}</details>`).join('')}</section>
<section class="safety-section"><h2>Drills and evacuation</h2><p>Follow your teacher or marshal and the posted campus plan.</p>${DRILLS.map((d) => `<details class="safety-drill-entry"><summary><h3>${esc(d.title)}</h3></summary><ol>${d.entries.map(([title, text]) => `<li><strong>${esc(title)}</strong><p>${esc(text)}</p></li>`).join('')}</ol>${source(d.sourceLabel, d.sourceUrl)}</details>`).join('')}<p>For drill dates and your assigned assembly area, follow official school announcements and your classroom evacuation plan.</p></section>
<section class="safety-section safety-reminders"><h2>Readiness reminders</h2>${list(REMINDERS)}<p>Check the evacuation map posted in your classroom. Confirm the assembly area and any assistance arrangements with school staff.</p></section>
<section class="safety-section"><h2>Sign in to OSAS</h2><p>Enable JavaScript to sign in and use the dashboard. The safety information above is available without signing in.</p></section></main><footer class="safety-container safety-footer"><p>During an emergency, follow school marshals and local authorities.</p></footer></div></noscript>`;
const start = '<!-- public-safety-fallback:start -->'; const end = '<!-- public-safety-fallback:end -->';
const path = new URL('../index.html', import.meta.url);
let page = readFileSync(path, 'utf8');
if (page.includes(start)) page = page.slice(0, page.indexOf(start)) + start + '\n' + html + '\n' + page.slice(page.indexOf(end));
else page = page.replace('<body class="flex h-screen overflow-hidden">', `<body class="flex h-screen overflow-hidden">\n${start}\n${html}\n${end}`);
writeFileSync(path, page);
