import crypto from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildEmail,
  defaultEmailOutboxDirectory,
  defaultOrderFileDirectory,
  validatePersonName,
  validateQuantity,
} from "./order-routes.js";

const SESSION_COOKIE = "ppl_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

class AdminError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function sendError(response, error) {
  if (error instanceof AdminError) {
    return response.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  console.error(error);
  return response.status(500).json({
    error: { code: "ADMIN_OPERATION_FAILED", message: "Operazione amministrativa non riuscita." },
  });
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator === -1) return [part, ""];
        let value = part.slice(separator + 1);
        try {
          value = decodeURIComponent(value);
        } catch {
          value = "";
        }
        return [part.slice(0, separator), value];
      }),
  );
}

function passwordMatches(candidate, configuredPassword) {
  if (typeof candidate !== "string" || typeof configuredPassword !== "string") {
    return false;
  }
  const candidateHash = crypto.createHash("sha256").update(candidate).digest();
  const configuredHash = crypto.createHash("sha256").update(configuredPassword).digest();
  return crypto.timingSafeEqual(candidateHash, configuredHash);
}

function serializeItem(item) {
  return {
    id: item.id,
    position: item.position,
    itemType: item.item_type,
    productId: item.product_id,
    productCode: item.product_code,
    productName: item.product_name,
    unitPriceCents: item.unit_price_cents,
    colorId: item.color_id,
    colorName: item.color_name,
    colorHex: item.color_hex,
    quantity: item.quantity,
    originalName: item.original_name,
    sourceName: item.source_name,
    externalUrl: item.external_url,
    hasModel: Boolean(item.model_filename),
  };
}

