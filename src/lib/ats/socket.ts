"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getAtsSocket(): Socket {
  if (socket) {
    return socket;
  }

  const base = process.env.NEXT_PUBLIC_ATS_API_BASE_URL ?? "http://localhost:4000";
  socket = io(base, {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });
  return socket;
}
