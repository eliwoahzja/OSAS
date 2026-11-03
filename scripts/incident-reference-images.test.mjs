import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('js/modules/incidents.js');
const index = read('index.html');

test('the incident list labels photos consistently without wrapping', () => {
  assert.ok(source.includes("key: 'photo_paths', label: 'Photos'"));
  assert.ok(source.includes("total + ' image' + (total === 1 ? '' : 's')"));
  assert.ok(source.includes('btn-ghost text-xs whitespace-nowrap'));
  assert.ok(source.includes('incidentImagePaths(r)'));
  assert.ok(source.includes('incidentReferenceImages(r)'));
});

test('reference illustrations remain distinguishable from student evidence', () => {
  assert.ok(source.includes('incidentReferenceImages(record)'));
  assert.ok(source.includes('record.reference_images'));
  assert.ok(source.includes('not photographic evidence from these incidents'));
  assert.ok(source.includes('Illustration, not original evidence'));
  assert.ok(source.includes('Source: Wikimedia Commons'));
  assert.ok(source.includes("key: 'photo_paths', label: 'Photos'"));
  assert.ok(source.includes('Promise.allSettled(paths.map((path) => api.getIncidentEvidenceUrl(path)))'));
});

test('Wikimedia images are allowed by CSP and have a source fallback', () => {
  assert.match(index, /img-src[^;]*https:\/\/commons\.wikimedia\.org https:\/\/upload\.wikimedia\.org;/);
  assert.ok(source.includes("image.hostname === 'commons.wikimedia.org'"));
  assert.ok(source.includes("image.pathname.startsWith('/wiki/Special:FilePath/')"));
  assert.ok(source.includes("source.hostname === 'commons.wikimedia.org'"));
  assert.ok(source.includes("source.pathname.startsWith('/wiki/File:')"));
  assert.ok(source.includes('baseUrl = entry.url.split(\'?\')[0]'));
  assert.ok(source.includes("onerror: () =>"));
  assert.ok(source.includes('Image unavailable. Open the source'));
});
