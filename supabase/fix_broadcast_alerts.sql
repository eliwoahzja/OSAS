ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_incident_alert;
ALTER TABLE notifications ADD CONSTRAINT chk_incident_alert CHECK (
    notif_type <> 'incident_alert'
    OR (priority = 'urgent' AND contact_method = 'email'
        AND (student_id IS NOT NULL OR audience_group = 'All Parents & Guardians'))
);
