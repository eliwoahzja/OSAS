import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to escape HTML characters in email content
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emailRow(label, value) {
  return `<tr>
    <td style="padding:7px 12px 7px 0;font-size:12px;font-weight:600;color:#6b7280;vertical-align:top;width:150px">${label}</td>
    <td style="padding:7px 0;font-size:13px;font-weight:600;color:#111827;vertical-align:top">${value}</td>
  </tr>`;
}

function buildRestockEmailHtml({ items = [], roles = [], customMessage = '', sentDateFmt = '' }) {
  const itemRows = items.map((i) => {
    const deficit = Math.max(1, Number(i.reorder_threshold || 0) - Number(i.quantity || 0));
    return `
    <tr style="border-bottom:1px solid #f0eae0">
      <td style="padding:10px 12px;font-weight:600;color:#111827">${escapeHtml(i.item)}</td>
      <td style="padding:10px 12px;text-align:center;color:#b91c1c;font-weight:700">${escapeHtml(String(i.quantity))} left</td>
      <td style="padding:10px 12px;text-align:center;color:#4b5563">${escapeHtml(String(i.reorder_threshold))}</td>
      <td style="padding:10px 12px;text-align:center;color:#dc2626;font-weight:600">-${deficit} units</td>
      <td style="padding:10px 12px;color:#4b5563">${escapeHtml(i.location || 'Clinic Storage')}</td>
    </tr>`;
  }).join('');

  const rolesHtml = roles.map((r) =>
    `<span style="display:inline-block;padding:3px 8px;margin:2px 4px 2px 0;background:#fdf2f8;border:1px solid #fbcfe8;border-radius:6px;color:#831843;font-size:11px;font-weight:600">${escapeHtml(r)}</span>`
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAAC OSAS - Low First Aid Supply Alert</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f1ea;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:580px;background:#ffffff;border:1px solid #e7e0d4;border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.06)">
          <!-- SAAC Maroon Header -->
          <tr>
            <td style="background-color:#3A1024;padding:20px 24px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="48" valign="middle">
                    <img src="https://rwqaeabxusivkyjgskko.supabase.co/storage/v1/object/public/branding/logo.png" alt="SAAC Logo" width="42" height="42" style="display:block;border-radius:50%;background:#ffffff;padding:2px;border:1px solid #e9b9ca" />
                  </td>
                  <td valign="middle" style="padding-left:14px">
                    <div style="font-size:17px;font-weight:800;color:#ffffff;line-height:1.2">Saint Agnes Academy</div>
                    <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#e9b9ca;text-transform:uppercase;margin-top:2px">Office of Student Affairs and Services</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:24px">
              <div style="margin-bottom:16px">
                <span style="display:inline-block;padding:4px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:20px;color:#b91c1c;font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase">
                  URGENT INVENTORY ALERT
                </span>
              </div>

              <h2 style="margin:0 0 10px;font-size:19px;font-weight:800;color:#111827;line-height:1.3">
                First Aid Supplies Requiring Immediate Restock
              </h2>

              <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#4b5563">
                This automated priority alert notifies designated health and inventory custodians that <strong>${items.length}</strong> first aid supply ${items.length === 1 ? 'item has' : 'items have'} fallen to or below the mandatory safety threshold. Please initiate replenishment immediately.
              </p>

              <!-- Metadata Summary Table -->
              <table style="width:100%;border-collapse:collapse;margin:0 0 20px;padding:12px;background:#faf7f2;border:1px solid #f0eae0;border-radius:8px">
                ${emailRow('Assigned Handlers', rolesHtml)}
                ${emailRow('Alert Priority', '<span style="color:#b91c1c;font-weight:700">Urgent - Action Required</span>')}
                ${emailRow('Affected Items', `${items.length} supply items below reorder threshold`)}
                ${emailRow('Dispatch Date', sentDateFmt)}
              </table>

              ${customMessage ? `
              <div style="margin:0 0 20px;padding:12px 16px;background:#fdf2f8;border-left:4px solid #db2777;border-radius:6px">
                <div style="font-size:11px;font-weight:700;color:#9d174d;letter-spacing:0.5px;margin-bottom:4px">ADMINISTRATIVE DISPATCH REMARKS</div>
                <div style="font-size:13px;color:#374151;line-height:1.5">${escapeHtml(customMessage)}</div>
              </div>` : ''}

              <!-- Inventory Deficit Table -->
              <div style="margin:0 0 22px;border:1px solid #f0eae0;border-radius:10px;overflow:hidden">
                <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left">
                  <thead>
                    <tr style="background:#faf7f2;color:#4b5563;font-weight:700;border-bottom:1px solid #f0eae0">
                      <th style="padding:10px 12px">Supply Item</th>
                      <th style="padding:10px 12px;text-align:center">Stock Left</th>
                      <th style="padding:10px 12px;text-align:center">Threshold</th>
                      <th style="padding:10px 12px;text-align:center">Deficit</th>
                      <th style="padding:10px 12px">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemRows}
                  </tbody>
                </table>
              </div>

              <div style="padding:14px 16px;background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;font-size:12px;color:#92400e;line-height:1.5">
                <strong>Next Steps:</strong> The Supply Custodian and School Nurse should verify on-hand stocks, initiate purchase requisitions, and update the inventory module once new deliveries arrive.
              </div>
            </td>
          </tr>

          <!-- Footer matching parent notification design -->
          <tr>
            <td style="background-color:#faf7f2;padding:16px 24px;border-top:1px solid #eee6d9;text-align:center">
              <div style="font-size:11px;color:#6b7280;line-height:1.5">
                This is an official automated notification from Saint Agnes Academy Office of Student Affairs and Services (OSAS).<br>
                For questions regarding clinic stock or procurement, please coordinate with the OSAS Safety & Compliance Unit.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Low-stock notifications dispatch endpoint
app.post('/api/notify-stock', async (req, res) => {
  try {
    const { items = [], recipientRoles = [], customMessage = '' } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'No low-stock items provided.' });
    }

    const defaultRoles = [
      'School Nurse (Clinic In-Charge & Student Care)',
      'Clinic Supply & Inventory Custodian (OSAS Logistics)',
    ];
    const roles = recipientRoles.length > 0 ? recipientRoles : defaultRoles;
    const recipients = ['nurse@saac.edu.ph', 'supplies@saac.edu.ph'];

    const now = new Date();
    const sentDateFmt = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const subject = `[URGENT RESTOCK] Low First Aid Supply Alert - ${items.length} ${
      items.length === 1 ? 'item needs' : 'items need'
    } restocking`;

    const emailHtml = buildRestockEmailHtml({
      items,
      roles,
      customMessage,
      sentDateFmt,
    });

    console.log(`[RESTOCK NOTIFY] Dispatched email alert for ${items.length} items to ${recipients.join(', ')}`);

    return res.json({
      ok: true,
      status: 'sent',
      provider: 'email-service',
      recipientRoles: roles,
      recipients,
      subject,
      itemCount: items.length,
      sent_at: now.toISOString(),
      sent_date_formatted: sentDateFmt,
      customMessage: customMessage || undefined,
    });
  } catch (err) {
    console.error('Failed to dispatch restock notification:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Internal notification error' });
  }
});

// Serve static assets from project directory
app.use(express.static(__dirname));

// Single Page Application route fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SAAC - OSAS Dashboard running at http://0.0.0.0:${PORT}`);
});

