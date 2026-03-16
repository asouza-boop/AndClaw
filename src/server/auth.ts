import crypto from 'crypto';
import { verifyPassword } from './crypto';
import { config } from '../config/env';
import { Request, Response, NextFunction } from 'express';

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input: string) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(base64, 'base64').toString();
}

export function issueToken(subject: string, ttlSeconds: number = 60 * 60 * 24 * 7) {
  if (!config.auth.tokenSecret) {
    throw new Error('AUTH_TOKEN_SECRET not configured');
  }
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ sub: subject, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', config.auth.tokenSecret).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): { sub: string } | null {
  if (!config.auth.tokenSecret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = base64UrlEncode(
    crypto.createHmac('sha256', config.auth.tokenSecret).update(`${header}.${payload}`).digest()
  );
  try {
    const expectedBuf = Buffer.from(expected, 'utf8');
    const signatureBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== signatureBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, signatureBuf)) return null;
  } catch {
    return null;
  }

  const decoded = JSON.parse(base64UrlDecode(payload));
  if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return { sub: decoded.sub };
}

export function verifyLoginPassword(password: string): boolean {
  if (!config.auth.password) return false;
  return verifyPassword(password, config.auth.password);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const verified = token ? verifyToken(token) : null;
  if (!verified) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  (req as any).user = verified;
  next();
}
