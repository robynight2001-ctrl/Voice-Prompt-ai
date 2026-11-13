import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db, getAuthSecret, refreshUserExpiration, type DbUserRow } from './db.ts';

export interface TokenPayload {
  sub: string;
  role: 'user' | 'admin';
  exp: number;
}

export interface AuthedRequest extends Request {
  user?: DbUserRow;
  adminUsername?: string;
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function signToken(sub: string, role: 'user' | 'admin'): string {
  const payload: TokenPayload = {
    sub,
    role,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.sub || !payload.role || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

export function requireUser(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'user') {
    res.status(401).json({ error: 'Invalid or expired user session', code: 'UNAUTHORIZED' });
    return;
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) as DbUserRow | undefined;
  if (!row) {
    res.status(401).json({ error: 'Account not found', code: 'UNAUTHORIZED' });
    return;
  }
  req.user = refreshUserExpiration(row);
  next();
}

export function requireActiveSubscription(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }
  if (user.status !== 'active') {
    res.status(403).json({
      error:
        user.status === 'pending'
          ? 'Your subscription is awaiting admin approval.'
          : user.status === 'expired'
          ? 'Your subscription has expired. Please renew to continue.'
          : user.status === 'rejected'
          ? 'Your subscription request was rejected.'
          : 'Your account has been suspended.',
      code: 'SUBSCRIPTION_INACTIVE',
      status: user.status,
    });
    return;
  }
  if (user.subscription_end && new Date(user.subscription_end).getTime() <= Date.now()) {
    res.status(403).json({
      error: 'Your subscription has expired.',
      code: 'SUBSCRIPTION_EXPIRED',
      status: 'expired',
    });
    return;
  }
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: 'Admin authentication required', code: 'ADMIN_UNAUTHORIZED' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin privileges required', code: 'FORBIDDEN' });
    return;
  }
  const admin = db.prepare('SELECT username FROM admins WHERE id = ?').get(payload.sub) as
    | { username: string }
    | undefined;
  if (!admin) {
    res.status(403).json({ error: 'Admin account not found', code: 'FORBIDDEN' });
    return;
  }
  req.adminUsername = admin.username;
  next();
}
