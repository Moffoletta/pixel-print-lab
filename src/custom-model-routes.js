import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import {
  detectModelFormat,
  inspectModelFile,
  isValidStlFile,
  MAX_MODEL_FILE_SIZE,
  ModelFileError,
  modelContentType,
} from "./model-files.js";
import { RateLimiter, rateLimitMiddleware } from "./rate-limiter.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultUploadDirectory = path.join(currentDirectory, "..", "storage", "uploads");
export const MAX_STL_FILE_SIZE = MAX_MODEL_FILE_SIZE;
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export { isValidStlFile };

const allowedSites = [
  { domain: "printables.com", name: "Printables" },
  { domain: "thingiverse.com", name: "Thingiverse" },
  { domain: "makerworld.com", name: "MakerWorld" },
  { domain: "cults3d.com", name: "Cults3D" },
];

class CustomModelError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function sendError(response, error) {
  if (error instanceof multer.MulterError) {
    const fileTooLarge = error.code === "LIMIT_FILE_SIZE";
    return response.status(fileTooLarge ? 413 : 400).json({
      error: {
        code: fileTooLarge ? "MODEL_TOO_LARGE" : "INVALID_UPLOAD",
        message: fileTooLarge
          ? "Il file modello non puo superare 50 MB."
          : "La richiesta di caricamento non e valida.",
      },
    });
  }

  if (error instanceof CustomModelError || error instanceof ModelFileError) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }

  console.error(error);
  return response.status(500).json({
    error: { code: "UPLOAD_FAILED", message: "Impossibile salvare il modello." },
  });
}

export function validateExternalModelUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CustomModelError("LINK_REQUIRED", "Inserisci un link al modello.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(value.trim());
  } catch {
    throw new CustomModelError("INVALID_LINK", "Il link inserito non e valido.");
  }

  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
    throw new CustomModelError("INVALID_LINK", "Il link deve usare HTTPS e non contenere credenziali.");
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/, "");
  const site = allowedSites.find(
    ({ domain }) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
  if (!site) {
    throw new CustomModelError(
      "LINK_NOT_ALLOWED",
      "Sono accettati solo link da Printables, Thingiverse, MakerWorld o Cults3D.",
    );
  }

  return { externalUrl: parsedUrl.toString(), sourceName: site.name };
}

export async function cleanupExpiredUploads(uploadDirectory, now = Date.now()) {
  const entries = await readdir(uploadDirectory, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /\.(?:stl|3mf)$/i.test(entry.name))
      .map(async (entry) => {
        const filename = path.join(uploadDirectory, entry.name);
        const fileStats = await stat(filename);
        if (now - fileStats.mtimeMs > UPLOAD_TTL_MS) {
          await unlink(filename);
        }
      }),
  );
}

export function registerCustomModelRoutes(
  app,
  { uploadDirectory = defaultUploadDirectory, uploadRateLimit = { windowMs: 15 * 60 * 1000, max: 20 } } = {},
) {
  mkdirSync(uploadDirectory, { recursive: true });
  cleanupExpiredUploads(uploadDirectory).catch((error) => {
    console.error("Pulizia degli upload temporanei non riuscita.", error);
  });

  const uploadRateLimiter = new RateLimiter(uploadRateLimit);
  const uploadRateLimitMiddleware = rateLimitMiddleware(uploadRateLimiter);

  const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, file, callback) => {
      try {
        callback(null, `${crypto.randomUUID()}.${detectModelFormat(file.originalname)}`);
      } catch (error) {
        callback(error);
      }
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: MAX_MODEL_FILE_SIZE, files: 1, fields: 0, parts: 2 },
    fileFilter: (_request, file, callback) => {
      try {
        detectModelFormat(file.originalname);
        callback(null, true);
      } catch (error) {
        callback(error);
      }
    },
  });

  app.use(
    "/uploads",
    express.static(uploadDirectory, {
      dotfiles: "deny",
      index: false,
      setHeaders: (response, filename) => {
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Content-Type", modelContentType(path.extname(filename).slice(1).toLowerCase()));
        response.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );

  app.post("/api/custom-models/upload", uploadRateLimitMiddleware, (request, response) => {
    upload.single("model")(request, response, async (uploadError) => {
      if (uploadError) {
        return sendError(response, uploadError);
      }
      if (!request.file) {
        return sendError(
          response,
            new CustomModelError("MODEL_REQUIRED", "Seleziona un file STL o 3MF da caricare."),
        );
      }

      try {
        const modelFormat = detectModelFormat(request.file.originalname);
        const inspection = await inspectModelFile(request.file.path, modelFormat);
        await cleanupExpiredUploads(uploadDirectory);
        const id = path.basename(request.file.filename, `.${modelFormat}`);
        return response.status(201).json({
          data: {
            id,
            name: path.basename(request.file.originalname.replaceAll("\\", "/")).slice(0, 120),
            modelUrl: `/uploads/${request.file.filename}`,
            modelFormat,
            inspection,
            expiresAt: new Date(Date.now() + UPLOAD_TTL_MS).toISOString(),
          },
        });
      } catch (error) {
        await unlink(request.file.path).catch(() => {});
        return sendError(response, error);
      }
    });
  });

  app.post("/api/custom-models/link", uploadRateLimitMiddleware, (request, response) => {
    try {
      const link = validateExternalModelUrl(request.body?.url);
      return response.status(201).json({
        data: {
          id: crypto.randomUUID(),
          name: `Modello da ${link.sourceName}`,
          ...link,
        },
      });
    } catch (error) {
      return sendError(response, error);
    }
  });

  app.delete("/api/custom-models/:id", async (request, response) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.id)) {
      return sendError(response, new CustomModelError("INVALID_UPLOAD_ID", "Upload non valido."));
    }

    try {
      const results = await Promise.allSettled(
        ["stl", "3mf"].map((extension) => unlink(path.join(uploadDirectory, `${request.params.id}.${extension}`))),
      );
      if (results.every((result) => result.status === "rejected" && result.reason?.code === "ENOENT")) {
        throw Object.assign(new Error("Not found"), { code: "ENOENT" });
      }
      const unexpected = results.find((result) => result.status === "rejected" && result.reason?.code !== "ENOENT");
      if (unexpected) throw unexpected.reason;
      return response.status(204).end();
    } catch (error) {
      if (error.code === "ENOENT") {
        return sendError(
          response,
          new CustomModelError("UPLOAD_NOT_FOUND", "Il file temporaneo non esiste piu.", 404),
        );
      }
      return sendError(response, error);
    }
  });
}
