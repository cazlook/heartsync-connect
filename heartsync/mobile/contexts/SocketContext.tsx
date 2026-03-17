import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "@/constants/api";
import { useAuth } from "./AuthContext";

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  message: string;
  message_type: string;
  timestamp: string;
  read: boolean;
  reactions: Array<{ user_id: string; reaction: string }>;
}

interface SocketContextType {
  connected: boolean;
  joinMatch: (matchId: string) => void;
  leaveMatch: (matchId: string) => void;
  sendMessage: (matchId: string, message: string, type?: string) => void;
  addReaction: (matchId: string, messageId: string, reaction: string) => void;
  markRead: (matchId: string) => void;
  messages: Map<string, Message[]>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("new_message", (msg: Message) => {
      setMessages((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(msg.match_id) || [];
        updated.set(msg.match_id, [...existing, msg]);
        return updated;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const joinMatch = (matchId: string) => socketRef.current?.emit("join_match", { match_id: matchId });
  const leaveMatch = (matchId: string) => socketRef.current?.emit("leave_match", { match_id: matchId });
  const sendMessage = (matchId: string, message: string, type = "text") =>
    socketRef.current?.emit("send_message", { match_id: matchId, message, message_type: type });
  const addReaction = (matchId: string, messageId: string, reaction: string) =>
    socketRef.current?.emit("add_reaction", { match_id: matchId, message_id: messageId, reaction });
  const markRead = (matchId: string) => socketRef.current?.emit("mark_read", { match_id: matchId });

  return (
    <SocketContext.Provider value={{ connected, joinMatch, leaveMatch, sendMessage, addReaction, markRead, messages }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");
  return ctx;
}
