import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerCatalogRoutes } from "./catalog-routes.js";
import { registerCustomModelRoutes } from "./custom-model-routes.js";
import { registerOrderRoutes } from "./order-routes.js";
import { registerAdminRoutes } from "./admin-routes.js";
import { registerCatalogAssetServing } from "./catalog-assets.js";
import { createAuthService } from "./auth-service.js";
import { registerAccountRoutes } from "./account-routes.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(currentDirectory, "..", "public");
const threeDirectory = path.join(currentDirectory, "..", "node_modules", "three");

export function createApp({
  database,
  uploadDirectory,
  orderFileDirectory,
  catalogDirectory,
  adminUsername,
  adminPassword,
  trustProxy = false,
  emailService,
} = {}) {
  if (!database) {
    throw new TypeError("createApp richiede una connessione al database");
  }

  const app = express();
  const auth = createAuthService({ database, adminUsername, adminPassword });

  app.disable("x-powered-by");
  if (trustProxy) app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  registerCatalogAssetServing(app, catalogDirectory);
  app.use("/vendor/three/build", express.static(path.join(threeDirectory, "build")));
  app.use("/vendor/three/examples/jsm", express.static(path.join(threeDirectory, "examples", "jsm")));
  app.use(express.static(publicDirectory));
  registerCustomModelRoutes(app, uploadDirectory);

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  registerCatalogRoutes(app, database);
  registerAccountRoutes(app, { database, auth });
  registerOrderRoutes(app, {
    database,
    uploadDirectory,
    orderFileDirectory,
    emailService,
    optionalAccount: auth.optionalAccount,
  });
  registerAdminRoutes(app, {
    database,
    requireAdmin: auth.requireAdmin,
    catalogDirectory,
    orderFileDirectory,
    emailService,
  });

  return app;
}
