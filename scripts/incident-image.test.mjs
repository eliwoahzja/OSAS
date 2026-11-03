import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('incident reports accept one to eight images with removable previews', () => {
  const src = read('js/modules/incidents.js');
  assert.ok(src.includes('Attach incident images (required)'));
  assert.ok(src.includes('Attach at least one image before submitting your incident report.'));
  assert.ok(src.includes("type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, required: true"));
  assert.ok(src.includes('const MAX_INCIDENT_IMAGES = 8'));
  assert.ok(src.includes('selectedImages.push(file)'));
  assert.ok(src.includes('renderImagePreviews()'));
  assert.ok(src.includes('removeSelectedImage(file)'));
  assert.ok(src.includes('api.validateIncidentImage(file)'));
  assert.ok(src.includes("height: '112px'"));
  assert.ok(src.includes('URL.createObjectURL(file)'));
  assert.ok(src.includes('URL.revokeObjectURL(url)'));
});

test('all uploads finish before creating the incident and cleanup covers failures', () => {
  const src = read('js/modules/incidents.js');
  const upload = src.indexOf('uploadedPaths.push(await api.uploadIncidentEvidence(file))');
  const insert = src.indexOf("await api.insertRow('incidents'");
  assert.ok(upload >= 0 && insert > upload);
  assert.ok(src.includes('photo_path: uploadedPaths[0]'));
  assert.ok(src.includes('photo_paths: uploadedPaths'));
  assert.ok(src.includes('Promise.allSettled(uploadedPaths.map((path) => api.removeUnlinkedIncidentEvidence(path)))'));
  assert.ok(src.includes('description: f.description.trim(), reporter, status:'));
  assert.ok(src.includes("'Uploading image ' + (index + 1) + ' of ' + selectedImages.length"));
});

test('existing and new incident photo galleries can be opened', () => {
  const src = read('js/modules/incidents.js');
  assert.ok(src.includes("key: 'photo_paths', label: 'Photos'"));
  assert.ok(src.includes('incidentImagePaths(r)'));
  assert.ok(src.includes("record.photo_path"));
  assert.ok(src.includes('openIncidentImages(r)'));
  assert.ok(src.includes('Promise.allSettled(paths.map((path) => api.getIncidentEvidenceUrl(path)))'));
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

test('timestamp migration fixes the null date failure without trusting client clocks', () => {
  const src = read('supabase/migrations/20261103113000_restore_incident_timestamps_require_student_image.sql');
  assert.ok(src.includes('reported_at := statement_timestamp()'));
  assert.ok(src.includes("NEW.date := (reported_at AT TIME ZONE 'Asia/Manila')::date"));
  assert.ok(src.includes("NEW.time := to_char(reported_at AT TIME ZONE 'Asia/Manila'"));
  assert.ok(src.includes("NEW.date := OLD.date"));
  assert.ok(src.includes('incident_image_required_for_students'));
  assert.ok(src.includes('AS RESTRICTIVE FOR INSERT TO authenticated'));
  assert.ok(src.includes('OR photo_path IS NOT NULL'));
});

test('multi-photo migration preserves existing images and restricts new uploads', () => {
  const src = read('supabase/migrations/20261103121000_incident_multiple_images.sql');
  assert.ok(src.includes('ADD COLUMN IF NOT EXISTS photo_paths text[] NOT NULL'));
  assert.ok(src.includes('UPDATE public.incidents'));
  assert.ok(src.includes('ARRAY[photo_path]'));
  assert.ok(src.includes('CHECK (cardinality(photo_paths) <= 8)'));
  assert.ok(src.includes('incident_photo_paths_insert_owner'));
  assert.ok(src.includes('cardinality(photo_paths) BETWEEN 1 AND 8'));
  assert.ok(src.includes('photo_paths[1] = photo_path'));
  assert.ok(src.includes('unnest(photo_paths)'));
  assert.ok(src.includes("i.photo_paths @> ARRAY[objects.name]::text[]"));
});
