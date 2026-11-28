import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { resolveAuth } from './src/server/auth.ts';
import { authRouter } from './src/server/routes/auth.ts';
import { citizenRouter } from './src/server/routes/citizen.ts';
import { driverRouter } from './src/server/routes/driver.ts';
import { adminRouter } from './src/server/routes/admin.ts';
import { pushRouter } from './src/server/push.ts';
import { phoneVerifyRouter } from './src/server/phoneVerify.ts';
import { attachRealtimeServer } from './src/server/realtime.ts';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health probe
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timezone: 'Asia/Tashkent', timestamp: new Date().toISOString() });
  });

  // Resolve authentication for all API routes
  app.use('/api', resolveAuth);
  app.use('/api/auth', authRouter);
  app.use('/api', citizenRouter);
  app.use('/api', driverRouter);
  app.use('/api', adminRouter);
  app.use('/api', pushRouter);
  app.use('/api', phoneVerifyRouter);

  // API 404 fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API yo‘nalishi topilmadi.' });
  });

  // Attach authenticated WebSocket realtime invalidation hub on /ws
  attachRealtimeServer(server);

  // Mount Vite middleware in dev or serve built SPA in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`YASHNAR server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start YASHNAR server:', err);
  process.exit(1);
});
