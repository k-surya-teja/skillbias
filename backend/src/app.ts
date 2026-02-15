import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import jobsRoutes from "./routes/jobsRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import applicationsRoutes from "./routes/applicationsRoutes.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function buildApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/jobs", jobsRoutes);
  app.use("/public", publicRoutes);
  app.use("/dashboard", dashboardRoutes);
  app.use("/applications", applicationsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