export function registerAdminRoutes(
  app,
  {
    database,
    adminPassword,
    orderFileDirectory = defaultOrderFileDirectory,
    emailOutboxDirectory = defaultEmailOutboxDirectory,
  },
) {
  const sessions = new Map();
  const loginAttempts = new Map();
  const findOrder = database.prepare("SELECT * FROM orders WHERE id = ?");
  const listItems = database.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY position");
  const findItem = database.prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?");
  const findProduct = database.prepare(`
    SELECT id, code, name, price_cents FROM products WHERE id = ? AND visible = 1
  `);
  const findColor = database.prepare(`
    SELECT id, name, hex_value FROM colors WHERE id = ? AND active = 1
  `);
  const updateOrder = database.prepare(`
    UPDATE orders
    SET first_name = @firstName, last_name = @lastName, catalog_total_cents = @catalogTotalCents
    WHERE id = @id
  `);
  const deleteItems = database.prepare("DELETE FROM order_items WHERE order_id = ?");
  const insertItem = database.prepare(`
    INSERT INTO order_items (
      order_id, position, item_type, product_id, product_code, product_name,
      unit_price_cents, color_id, color_name, color_hex, quantity,
      original_name, source_name, external_url, model_filename
    ) VALUES (
      @orderId, @position, @itemType, @productId, @productCode, @productName,
      @unitPriceCents, @colorId, @colorName, @colorHex, @quantity,
      @originalName, @sourceName, @externalUrl, @modelFilename
    )
  `);
  const replaceOrder = database.transaction((order) => {
    updateOrder.run(order);
    deleteItems.run(order.id);
    order.items.forEach((item, index) => {
      insertItem.run({ ...item, orderId: order.id, position: index + 1 });
    });
  });

  function pruneSessions() {
    const now = Date.now();
    for (const [token, expiresAt] of sessions) {
      if (expiresAt <= now) sessions.delete(token);
    }
  }

  function requireAdmin(request, response, next) {
    pruneSessions();
    const token = parseCookies(request)[SESSION_COOKIE];
    if (!token || !sessions.has(token)) {
      response.status(401).json({
        error: { code: "ADMIN_AUTH_REQUIRED", message: "Accesso amministrativo richiesto." },
      });
      return;
    }
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    response.setHeader("Cache-Control", "no-store");
    request.adminSessionToken = token;
    next();
  }

  app.post("/api/admin/login", (request, response) => {
    if (typeof adminPassword !== "string" || adminPassword.length === 0) {
      return response.status(503).json({
        error: {
          code: "ADMIN_NOT_CONFIGURED",
          message: "Imposta ADMIN_PASSWORD prima di usare il pannello amministrativo.",
        },
      });
    }

    const key = request.ip;
    const now = Date.now();
    const attempt = loginAttempts.get(key);
    if (attempt && attempt.resetAt > now && attempt.count >= MAX_LOGIN_ATTEMPTS) {
      return response.status(429).json({
        error: { code: "LOGIN_RATE_LIMITED", message: "Troppi tentativi. Riprova piu tardi." },
      });
    }
    if (!passwordMatches(request.body?.password, adminPassword)) {
      const current = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + LOGIN_WINDOW_MS };
      loginAttempts.set(key, { ...current, count: current.count + 1 });
      return response.status(401).json({
        error: { code: "INVALID_ADMIN_PASSWORD", message: "Password non corretta." },
      });
    }

    loginAttempts.delete(key);
    const token = crypto.randomBytes(32).toString("base64url");
    sessions.set(token, now + SESSION_TTL_MS);
    const secure = request.secure || request.headers["x-forwarded-proto"] === "https";
    response.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure ? "; Secure" : ""}`,
    );
    return response.status(201).json({ data: { authenticated: true } });
  });

  app.post("/api/admin/logout", requireAdmin, (request, response) => {
    sessions.delete(request.adminSessionToken);
    response.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    );
    return response.status(204).end();
  });

  app.get("/api/admin/session", requireAdmin, (_request, response) => {
    response.json({ data: { authenticated: true } });
  });

  app.get("/api/admin/orders", requireAdmin, (_request, response) => {
    const orders = database
      .prepare(`
        SELECT
          orders.*,
          COUNT(order_items.id) AS item_count,
          COALESCE(SUM(order_items.quantity), 0) AS piece_count
        FROM orders
        LEFT JOIN order_items ON order_items.order_id = orders.id
        GROUP BY orders.id
        ORDER BY orders.created_at DESC, orders.id DESC
      `)
      .all()
      .map((order) => ({
        id: order.id,
        code: order.code,
        firstName: order.first_name,
        lastName: order.last_name,
        catalogTotalCents: order.catalog_total_cents,
        itemCount: order.item_count,
        pieceCount: order.piece_count,
        createdAt: order.created_at,
      }));
    response.json({ data: orders, count: orders.length });
  });

  app.get("/api/admin/orders/:id", requireAdmin, (request, response) => {
    const id = Number.parseInt(request.params.id, 10);
    const order = Number.isInteger(id) ? findOrder.get(id) : undefined;
    if (!order) return sendError(response, new AdminError("ORDER_NOT_FOUND", "Richiesta non trovata.", 404));
    response.json({
      data: {
        id: order.id,
        code: order.code,
        firstName: order.first_name,
        lastName: order.last_name,
        catalogTotalCents: order.catalog_total_cents,
        createdAt: order.created_at,
        items: listItems.all(order.id).map(serializeItem),
      },
    });
  });

  app.get("/api/admin/orders/:orderId/items/:itemId/model", requireAdmin, (request, response) => {
    const orderId = Number.parseInt(request.params.orderId, 10);
    const itemId = Number.parseInt(request.params.itemId, 10);
    const item = findItem.get(itemId, orderId);
    if (!item?.model_filename) {
      return sendError(response, new AdminError("MODEL_NOT_FOUND", "File STL non trovato.", 404));
    }
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Type", "model/stl");
    return response.sendFile(path.join(orderFileDirectory, item.model_filename));
  });

  app.put("/api/admin/orders/:id", requireAdmin, async (request, response) => {
    try {
      const id = Number.parseInt(request.params.id, 10);
      const existingOrder = Number.isInteger(id) ? findOrder.get(id) : undefined;
      if (!existingOrder) throw new AdminError("ORDER_NOT_FOUND", "Richiesta non trovata.", 404);
      const firstName = validatePersonName(request.body?.firstName, "Il nome");
      const lastName = validatePersonName(request.body?.lastName, "Il cognome");
      if (!Array.isArray(request.body?.items) || request.body.items.length < 1 || request.body.items.length > 100) {
        throw new AdminError("INVALID_ORDER_ITEMS", "La richiesta deve contenere da 1 a 100 elementi.");
      }

      const existingItems = listItems.all(id);
      const existingById = new Map(existingItems.map((item) => [item.id, item]));
      const seen = new Set();
      const items = request.body.items.map((item) => {
        let quantity;
        try {
          quantity = validateQuantity(item?.quantity);
        } catch (error) {
          throw new AdminError("INVALID_QUANTITY", error.message);
        }
        const color = Number.isInteger(item?.colorId) ? findColor.get(item.colorId) : undefined;
        if (!color) throw new AdminError("COLOR_UNAVAILABLE", "Il colore selezionato non e disponibile.");

        if (item.itemType === "catalog") {
          const product = Number.isInteger(item.productId) ? findProduct.get(item.productId) : undefined;
          if (!product) throw new AdminError("PRODUCT_UNAVAILABLE", "Il prodotto selezionato non e disponibile.");
          const key = `catalog:${product.id}:${color.id}`;
          if (seen.has(key)) throw new AdminError("DUPLICATE_ITEM", "Sono presenti righe duplicate.");
          seen.add(key);
          return {
            itemType: "catalog",
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            unitPriceCents: product.price_cents,
            colorId: color.id,
            colorName: color.name,
            colorHex: color.hex_value,
            quantity,
            originalName: null,
            sourceName: null,
            externalUrl: null,
            modelFilename: null,
          };
        }

        const existing = Number.isInteger(item.id) ? existingById.get(item.id) : undefined;
        if (!existing || existing.item_type !== item.itemType || item.itemType === "catalog") {
          throw new AdminError("INVALID_ORDER_ITEM", "Una riga personalizzata non e valida.");
        }
        const key = `custom:${existing.id}`;
        if (seen.has(key)) throw new AdminError("DUPLICATE_ITEM", "Sono presenti righe duplicate.");
        seen.add(key);
        return {
          itemType: existing.item_type,
          productId: null,
          productCode: null,
          productName: existing.product_name,
          unitPriceCents: null,
          colorId: color.id,
          colorName: color.name,
          colorHex: color.hex_value,
          quantity,
          originalName: existing.original_name,
          sourceName: existing.source_name,
          externalUrl: existing.external_url,
          modelFilename: existing.model_filename,
        };
      });

      const catalogTotalCents = items.reduce(
        (total, item) => item.unitPriceCents === null ? total : total + item.unitPriceCents * item.quantity,
        0,
      );
      replaceOrder({ id, firstName, lastName, catalogTotalCents, items });

      const retainedModels = new Set(items.map((item) => item.modelFilename).filter(Boolean));
      const removedModels = new Set(
        existingItems.map((item) => item.model_filename).filter((name) => name && !retainedModels.has(name)),
      );
      await Promise.all(
        [...removedModels].map(async (filename) => {
          const references = database
            .prepare("SELECT COUNT(*) AS count FROM order_items WHERE model_filename = ?")
            .get(filename).count;
          if (references === 0) await unlink(path.join(orderFileDirectory, filename)).catch(console.error);
        }),
      );

      const email = buildEmail({
        code: existingOrder.code,
        firstName,
        lastName,
        catalogTotalCents,
        items,
      });
      await writeFile(path.join(emailOutboxDirectory, `${existingOrder.code}.txt`), email).catch(console.error);
      response.json({ data: { id, code: existingOrder.code } });
    } catch (error) {
      if (error?.code === "INVALID_CUSTOMER") {
        return sendError(response, new AdminError(error.code, error.message));
      }
      return sendError(response, error);
    }
  });

  app.delete("/api/admin/orders/:id", requireAdmin, async (request, response) => {
    try {
      const id = Number.parseInt(request.params.id, 10);
      const order = Number.isInteger(id) ? findOrder.get(id) : undefined;
      if (!order) throw new AdminError("ORDER_NOT_FOUND", "Richiesta non trovata.", 404);
      const modelFilenames = new Set(
        listItems.all(id).map((item) => item.model_filename).filter(Boolean),
      );
      database.prepare("DELETE FROM orders WHERE id = ?").run(id);
      await Promise.all([
        ...[...modelFilenames].map((filename) =>
          unlink(path.join(orderFileDirectory, filename)).catch(console.error),
        ),
        unlink(path.join(emailOutboxDirectory, `${order.code}.txt`)).catch((error) => {
          if (error.code !== "ENOENT") console.error(error);
        }),
      ]);
      response.status(204).end();
    } catch (error) {
      return sendError(response, error);
    }
  });
}
