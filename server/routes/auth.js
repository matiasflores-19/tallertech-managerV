import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession, destroySession, requireAuth, requireRole, publicUser } from '../auth.js';
import { all, get, insert, run, logActivity } from '../db.js';
import { asyncHandler, audit, HttpError, parse, nowIso } from '../utils.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Ingresá tu usuario.').max(80),
  password: z.string().min(1, 'Ingresá tu contraseña.').max(200),
});

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(100, 'La contraseña es demasiado larga.')
  .refine((value) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(value) && /\d/.test(value), {
    message: 'La contraseña debe incluir al menos una letra y un número.',
  });

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'El usuario debe tener al menos 3 caracteres.')
    .max(40, 'El usuario es demasiado largo.')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Solo se permiten letras, números, puntos, guiones y guiones bajos.'),
  full_name: z.string().trim().min(3, 'Ingresá el nombre completo.').max(100),
  role: z.enum(['admin', 'tecnico']),
  password: passwordSchema,
});

const updateUserSchema = z.object({
  full_name: z.string().trim().min(3).max(100).optional(),
  role: z.enum(['admin', 'tecnico']).optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
});

router.post(
  '/login',
  asyncHandler((req, res) => {
    const data = parse(loginSchema, req.body);
    const ip = req.ip || req.socket.remoteAddress || 'desconocida';
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const failed = get(
      `SELECT COUNT(*) AS count FROM login_attempts
       WHERE success = 0 AND created_at > ? AND (lower(username) = lower(?) OR ip = ?)`,
      [windowStart, data.username, ip],
    );
    if (failed.count >= 8) {
      throw new HttpError(429, 'Demasiados intentos fallidos. Esperá 15 minutos antes de volver a intentar.');
    }

    const user = get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [data.username]);
    const valid = user && user.active ? bcrypt.compareSync(data.password, user.password_hash) : false;
    run('INSERT INTO login_attempts (username, ip, success) VALUES (?, ?, ?)', [
      data.username,
      ip,
      valid ? 1 : 0,
    ]);

    if (!valid) {
      throw new HttpError(401, 'Usuario o contraseña incorrectos.');
    }

    const loggedAt = nowIso();
    run('UPDATE users SET last_login = ? WHERE id = ?', [loggedAt, user.id]);
    run('DELETE FROM login_attempts WHERE success = 0 AND (lower(username) = lower(?) OR ip = ?)', [
      data.username,
      ip,
    ]);
    createSession(res, user);
    logActivity({
      userId: user.id,
      username: user.username,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      description: `${user.full_name} inició sesión.`,
    });
    res.json({ user: publicUser({ ...user, last_login: loggedAt }) });
  }),
);

router.post('/logout', (req, res) => {
  destroySession(res);
  res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post(
  '/change-password',
  requireAuth,
  asyncHandler((req, res) => {
    const schema = z.object({
      currentPassword: z.string().min(1, 'Ingresá tu contraseña actual.'),
      newPassword: passwordSchema,
    });
    const data = parse(schema, req.body);
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(data.currentPassword, user.password_hash)) {
      throw new HttpError(400, 'La contraseña actual no es correcta.');
    }
    if (bcrypt.compareSync(data.newPassword, user.password_hash)) {
      throw new HttpError(400, 'La nueva contraseña debe ser diferente a la actual.');
    }
    run('UPDATE users SET password_hash = ? WHERE id = ?', [
      bcrypt.hashSync(data.newPassword, 12),
      user.id,
    ]);
    audit(req, 'PASSWORD_CHANGE', 'user', user.id, 'El usuario cambió su contraseña.');
    res.json({ ok: true, message: 'Contraseña actualizada correctamente.' });
  }),
);

router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = all(
    'SELECT id, username, full_name, role, active, created_at, last_login FROM users ORDER BY created_at',
  ).map((user) => ({
    ...user,
    active: Boolean(user.active),
  }));
  res.json({ users });
});

router.post(
  '/users',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => {
    const data = parse(createUserSchema, req.body);
    if (get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [data.username])) {
      throw new HttpError(409, 'Ya existe un usuario con ese nombre de usuario.');
    }
    const id = insert(
      `INSERT INTO users (username, password_hash, full_name, role, active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [data.username, bcrypt.hashSync(data.password, 12), data.full_name, data.role, nowIso()],
    );
    audit(req, 'USER_CREATE', 'user', id, `Se creó el usuario ${data.username}.`);
    res.status(201).json({
      ok: true,
      message: 'Usuario creado correctamente.',
      user: publicUser(get('SELECT * FROM users WHERE id = ?', [id])),
    });
  }),
);

router.patch(
  '/users/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const current = get('SELECT * FROM users WHERE id = ?', [id]);
    if (!current) throw new HttpError(404, 'Usuario no encontrado.');
    const data = parse(updateUserSchema, req.body);

    if (current.role === 'admin') {
      const admins = get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1").count;
      if ((data.role && data.role !== 'admin') || data.active === false) {
        if (admins <= 1) {
          throw new HttpError(400, 'No podés desactivar o quitar el rol del último administrador.');
        }
      }
    }
    if (id === req.user.id && data.active === false) {
      throw new HttpError(400, 'No podés desactivar tu propio usuario.');
    }

    const fields = [];
    const params = [];
    if (data.full_name) {
      fields.push('full_name = ?');
      params.push(data.full_name);
    }
    if (data.role) {
      fields.push('role = ?');
      params.push(data.role);
    }
    if (data.active !== undefined) {
      fields.push('active = ?');
      params.push(data.active ? 1 : 0);
    }
    if (data.password) {
      fields.push('password_hash = ?');
      params.push(bcrypt.hashSync(data.password, 12));
    }
    if (!fields.length) throw new HttpError(400, 'No hay cambios para guardar.');
    params.push(id);
    run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    audit(req, 'USER_UPDATE', 'user', id, `Se actualizó el usuario ${current.username}.`);
    res.json({
      ok: true,
      message: 'Usuario actualizado correctamente.',
      user: publicUser(get('SELECT * FROM users WHERE id = ?', [id])),
    });
  }),
);

export default router;
