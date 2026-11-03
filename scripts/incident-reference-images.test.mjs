import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/modules/incidents.js', import.meta.url), 'utf8');

test('reference illustrations are differentiated from evidence images', () => {
  assert.ok(source.includes('incidentReferenceImages(record)'));
  assert.ok(source.includes('record.reference_images'));
  assert.ok(source.includes('References do not constitute evidence') || source.includes('not photographic evidence from these incidents'));
  assert.ok(source.includes('Illustrative reference '));
  assert.ok(source.includes('Wikimedia Commons'));
  assert.ok(source.includes('references.length +'));
  assert.ok(source.includes("key: 'photo_paths', label: 'Photos'"));
  assert.ok(source.includes('Promise.allSettled(paths.map((path) => api.getIncidentEvidenceUrl(path)))'));
});

test('reference-image sources are restricted to trusted Wikimedia file URLs', () => {
  assert.ok(source.includes("image.hostname === 'commons.wikimedia.org'"));
  assert.ok(source.includes("image.pathname.startsWith('/wiki/Special:FilePath/')"));
  assert.ok(source.includes("source.hostname === 'commons.wikimedia.org'"));
  assert.ok(source.includes("source.pathname.startsWith('/wiki/File:')"));
});
