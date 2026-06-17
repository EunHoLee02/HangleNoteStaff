import cors from "cors";
import express from "express";
import multer from "multer";
import sharp from "sharp";
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
const HOMR_BIN = process.env.HOMR_BIN ?? path.join(ROOT_DIR, ".homr-venv", "Scripts", "homr.exe");
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");
const OUTPUT_DIR = path.join(ROOT_DIR, "outputs");
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"]);
const TARGET_IMAGE_LONG_EDGE = 3500;

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
    homrBin: HOMR_BIN,
    maxFileMb: MAX_FILE_MB,
    timeoutMs: TIMEOUT_MS,
  });
});

app.get("/omr/jobs", (_req, res) => {
  res.json({
    ok: true,
    message: "Upload score files with POST /omr/jobs using multipart/form-data field name 'file'.",
    health: "/health",
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
    console.log(`[omr:${jobId}] received ${inputFile.originalname} (${inputFile.size} bytes)`);
    const audiverisInputPath = await prepareAudiverisInput(inputFile.path, jobOutputDir);
    const engine = normalizeEngine(req.body?.engine);
    const resultPath = await runOmrEngine(engine, inputFile.path, audiverisInputPath, jobOutputDir);
    const filename = path.basename(resultPath);
    console.log(`[omr:${jobId}] completed ${filename}`);
    res.download(resultPath, filename, async (error) => {
      await cleanup(inputFile.path, jobOutputDir);
      if (error && !res.headersSent) {
        console.error(`[omr:${jobId}] download failed`, error);
        res.status(500).json({ error: "Failed to send MusicXML result.", detail: error.message });
      }
    });
  } catch (error) {
    console.error(`[omr:${jobId}] failed`, error);
    await cleanup(inputFile.path, jobOutputDir);
    res.status(500).json({
      error: "OMR failed",
      detail: describeAudiverisError(error),
    });
  }
});

async function runOmrEngine(engine, originalInputPath, preparedInputPath, outputDir) {
  if (engine === "homr") {
    return runHomrIfSupported(originalInputPath, preparedInputPath, outputDir);
  }

  if (engine === "audiveris") {
    return runAudiveris(preparedInputPath, outputDir);
  }

  if (IMAGE_EXTENSIONS.has(path.extname(originalInputPath).toLowerCase())) {
    try {
      return await runHomrIfSupported(originalInputPath, preparedInputPath, outputDir);
    } catch (error) {
      console.error("[omr] Homr failed, falling back to Audiveris", error);
      return runAudiveris(preparedInputPath, outputDir);
    }
  }

  try {
    return await runAudiveris(preparedInputPath, outputDir);
  } catch (error) {
    throw error;
  }
}

function normalizeEngine(value) {
  if (value === "audiveris" || value === "homr") return value;
  return "auto";
}

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

  const result = await execFileAsync(AUDIVERIS_BIN, args, {
    timeout: TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });
  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.stderr?.trim()) console.error(result.stderr.trim());

  const resultPath = await findMusicXmlOutput(outputDir);
  if (!resultPath) {
    throw new Error("Audiveris finished, but no .mxl/.musicxml/.xml output was created.");
  }
  return resultPath;
}

async function runHomrIfSupported(originalInputPath, preparedInputPath, outputDir) {
  const originalExt = path.extname(originalInputPath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(originalExt)) {
    throw new Error("Homr only supports image files. Use Audiveris for PDF input.");
  }

  await fs.access(HOMR_BIN);
  return runHomr(preparedInputPath, outputDir);
}

async function runHomr(inputPath, outputDir) {
  const result = await execFileAsync(HOMR_BIN, ["--output-large-page", inputPath], {
    timeout: TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
    },
  });
  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.stderr?.trim()) console.error(result.stderr.trim());

  const expectedPath = replaceExtension(inputPath, ".musicxml");
  try {
    await fs.access(expectedPath);
    return expectedPath;
  } catch {
    const resultPath = await findMusicXmlOutput(outputDir);
    if (!resultPath) {
      throw new Error("Homr finished, but no .musicxml output was created.");
    }
    return resultPath;
  }
}

function replaceExtension(filePath, extension) {
  return path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}${extension}`);
}

async function prepareAudiverisInput(inputPath, outputDir) {
  const ext = path.extname(inputPath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) return inputPath;

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const longEdge = Math.max(width, height);
  if (!longEdge) return inputPath;

  const scale = Math.max(1, TARGET_IMAGE_LONG_EDGE / longEdge);
  if (scale <= 1.05) {
    console.log(`[omr] image preprocessing skipped (${width}x${height})`);
    return inputPath;
  }

  const preparedPath = path.join(outputDir, `${path.basename(inputPath, ext)}-prepared.png`);
  await sharp(inputPath)
    .resize({
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png({ compressionLevel: 6 })
    .toFile(preparedPath);

  console.log(`[omr] image preprocessed ${width}x${height} -> ${Math.round(width * scale)}x${Math.round(height * scale)}`);
  return preparedPath;
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

function describeAudiverisError(error) {
  const output = [error.stdout, error.stderr, error.message].filter(Boolean).join("\n");
  if (/too low interline value/i.test(output) || /picture resolution is too low/i.test(output)) {
    return "Audiveris가 오선 간격을 너무 작게 감지했습니다. 이미지 해상도가 낮거나 악보가 작게 캡처된 상태입니다. 300 DPI 수준의 악보 전체 페이지 PDF/이미지로 다시 시도해 주세요.";
  }
  if (/No system found/i.test(output)) {
    return "Audiveris가 오선 시스템을 찾지 못했습니다. 더 선명한 고해상도 악보 전체 페이지 PDF/이미지로 다시 시도해 주세요.";
  }
  if (/no \.mxl\/\.musicxml\/\.xml output/i.test(output)) {
    return "Audiveris가 실행됐지만 MusicXML/MXL 결과 파일을 만들지 못했습니다. 입력 파일이 인쇄 악보 전체 페이지인지 확인해 주세요.";
  }
  if (/No installed OCR languages/i.test(output)) {
    return "Audiveris OCR 언어가 설치되어 있지 않습니다. 텍스트 인식 품질이 제한될 수 있습니다.";
  }
  return error.message;
}
