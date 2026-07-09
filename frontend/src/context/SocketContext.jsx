import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

if (typeof window !== 'undefined') {
  window.io = io;
}

const SocketContext = createContext(undefined);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [auth, setAuth] = useState(() => {
    const key = window.location.pathname.startsWith('/recruiter') ? 'auth_recruiter' : 'auth_candidate';
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    // Only connect if we have an active auth
    if (auth) {
      const newSocket = io(window.location.origin, {
        reconnectionDelayMax: 10000,
        auth: { token: auth.token }
      });
      
      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [auth]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      const role = auth?.role || (window.location.pathname.startsWith('/recruiter') ? 'recruiter' : 'candidate');
      const key = role === 'recruiter' ? 'auth_recruiter' : 'auth_candidate';
      if (e.key === key) {
        try {
          const newAuth = e.newValue ? JSON.parse(e.newValue) : null;
          setAuth(newAuth);
        } catch {
          setAuth(null);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [auth]);

  const login = (authData) => {
    setAuth(authData);
    const key = authData.role === 'recruiter' ? 'auth_recruiter' : 'auth_candidate';
    localStorage.setItem(key, JSON.stringify(authData));
  };

  const logout = (localOnly = false) => {
    const role = auth?.role || (window.location.pathname.startsWith('/recruiter') ? 'recruiter' : 'candidate');
    const key = role === 'recruiter' ? 'auth_recruiter' : 'auth_candidate';
    setAuth(null);
    if (!localOnly) {
      localStorage.removeItem(key);
    }
    if (socket) socket.disconnect();
  };

  return (
    <SocketContext.Provider value={{ socket, auth, login, logout }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
