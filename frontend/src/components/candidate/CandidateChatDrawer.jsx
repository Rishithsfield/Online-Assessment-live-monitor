import React, { useRef, useEffect } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { cn } from '../../lib/utils';

export function CandidateChatDrawer({
  chatOpen,
  setChatOpen,
  chatMessages,
  chatInput,
  setChatInput,
  unreadChatCount,
  onSendMessage
}) {
  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatOpen]);

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
      {chatOpen ? (
        <div className="w-80 sm:w-96 h-96 refractive-glass rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-black/95 backdrop-blur-xl animate-fade-up">
          {/* Drawer Header */}
          <div className="px-4 py-3 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                <MessageSquare className="w-4 h-4 text-indigo-400" /> Live Proctor Chat
              </span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages body */}
          <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/50">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 mb-2 text-slate-300 dark:text-zinc-700" />
                <p className="font-bold text-slate-600 dark:text-slate-300">Proctor Support Channel</p>
                <p className="text-[10px] text-slate-400 mt-1">Need help or clarification? Send a message directly to your proctor.</p>
              </div>
            ) : (
              chatMessages.map((msg, i) => {
                const isMe = msg.sender === 'candidate';
                return (
                  <div key={msg._id || i} className={cn('flex flex-col max-w-[85%]', isMe ? 'ml-auto items-end' : 'mr-auto items-start')}>
                    <span className="text-[9px] text-slate-400 mb-0.5 px-1 font-bold">
                      {isMe ? 'You' : (msg.senderName || 'Proctor')} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className={cn(
                      'px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm font-medium',
                      isMe
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-zinc-700'
                    )}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={onSendMessage} className="p-3 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Type a message to proctor..."
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setChatOpen(true)}
          className="relative oily-liquid-capsule px-4 py-3 bg-white hover:bg-slate-100 text-black shadow-2xl shadow-black/20 border-2 border-slate-300 dark:border-zinc-700 flex items-center gap-2.5 text-xs font-black transition-all duration-300 hover:scale-105 cursor-pointer z-50 opacity-100"
        >
          <div className="relative">
            <MessageSquare className="w-4.5 h-4.5 text-black stroke-[2.5]" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            )}
          </div>
          <span className="text-black font-black tracking-wide">Proctor Chat</span>
          {unreadChatCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black border border-black">
              {unreadChatCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
