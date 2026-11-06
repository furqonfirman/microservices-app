const express = require('express');
const { pool, waitForDatabase, initSchema } = require('./db');
const authRouter = require('./routes/auth');

const app = express();
const port = Number(process.env.PORT || 3002);

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        service: 'auth-service',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      }),
    );
  });
  next();
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'auth-service' });
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message });
  }
});

app.use('/api/auth', authRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await waitForDatabase();
  await initSchema();

  const server = app.listen(port, () => {
    console.log(`auth-service listening on port ${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('Failed to start auth-service', error);
  process.exit(1);
});
