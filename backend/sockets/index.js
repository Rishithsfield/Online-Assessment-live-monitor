import jwt from 'jsonwebtoken';
import { registerCandidateHandlers } from './candidateSocket.js';
import { registerRecruiterHandlers } from './recruiterSocket.js';
import { registerTelemetryHandlers } from './telemetrySocket.js';
import { registerChatHandlers } from './chatSocket.js';

export function initSockets(io) {
  const activeSockets = new Map(); // sessionId -> socket

  // Socket.io Handshake Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_123!');
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Token invalid or expired'));
    }
  });

  io.on('connection', (socket) => {
    // Register domain handlers
    registerRecruiterHandlers(io, socket, activeSockets);
    registerCandidateHandlers(io, socket, activeSockets);
    registerTelemetryHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      if (socket.sessionId && activeSockets.get(socket.sessionId) === socket) {
        activeSockets.delete(socket.sessionId);
      }
    });
  });

  return { activeSockets };
}
