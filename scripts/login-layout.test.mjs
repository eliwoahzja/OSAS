import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL('../' + relative, import.meta.url), 'utf8');

test('login branding has distinct selectors and remains in its own column', () => {
  const login = read('js/login.js');
  const style = read('css/login.css');
  assert.ok(login.includes("class: 'lg-brand-seal'"));
  assert.ok(login.includes("class: 'lg-brand-wordmark'"));
  assert.ok(login.includes("class: 'lg-brand-contacts'"));
  assert.ok(!login.includes("class: 'safety-hero-seal'"));
  assert.ok(!login.includes("class: 'safety-hero-contacts lg-brand-contacts'"));
  assert.match(style, /#login-overlay\.lg-root\s*\{[^}]*display:\s*grid;/);
  assert.match(style, /#login-overlay \.lg-brand\s*\{[^}]*flex-direction:\s*column;/);
  assert.match(style, /#login-overlay \.lg-brand-seal\s*\{[^}]*position:\s*static;/);
  assert.match(style, /#login-overlay \.lg-brand-contacts\s*\{[^}]*display:\s*grid;/);
});

test('login overrides load after landing and preserve mobile layout', () => {
  const html = read('index.html');
  const style = read('css/login.css');
  assert.ok(html.indexOf('href="/css/landing.css"') < html.indexOf('href="/css/login.css"'));
  assert.ok(style.includes('@media (max-width: 900px)'));
  assert.ok(style.includes('@media (max-width: 480px)'));
  assert.ok(style.includes('overflow-wrap: anywhere;'));
});

test('decorative hero stripes are scoped and reversed without affecting login', () => {
  const landing = read('css/landing.css');
  assert.match(landing, /\.safety-landing \.safety-hero-art::before\s*\{[^}]*linear-gradient\(70deg/);
  assert.match(landing, /\.safety-landing \.safety-hero-art > \.safety-hero-seal\s*\{/);
  assert.ok(!/^\\.safety-hero-seal\\s*\\{/m.test(landing));
});
