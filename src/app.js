import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerCatalogRoutes } from "./catalog-routes.js";
import { registerCustomModelRoutes } from "./custom-model-routes.js";
import { registerOrderRoutes } from "./order-routes.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(currentDirectory, "..", "public");
const threeDirectory = path.join(currentDirectory, "..", "node_modules", "three");

export function createApp({
  database,
  uploadDirectory,
  orderFileDirectory,
  emailOutboxDirectory,
} = {}) {
  if (!database) {
    throw new TypeError("createApp richiede una connessione al database");
  }

  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/vendor/three/build", express.static(path.join(threeDirectory, "build")));
  app.use("/vendor/three/examples/jsm", express.static(path.join(threeDirectory, "examples", "jsm")));
  app.use(express.static(publicDirectory));
  registerCustomModelRoutes(app, uploadDirectory);

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  registerCatalogRoutes(app, database);
  registerOrderRoutes(app, {
    database,
    uploadDirectory,
    orderFileDirectory,
    emailOutboxDirectory,
  });

  return app;
}
