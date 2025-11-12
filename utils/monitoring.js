// monitoring.js
import express from 'express';
import os from 'os';
import process from 'process';
import client from 'prom-client';

const router = express.Router();

// --- 1️⃣ Coletor padrão do Prometheus ---
client.collectDefaultMetrics({
  prefix: 'abelhinha_',
  timeout: 5000,
});

// --- 2️⃣ Rota /health ---
router.get('/health', (_req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  const load = os.loadavg();

  res.status(200).json({
    status: 'ok',
    uptime: `${Math.round(uptime)}s`,
    memory: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
    loadavg: load.map(v => v.toFixed(2)),
    timestamp: new Date().toISOString(),
  });
});

// --- 3️⃣ Rota /metrics ---
router.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.send(metrics);
  } catch (err) {
    res.status(500).send('Error generating metrics');
  }
});

export default router;
