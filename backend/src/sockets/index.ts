import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { env } from "../config/env.js";

let io: SocketServer | null = null;

export function initializeSockets(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join_org_room", (orgId: string) => {
      socket.join(`org:${orgId}`);
    });
  });

  return io;
}

export function emitCandidateScored(orgId: string, payload: { jobId: string }): void {
  io?.to(`org:${orgId}`).emit("candidate_scored", payload);
}
