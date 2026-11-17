import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const COOKIE_NAME = 'uls_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || crypto.createHash('sha256').update(getAdminAccessCode() + '_uls_session').digest('hex');
}

export function getAdminAccessCode(): string {
  return process.env.ADMIN_ACCESS_CODE || 'ULS-Admin-2025';
}

function signPayload(payloadB64: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(payloadB64).digest('base64url');
}

export function createSessionToken(): string {
  const payload = {
    role: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;
  const expectedSig = signPayload(payloadB64);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return parsed?.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = getAdminAccessCode();
  const a = Buffer.from(candidate || '', 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function setAdminSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function isAdminAuthenticated(req: Request): boolean {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminAuthenticated(req)) {
    res.status(401).json({ error: 'Acceso restringido. Debe iniciar sesión como administrador.' });
    return;
  }
  next();
}
