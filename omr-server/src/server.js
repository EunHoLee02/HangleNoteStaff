import cors from "cors";
import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
const app = express();

const PORT = Number(process.env.PORT ?? 8080);
const AUDIVERIS_BIN = process.env.AUDIVERIS_BIN ?? "audiveris";
const MAX_FILE_MB = Number(process.env.OMR_MAX_FILE_MB ?? 30);
const TIMEOUT_MS = Number(process.env.OMR_TIMEOUT_MS ?? 180000);
const ROOT_DIR = process.cwd();
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");
const OUTPUT_DIR = path.join(ROOT_DIR, "outputs");
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"]);

await fs.mkdir(UPLOAD_DIR, { recursive: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: MAX_FILE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      callback(null, true);
      return;
    }
    callback(new Error("Only PDF and image files are supported."));
  },
});

app.use(cors({
  origin: parseCorsOrigins(process.env.OMR_CORS_ORIGIN),
}));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    audiverisBin: AUDIVERIS_BIN,
    maxFileMb: MAX_FILE_MB,
    timeoutMs: TIMEOUT_MS,
  });
});

app.post("/omr/jobs", upload.single("file"), async (req, res) => {
  const inputFile = req.file;
  if (!inputFile) {
    res.status(400).json({ error: "file is required" });
    return;
  }

  const jobId = randomUUID();
  const jobOutputDir = path.join(OUTPUT_DIR, jobId);
  await fs.mkdir(jobOutputDir, { recursive: true });

  try {
    const resultPath = await runAudiveris(inputFile.path, jobOutputDir);
    const filename = path.basename(resultPath);
    res.download(resultPath, filename, async (error) => {
      await cleanup(inputFile.path, jobOutputDir);
      if (error && !res.headersSent) {
        res.status(500).json({ error: "Failed to send MusicXML result.", detail: error.message });
      }
    });
  } catch (error) {
    await cleanup(inputFile.path, jobOutputDir);
    res.status(500).json({
      error: "OMR failed",
      detail: error.message,
    });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.status(400).json({ error: error.message ?? "Bad request" });
});

app.listen(PORT, () => {
  console.log(`OMR server listening on http://localhost:${PORT}`);
});

async function runAudiveris(inputPath, outputDir) {
  const args = [
    "-batch",
    "-transcribe",
    "-export",
    "-output",
    outputDir,
    inputPath,
  ];

  await execFileAsync(AUDIVERIS_BIN, args, {
    timeout: TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });

  const resultPath = await findMusicXmlOutput(outputDir);
  if (!resultPath) {
    throw new Error("Audiveris finished, but no .mxl/.musicxml/.xml output was created.");
  }
  return resultPath;
}

async function findMusicXmlOutput(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findMusicXmlOutput(fullPath);
      if (nested) candidates.push(nested);
      continue;
    }

    if (/\.(mxl|musicxml|xml)$/i.test(entry.name)) {
      candidates.push(fullPath);
    }
  }

  candidates.sort((a, b) => {
    const aScore = a.toLowerCase().endsWith(".mxl") ? 0 : 1;
    const bScore = b.toLowerCase().endsWith(".mxl") ? 0 : 1;
    return aScore - bScore || a.localeCompare(b);
  });
  return candidates[0] ?? null;
}

async function cleanup(inputPath, outputDir) {
  await Promise.allSettled([
    fs.rm(inputPath, { force: true }),
    fs.rm(outputDir, { recursive: true, force: true }),
  ]);
}

function parseCorsOrigins(value) {
  if (!value || value.trim() === "*") return true;
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}
