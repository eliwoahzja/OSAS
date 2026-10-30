// Short-lived, HMAC-signed proof that an administrator was authenticated by
// agent-chat. n8n only relays this token; it cannot mint a new one or change
// the actor id without invalidating the signature.

export type AgentTokenPayload = {
  sub: string;
  email?: string;
  name?: string;
  exp: number;
  jti: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function mintAgentToken(payload: AgentTokenPayload, secret: string): Promise<string> {
  const body = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(body)));
  return `${body}.${base64Url(signature)}`;
}

export async function verifyAgentToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): Promise<AgentTokenPayload | null> {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(secret),
      fromBase64Url(parts[1]),
      encoder.encode(parts[0]),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(parts[0]))) as AgentTokenPayload;
    if (!payload || typeof payload.sub !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.sub)) return null;
    if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= nowMs) return null;
    if (typeof payload.jti !== 'string' || payload.jti.length < 8) return null;
    return payload;
  } catch {
    return null;
  }
}
