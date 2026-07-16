import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import { open, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultUploadDirectory = path.join(currentDirectory, "..", "storage", "uploads");
export const MAX_STL_FILE_SIZE = 50 * 1024 * 1024;
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

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
        code: fileTooLarge ? "STL_TOO_LARGE" : "INVALID_UPLOAD",
        message: fileTooLarge
          ? "Il file STL non puo superare 50 MB."
          : "La richiesta di caricamento non e valida.",
      },
    });
  }

  if (error instanceof CustomModelError) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }

  console.error(error);
  return response.status(500).json({
    error: { code: "UPLOAD_FAILED", message: "Impossibile salvare il modello STL." },
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

export async function isValidStlFile(filename) {
  const fileStats = await stat(filename);
  if (fileStats.size < 15 || fileStats.size > MAX_STL_FILE_SIZE) {
    return false;
  }

  const file = await open(filename, "r");
  try {
    const sampleSize = Math.min(fileStats.size, 4096);
    const sample = Buffer.alloc(sampleSize);
    await file.read(sample, 0, sampleSize, 0);

    if (fileStats.size >= 84) {
      const triangleCount = sample.readUInt32LE(80);
      const expectedBinarySize = 84 + triangleCount * 50;
      if (triangleCount > 0 && expectedBinarySize === fileStats.size) {
        return true;
      }
    }

    const asciiSample = sample.toString("utf8").trimStart().toLowerCase();
    return (
      asciiSample.startsWith("solid") &&
      asciiSample.includes("facet") &&
      asciiSample.includes("vertex")
    );
  } finally {
    await file.close();
  }
}

export async function cleanupExpiredUploads(uploadDirectory, now = Date.now()) {
  const entries = await readdir(uploadDirectory, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".stl"))
      .map(async (entry) => {
        const filename = path.join(uploadDirectory, entry.name);
        const fileStats = await stat(filename);
        if (now - fileStats.mtimeMs > UPLOAD_TTL_MS) {
          await unlink(filename);
        }
      }),
  );
}

export function registerCustomModelRoutes(app, uploadDirectory = defaultUploadDirectory) {
  mkdirSync(uploadDirectory, { recursive: true });
  cleanupExpiredUploads(uploadDirectory).catch((error) => {
    console.error("Pulizia degli upload temporanei non riuscita.", error);
  });

  const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, _file, callback) => callback(null, `${crypto.randomUUID()}.stl`),
  });
  const upload = multer({
    storage,
    limits: { fileSize: MAX_STL_FILE_SIZE, files: 1, fields: 0, parts: 2 },
    fileFilter: (_request, file, callback) => {
      if (path.extname(file.originalname).toLowerCase() !== ".stl") {
        callback(new CustomModelError("INVALID_STL_EXTENSION", "Il file deve avere estensione .stl."));
        return;
      }
      callback(null, true);
    },
  });

  app.use(
    "/uploads",
    express.static(uploadDirectory, {
      dotfiles: "deny",
      index: false,
      setHeaders: (response) => {
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Content-Type", "model/stl");
        response.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );

  app.post("/api/custom-models/upload", (request, response) => {
    upload.single("model")(request, response, async (uploadError) => {
      if (uploadError) {
        return sendError(response, uploadError);
      }
      if (!request.file) {
        return sendError(
          response,
          new CustomModelError("STL_REQUIRED", "Seleziona un file STL da caricare."),
        );
      }

      try {
        if (!(await isValidStlFile(request.file.path))) {
          throw new CustomModelError(
            "INVALID_STL_CONTENT",
            "Il file non contiene una struttura STL valida.",
          );
        }
        await cleanupExpiredUploads(uploadDirectory);
        const id = path.basename(request.file.filename, ".stl");
        return response.status(201).json({
          data: {
            id,
            name: path.basename(request.file.originalname.replaceAll("\\", "/")).slice(0, 120),
            modelUrl: `/uploads/${request.file.filename}`,
            expiresAt: new Date(Date.now() + UPLOAD_TTL_MS).toISOString(),
          },
        });
      } catch (error) {
        await unlink(request.file.path).catch(() => {});
        return sendError(response, error);
      }
    });
  });

  app.post("/api/custom-models/link", (request, response) => {
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
      await unlink(path.join(uploadDirectory, `${request.params.id}.stl`));
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
