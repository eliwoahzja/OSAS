import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('incident report offers an optional image picker with validation and preview', () => {
  const src = read('js/modules/incidents.js');
  assert.ok(src.includes('Attach image (optional)'));
  assert.ok(src.includes("accept: 'image/jpeg,image/png,image/webp'"));
  assert.ok(src.includes('URL.createObjectURL(file)'));
  assert.ok(src.includes('URL.revokeObjectURL(previewUrl)'));
  assert.ok(src.includes("photo_path: uploadedPath"));
  assert.ok(src.includes('api.uploadIncidentEvidence(f.image)'));
});

test('report is created only after image upload and cleans up failed uploads', () => {
  const src = read('js/modules/incidents.js');
  const upload = src.indexOf('uploadedPath = await api.uploadIncidentEvidence(f.image)');
  const insert = src.indexOf("await api.insertRow('incidents'");
  assert.ok(upload >= 0 && insert > upload);
  assert.ok(src.includes('await api.removeUnlinkedIncidentEvidence(uploadedPath)'));
  assert.ok(src.includes('photo_path: uploadedPath'));
  assert.ok(src.includes('description: f.description.trim(), reporter, status:'));
});

test('saved report photos are accessible from incident listing', () => {
  const src = read('js/modules/incidents.js');
  assert.ok(src.includes("key: 'photo_path', label: 'Photo'"));
  assert.ok(src.includes('openIncidentImage(r)'));
  assert.ok(src.includes('api.getIncidentEvidenceUrl(record.photo_path)'));
});

test('storage paths use random IDs and private URLs rather than public objects', () => {
  const src = read('js/api.js');
  assert.ok(src.includes("const INCIDENT_EVIDENCE_BUCKET = 'incident-evidence'"));
  assert.ok(src.includes('const INCIDENT_IMAGE_LIMIT = 5 * 1024 * 1024'));
  assert.ok(src.includes('crypto.randomUUID()'));
  assert.ok(src.includes("operation = 'object'"));
  assert.ok(src.includes("incidentEvidenceUrl(path, 'object/sign')"));
  assert.ok(src.includes('expiresIn: 120'));
});

test('migration limits deletion to admins and incident images to private signed-in accounts', () => {
  const src = read('supabase/migrations/20261103110000_drills_delete_and_incident_evidence.sql');
  assert.ok(src.includes('FOR DELETE TO authenticated'));
  assert.ok(src.includes('USING ((SELECT public.is_admin()))'));
  assert.ok(src.includes("VALUES ('incident-evidence', 'incident-evidence', false, 5242880"));
  assert.ok(src.includes('incident_evidence_insert_own'));
  assert.ok(src.includes('incident_evidence_read_authorized'));
  assert.ok(src.includes('incident_evidence_delete_unlinked'));
  assert.ok(src.includes('incident_photo_path_insert_owner'));
  assert.ok(src.includes('AS RESTRICTIVE FOR INSERT TO authenticated'));
});
