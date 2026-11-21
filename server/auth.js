import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db, get } from './db.js';
import { HttpError } from './utils.js';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
};

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    active: Boolean(user.active),
    lastLogin: user.last_login,
  };
}

export function createSession(res, user) {
  const token = jwt.sign(
    { sub: String(user.id), username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: `${config.sessionHours}h`, issuer: 'tallertech-manager' },
  );
  res.cookie(config.cookieName, token, {
    ...cookieOptions,
    maxAge: config.sessionHours * 60 * 60 * 1000,
  });
  return token;
}

export function destroySession(res) {
  res.clearCookie(config.cookieName, cookieOptions);
}

function extractToken(req) {
  if (req.cookies?.[config.cookieName]) return req.cookies[config.cookieName];
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next(new HttpError(401, 'Tu sesión no está iniciada.'));
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: 'tallertech-manager' });
    const user = get(
      'SELECT id, username, full_name, role, active, last_login FROM users WHERE id = ?',
      [Number(payload.sub)],
    );
    if (!user || !user.active) {
      destroySession(res);
      return next(new HttpError(401, 'La sesión ya no es válida.'));
    }
    req.user = publicUser(user);
    req.db = db;
    return next();
  } catch {
    destroySession(res);
    return next(new HttpError(401, 'Tu sesión expiró. Volvé a ingresar.'));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Tu sesión no está iniciada.'));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'No tenés permisos para realizar esta acción.'));
    }
    return next();
  };
}
