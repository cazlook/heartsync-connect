import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || '';

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  message: string;
  message_type: string;
  timestamp: string;
  read: boolean;
  reactions: Array<{
    user_id: string;
    reaction: string;
    timestamp: string;
  }>;
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  joinMatch: (matchId: string) => void;
  leaveMatch: (matchId: string) => void;
  sendMessage: (matchId: string, message: string, type?: string) => void;
  addReaction: (matchId: string, messageId: string, reaction: string) => void;
  setTyping: (matchId: string, isTyping: boolean) => void;
  markRead: (matchId: string) => void;
  messages: Map<string, Message[]>;
  typingUsers: Map<string, string[]>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());

  useEffect(() => {
    if (!token || !user) {
      // Disconnect if no auth
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create socket connection
    const newSocket = io(BACKEND_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    // Listen for new messages
    newSocket.on('new_message', (message: Message) => {
      console.log('New message received:', message);
      setMessages(prev => {
        const matchMessages = prev.get(message.match_id) || [];
        const newMessages = new Map(prev);
        newMessages.set(message.match_id, [...matchMessages, message]);
        return newMessages;
      });
    });

    // Listen for reactions
    newSocket.on('message_reaction', (data: { message_id: string; user_id: string; reaction: string }) => {
      console.log('Message reaction:', data);
      // Update message with reaction
      setMessages(prev => {
        const newMessages = new Map(prev);
        newMessages.forEach((matchMessages, matchId) => {
          const updated = matchMessages.map(msg => {
            if (msg.id === data.message_id) {
              return {
                ...msg,
                reactions: [...msg.reactions, {
                  user_id: data.user_id,
                  reaction: data.reaction,
                  timestamp: new Date().toISOString()
                }]
              };
            }
            return msg;
          });
          newMessages.set(matchId, updated);
        });
        return newMessages;
      });
    });

    // Listen for typing indicators
    newSocket.on('user_typing', (data: { user_id: string; is_typing: boolean }) => {
      console.log('User typing:', data);
      // Handle typing indicator logic here if needed
    });

    // Listen for read receipts
    newSocket.on('messages_read', (data: { match_id: string; reader_id: string }) => {
      console.log('Messages read:', data);
      setMessages(prev => {
        const matchMessages = prev.get(data.match_id) || [];
        const updated = matchMessages.map(msg => 
          msg.sender_id !== data.reader_id ? { ...msg, read: true } : msg
        );
        const newMessages = new Map(prev);
        newMessages.set(data.match_id, updated);
        return newMessages;
      });
    });

    // Error handling
    newSocket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, user]);

  const joinMatch = (matchId: string) => {
    if (socket && connected) {
      socket.emit('join_match', { match_id: matchId });
    }
  };

  const leaveMatch = (matchId: string) => {
    if (socket && connected) {
      socket.emit('leave_match', { match_id: matchId });
    }
  };

  const sendMessage = (matchId: string, message: string, type: string = 'text') => {
    if (socket && connected) {
      socket.emit('send_message', {
        match_id: matchId,
        message: message,
        message_type: type
      });
    }
  };

  const addReaction = (matchId: string, messageId: string, reaction: string) => {
    if (socket && connected) {
      socket.emit('add_reaction', {
        match_id: matchId,
        message_id: messageId,
        reaction: reaction
      });
    }
  };

  const setTyping = (matchId: string, isTyping: boolean) => {
    if (socket && connected) {
      socket.emit('typing', {
        match_id: matchId,
        is_typing: isTyping
      });
    }
  };

  const markRead = (matchId: string) => {
    if (socket && connected) {
      socket.emit('mark_read', {
        match_id: matchId
      });
    }
  };

  return (
    <SocketContext.Provider value={{
      socket,
      connected,
      joinMatch,
      leaveMatch,
      sendMessage,
      addReaction,
      setTyping,
      markRead,
      messages,
      typingUsers
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};
