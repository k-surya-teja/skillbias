import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { env } from "./env.js";

const uploadDir = path.resolve(process.cwd(), env.UPLOADS_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

export const resumeUpload = multer({ storage });
