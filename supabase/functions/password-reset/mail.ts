// Reuses the existing Maileroo / SMTP secrets. Server-side only.
const MAILEROO_API_KEY = Deno.env.get('MAILEROO_API_KEY') || '';
const MAILEROO_FROM = Deno.env.get('MAILEROO_FROM') || 'Saint Agnes Academy OSAS <osas@stagnesacdmy.maileroo.app>';
const SMTP_HOST = Deno.env.get('SMTP_HOST') || '';
const SMTP_PORT = Deno.env.get('SMTP_PORT') || '587';
const SMTP_USER = Deno.env.get('SMTP_USER') || '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') || '';
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'Saint Agnes Academy OSAS <noreply@saac.edu.ph>';
type MailProvider = 'maileroo' | 'smtp' | null;
function mailProvider(): MailProvider {
  if (MAILEROO_API_KEY) return 'maileroo';
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) return 'smtp';
  return null;
}
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendMaileroo(recipients: string[], subject: string, html: string) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(MAILEROO_FROM);
  const from = m
    ? { address: m[2], display_name: m[1] || 'SAAC OSAS' }
    : { address: MAILEROO_FROM, display_name: 'SAAC OSAS' };

  let sent = 0;
  let failed = 0;
  let firstError = '';
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(async (address) => {
      const r = await fetch('https://smtp.maileroo.com/api/v2/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MAILEROO_API_KEY}`,
          'X-API-Key': MAILEROO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [{ address }], subject, html }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(r.status === 401
          ? 'Maileroo returned Unauthorized (check MAILEROO_API_KEY and domain verification)'
          : `Maileroo error (${r.status}): ${text.slice(0, 200)}`);
      }
    }));
    for (const res of results) {
      if (res.status === 'fulfilled') sent++;
      else {
        failed++;
        if (!firstError) firstError = String(res.reason?.message || res.reason);
      }
    }
    if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_DELAY_MS);
  }
  return { sent, failed, firstError, provider: 'maileroo' as const };
}

async function smtpSendOn(
  conn: Deno.Conn,
  opts: { from: { name: string; addr: string }; to: string; password: string; message: string; greet?: boolean },
): Promise<void> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const readReply = async (): Promise<string> => {
    let out = '';
    const buf = new Uint8Array(4096);
    for (;;) {
      const n = await conn.read(buf);
      if (n === null) break;
      out += dec.decode(buf.subarray(0, n));
      const lines = out.split(/\r?\n/).filter(Boolean);
      if (lines.length && /^\d{3} /.test(lines[lines.length - 1])) break;
      if (out.length > 16384) break;
    }
    return out;
  };
  const send = async (line: string) => { await conn.write(enc.encode(`${line}\r\n`)); };
  const expect = (reply: string, code: string, what: string) => {
    if (!reply.startsWith(code)) {
      throw new Error(`${what} failed: ${reply.slice(0, 160).replace(/\r?\n/g, ' ')}`);
    }
  };

  if (opts.greet !== false) {
    expect(await readReply(), '220', 'Connect');
  }
  await send('EHLO saac-osas.local');
  expect(await readReply(), '250', 'EHLO');

  if (opts.password) {
    await send('AUTH LOGIN');
    expect(await readReply(), '334', 'AUTH');
    await send(btoa(SMTP_USER));
    expect(await readReply(), '334', 'AUTH user');
    await send(btoa(opts.password));
    expect(await readReply(), '235', 'AUTH credentials');
  }

  await send(`MAIL FROM:<${opts.from.addr}>`);
  expect(await readReply(), '250', 'MAIL FROM');
  await send(`RCPT TO:<${opts.to}>`);
  expect(await readReply(), '250', 'RCPT TO');
  await send('DATA');
  expect(await readReply(), '354', 'DATA');
  const body = opts.message.replace(/(^|\r\n)\./g, '$1..');
  await send(`${body}\r\n.`);
  expect(await readReply(), '250', 'Message accept');
  await send('QUIT');
  await readReply().catch(() => '');
}

async function sendSmtp(recipients: string[], subject: string, html: string) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(SMTP_FROM);
  const from = m
    ? { name: m[1] || 'SAAC OSAS', addr: m[2] }
    : { name: 'SAAC OSAS', addr: SMTP_FROM };

  const port = Number(SMTP_PORT) || 587;
  const implicitTls = port === 465;

  let sent = 0;
  let failed = 0;
  let firstError = '';

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(async (address) => {
      const msg = [
        `From: ${from.name} <${from.addr}>`,
        `To: ${address}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        '',
        html,
      ].join('\r\n');

      let sock: Deno.Conn | null = implicitTls
        ? await Deno.connectTls({ hostname: SMTP_HOST, port })
        : await Deno.connect({ hostname: SMTP_HOST, port });
      try {
        if (!implicitTls) {
          const enc = new TextEncoder();
          const dec = new TextDecoder();
          const readReply = async (): Promise<string> => {
            let out = '';
            const buf = new Uint8Array(4096);
            for (;;) {
              const n = await sock!.read(buf);
              if (n === null) break;
              out += dec.decode(buf.subarray(0, n));
              const lines = out.split(/\r?\n/).filter(Boolean);
              if (lines.length && /^\d{3} /.test(lines[lines.length - 1])) break;
              if (out.length > 16384) break;
            }
            return out;
          };

          expect220: {
            const greeting = await readReply();
            if (!greeting.startsWith('220')) {
              throw new Error(`Connect failed: ${greeting.slice(0, 160).replace(/\r?\n/g, ' ')}`);
            }
          }
          await sock.write(enc.encode('EHLO saac-osas.local\r\n'));
          const ehlo = await readReply();
          if (!ehlo.startsWith('250')) {
            throw new Error(`EHLO failed: ${ehlo.slice(0, 160).replace(/\r?\n/g, ' ')}`);
          }
          if (!/STARTTLS/i.test(ehlo)) throw new Error('SMTP requires STARTTLS.');
          if (/STARTTLS/i.test(ehlo)) {
            await sock.write(enc.encode('STARTTLS\r\n'));
            const ok = await readReply();
            if (!ok.startsWith('220')) {
              throw new Error(`STARTTLS failed: ${ok.slice(0, 160).replace(/\r?\n/g, ' ')}`);
            }
            sock = await Deno.startTls(sock as Deno.TcpConn, { hostname: SMTP_HOST });
          }
        }
        await smtpSendOn(sock, { from, to: address, password: SMTP_PASS, message: msg, greet: implicitTls });
        sent++;
      } catch (err) {
        failed++;
        if (!firstError) firstError = String((err as Error).message || err);
      } finally {
        try { sock?.close(); } catch {}
      }
    }));
    if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_DELAY_MS);
  }

  return { sent, failed, firstError, provider: 'smtp' as const };
}

async function sendEach(recipients: string[], subject: string, html: string) {
  const provider = mailProvider();
  if (!provider) {
    return {
      sent: 0,
      failed: recipients.length,
      firstError: 'No email provider is configured on the send-notification function. Set MAILEROO_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.',
      provider: null,
    };
  }
  if (provider === 'maileroo') return sendMaileroo(recipients, subject, html);
  return sendSmtp(recipients, subject, html);
}


export async function sendMail(recipients: string[], subject: string, html: string) {
  const result = await sendEach(recipients, subject, html);
  if (result.failed || !result.sent) throw new Error('Email delivery failed.');
}
