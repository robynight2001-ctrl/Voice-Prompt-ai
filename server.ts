import 'dotenv/config';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { app } from './server/app.ts';
import { initDatabase } from './server/db.ts';

async function startServer() {
  await initDatabase();

  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`VoicePrompt AI server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VoicePrompt AI server:', err);
  process.exit(1);
});
