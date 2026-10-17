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
  if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    console.error('❌ FATAL: JWT_SECRET is not defined or is empty in environment variables. Add a valid JWT_SECRET to your .env file.');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.trim()) {
    console.error('❌ FATAL: MONGODB_URI is not defined in environment variables. Add MONGODB_URI to your .env file or Railway variables.');
    process.exit(1);
  }

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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();
