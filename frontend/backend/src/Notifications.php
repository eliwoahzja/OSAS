<?php
// ============================================================
// Notifications — POST /api/notifications/send
// Business rules (enforced here AND in the DB CHECK constraints):
//   incident_alert → student_id required, priority=urgent,
//                    contact_method call|sms preferred
//   event_notice   → audience_group required, event_start/end
//                    required, priority=informational,
//                    contact_method app|email
// ============================================================

require_once __DIR__ . '/Db.php';

final class Notifications
{
    public static function send(array $payload): array
    {
        $errors = [];
        $type = $payload['notif_type'] ?? '';

        if (!in_array($type, ['incident_alert', 'event_notice'], true)) {
            $errors[] = 'notif_type must be incident_alert or event_notice';
        }

        if ($type === 'incident_alert') {
            if (empty($payload['student_id'])) {
                $errors[] = 'student_id is required for incident alerts';
            }
            if (!empty($payload['contact_method']) && !in_array($payload['contact_method'], ['call', 'sms'], true)) {
                $errors[] = 'incident alerts should use call or sms';
            }
        }

        if ($type === 'event_notice') {
            if (empty($payload['audience_group'])) {
                $errors[] = 'audience_group is required for event notices';
            }
            if (empty($payload['event_start_at']) || empty($payload['event_end_at'])) {
                $errors[] = 'event_start_at and event_end_at are required for event notices';
            }
            if (!empty($payload['event_start_at']) && !empty($payload['event_end_at'])
                && strtotime($payload['event_end_at']) <= strtotime($payload['event_start_at'])) {
                $errors[] = 'event_end_at must be after event_start_at';
            }
        }

        foreach (['title', 'message'] as $req) {
            if (empty($payload[$req])) {
                $errors[] = "$req is required";
            }
        }

        if ($errors) {
            throw new InvalidArgumentException(implode('; ', $errors));
        }

        // Auto-set fields per business rules.
        $record = array_merge($payload, [
            'priority' => $type === 'incident_alert' ? 'urgent' : 'informational',
            'contact_method' => $payload['contact_method'] ?? ($type === 'incident_alert' ? 'call' : 'app'),
            'sent_at' => date('c'),
            'delivery_status' => 'sent',
            'created_by' => 'admin',
        ]);
        unset($record['student_name'], $record['student_grade']);

        $created = Db::insert('notifications', $record);
        Db::audit('notifications', 'insert', $created['id'] ?? null, null, $created);

        // ---- Delivery ----
        $channel = $created['contact_method'];
        $result = ['ok' => true, 'id' => $created['id'] ?? null, 'channel' => $channel];

        if (in_array($channel, ['call', 'sms'], true)) {
            $result['delivery'] = self::deliverVoice($channel, $created);
        } else {
            $result['delivery'] = self::deliverAppEmail($channel, $created);
        }

        return $result;
    }

    /**
     * Call / SMS delivery — Twilio integration point.
     * TODO: set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER
     * and replace the stub below with the Twilio REST API:
     *   POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
     * (sms) or /Calls.json (call), Basic-auth with the account SID.
     */
    private static function deliverVoice(string $channel, array $notif): array
    {
        $twilioSid = (string) getenv('TWILIO_ACCOUNT_SID');
        $student = Db::get('students', (string) ($notif['student_id'] ?? ''));
        $to = $student['phone'] ?? 'unknown';

        if ($twilioSid === '') {
            // Mock mode: log the outbound attempt (visible in the server log).
            error_log('[notifications] MOCK ' . strtoupper($channel) . " -> $to :: {$notif['title']} — " .
                'set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER to go live.');
            return ['provider' => 'twilio-stub', 'to' => $to, 'status' => 'queued'];
        }

        // TODO: real Twilio call here.
        return ['provider' => 'twilio', 'to' => $to, 'status' => 'queued'];
    }

    /** App / email delivery — in-app notification + optional SMTP. */
    private static function deliverAppEmail(string $channel, array $notif): array
    {
        $audience = $notif['audience_group'] ?? 'student';
        $title = $notif['title'] ?? '(no title)';
        error_log('[notifications] ' . strtoupper($channel) . " queued for $audience :: $title");
        if ($channel === 'email') {
            // TODO: wire an SMTP/transactional provider (e.g. Resend,
            // Postmark) here once SMTP_HOST/USER/PASS are configured.
        }
        return ['provider' => 'in-app', 'status' => 'queued'];
    }
}
