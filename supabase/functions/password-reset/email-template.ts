// Same colors, typography, logo and card structure as templates/magic_link.html.
// bodyHtml is assembled from escaped values in core.ts, never raw user HTML.
export function accountEmail(bodyHtml: string, appUrl: string) {
  const logo = new URL('assets/logo.png', appUrl).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const content = bodyHtml
    .replace(/<h2>/g, '<h2 style="margin:10px 0 16px;font-size:26px;line-height:1.2;font-weight:800;color:#1B2236;">')
    .replace(/<p>/g, '<p style="margin:14px 0;font-size:15px;line-height:1.6;color:#4B5563;">')
    .replace(/<table>/g, '<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#FAF6F7;border:1px solid #EBD5DB;border-radius:12px;font-size:13px;">')
    .replace(/<a href=/g, '<a style="display:inline-block;padding:13px 20px;background:#7A1B38;color:#FFFFFF;text-decoration:none;border-radius:12px;font-weight:700;" href=');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:#F6F3EA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F6F3EA"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td bgcolor="#7A1B38" style="background:#7A1B38;background-image:linear-gradient(135deg,#1F2A4D 0%,#4A1F3D 40%,#7A1B38 100%);border-radius:24px 24px 0 0;padding:28px 36px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right:14px;"><img src="${logo}" width="44" height="44" alt="SAAC" style="display:block;width:44px;height:44px;border-radius:10px;background:#FFFFFF;padding:2px;"></td><td style="font-family:Arial,Helvetica,sans-serif;color:#FFFFFF;"><div style="font-size:18px;font-weight:800;line-height:1.2;">St. Agnes Academy</div><div style="font-size:12px;font-weight:700;color:#F8D98B;margin-top:2px;">Office of Student Affairs &amp; Services</div></td></tr></table></td></tr>
<tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:0 0 24px 24px;padding:36px;font-family:Arial,Helvetica,sans-serif;color:#1B2236;box-shadow:0 12px 32px rgba(60,30,40,.10);">
<div style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#7A1B38;">Account requests</div>
${content}
<hr style="border:0;border-top:1px solid #EEE7E9;margin:28px 0 18px;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#9CA3AF;">Sent by the OSAS Dashboard of Saint Agnes Academy. Please use the school's official channels for assistance.</p>
</td></tr></table></td></tr></table></body></html>`;
}
