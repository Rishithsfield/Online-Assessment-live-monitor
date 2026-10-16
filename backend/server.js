import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import { connectDB } from './config/db.js';
import { startTelemetryBuffer } from './services/telemetryBuffer.js';
import apiRoutes from './routes/index.js';
import { initSockets } from './sockets/index.js';

async function startServer() {
  // Initialize Database & Background Services
  await connectDB();
  startTelemetryBuffer();

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  app.set('io', io);

  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Mount API Routes
  app.use('/api', apiRoutes);

  // Initialize Socket.io Layer
  initSockets(io);

  // Vite Dev Server / Static Asset Serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, 'localhost', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
