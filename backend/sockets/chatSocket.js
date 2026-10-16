import Message from '../models/Message.js';

export function registerChatHandlers(io, socket) {
  socket.on('get_chat_history', async ({ sessionId }, callback) => {
    try {
      const messages = await Message.find({ sessionId }).sort({ timestamp: 1 });
      if (typeof callback === 'function') {
        callback(messages);
      } else {
        socket.emit('chat_history', { sessionId, messages });
      }
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
    }
  });

  socket.on('send_chat_message', async ({ sessionId, text, sender, senderName }) => {
    if (!sessionId || !text || !text.trim()) return;
    try {
      const msg = await Message.create({
        sessionId,
        sender: sender || 'candidate',
        senderName: senderName || 'User',
        text: text.trim(),
        timestamp: new Date()
      });

      const msgObj = msg.toObject();
      // Emit to the specific candidate session room
      io.to(sessionId).emit('new_chat_message', msgObj);
      // Emit to recruiter proctor monitors
      io.to('recruiter_monitor').emit('new_chat_message', msgObj);
    } catch (err) {
      console.error('Failed to send chat message:', err);
    }
  });
}
