const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function extractToken(req) {
  if (req.body && req.body.token) {
    return req.body.token;
  }
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'auth-service' });
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message });
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: 'username, email and password are required' });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: 'password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash],
    );

    const user = { id: result.insertId, username, email };
    return res.status(201).json({ data: user, token: signToken(user) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res
        .status(409)
        .json({ error: 'username or email already exists' });
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: 'username and password are required' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?',
      [username, username],
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = { id: user.id, username: user.username, email: user.email };
    return res.json({ data: payload, token: signToken(payload) });
  } catch (error) {
    return next(error);
  }
});

router.post('/validate', (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ valid: false, error: 'Token is required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return res.json({ valid: true, payload });
  } catch (error) {
    return res
      .status(401)
      .json({ valid: false, error: 'Invalid or expired token' });
  }
});

module.exports = router;
