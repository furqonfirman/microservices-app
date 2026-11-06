const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'user-service' });
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message });
  }
});

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, created_at, updated_at FROM users ORDER BY id ASC',
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?',
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ data: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }
    const [result] = await pool.query(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email],
    );
    const [rows] = await pool.query(
      'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?',
      [result.insertId],
    );
    return res.status(201).json({ data: rows[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'email already exists' });
    }
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, email } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }
    const [result] = await pool.query(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, req.params.id],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const [rows] = await pool.query(
      'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?',
      [req.params.id],
    );
    return res.json({ data: rows[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'email already exists' });
    }
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
