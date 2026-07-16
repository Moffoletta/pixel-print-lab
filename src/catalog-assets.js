import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import sharp from "sharp";
import { isValidStlFile, MAX_STL_FILE_SIZE } from "./custom-model-routes.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_LIMIT = 5 * 1024 * 1024;
const ASSET_PREFIX = "/catalog-assets/";
const extensions = {
  image: new Set([".jpg", ".jpeg", ".png", ".webp"]),
  model: new Set([".stl"]),
};

export const defaultCatalogDirectory = path.join(currentDirectory, "..", "storage", "catalog");

export class CatalogAssetError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function registerCatalogAssetServing(app, catalogDirectory = defaultCatalogDirectory) {
  mkdirSync(catalogDirectory, { recursive: true });
  app.use(
    ASSET_PREFIX.slice(0, -1),
    express.static(catalogDirectory, {
      dotfiles: "deny",
      index: false,
      immutable: true,
      maxAge: "1y",
      setHeaders: (response) => response.setHeader("X-Content-Type-Options", "nosniff"),
    }),
  );
}

export function createCatalogUpload(catalogDirectory = defaultCatalogDirectory) {
  mkdirSync(catalogDirectory, { recursive: true });
  const storage = multer.diskStorage({
    destination: catalogDirectory,
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const safeExtension = extensions[file.fieldname]?.has(extension) ? extension.replace(".jpeg", ".jpg") : ".bin";
      callback(null, `${crypto.randomUUID()}${safeExtension}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: MAX_STL_FILE_SIZE, files: 2, fields: 20, parts: 23 },
  }).fields([{ name: "image", maxCount: 1 }, { name: "model", maxCount: 1 }]);
}

async function detectImageExtension(filename) {
  const fileStats = await stat(filename);
  if (fileStats.size < 20 || fileStats.size > IMAGE_LIMIT) return null;
  try {
    const image = sharp(filename, { failOn: "error", limitInputPixels: 20_000_000 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !["png", "jpeg", "webp"].includes(metadata.format)) return null;
    await image.stats();
    return metadata.format === "jpeg" ? ".jpg" : `.${metadata.format}`;
  } catch {
    return null;
  }
}

export async function validateCatalogFiles(files = {}) {
  const image = files.image?.[0];
  const model = files.model?.[0];
  if (image) {
    const declaredExtension = path.extname(image.originalname).toLowerCase().replace(".jpeg", ".jpg");
    const detectedExtension = await detectImageExtension(image.path);
    if (!extensions.image.has(path.extname(image.originalname).toLowerCase()) || detectedExtension !== declaredExtension) {
      throw new CatalogAssetError("INVALID_CATALOG_IMAGE", "L'immagine deve essere PNG, JPG o WebP valida e non superare 5 MB.");
    }
  }
  if (model && (!extensions.model.has(path.extname(model.originalname).toLowerCase()) || !(await isValidStlFile(model.path)))) {
    throw new CatalogAssetError("INVALID_CATALOG_MODEL", "Il modello deve essere un file STL valido e non superare 50 MB.");
  }
  return {
    imageUrl: image ? `${ASSET_PREFIX}${image.filename}` : null,
    modelUrl: model ? `${ASSET_PREFIX}${model.filename}` : null,
  };
}

export function getUploadedPaths(files = {}) {
  return Object.values(files).flat().map((file) => file.path);
}

export function managedAssetPath(url, catalogDirectory = defaultCatalogDirectory) {
  if (typeof url !== "string" || !/^\/catalog-assets\/[0-9a-f-]+\.(?:jpg|png|webp|stl)$/i.test(url)) return null;
  return path.join(catalogDirectory, path.basename(url));
}

export async function removeFiles(filenames) {
  await Promise.all(filenames.filter(Boolean).map((filename) => unlink(filename).catch((error) => {
    if (error.code !== "ENOENT") console.error(error);
  })));
}
