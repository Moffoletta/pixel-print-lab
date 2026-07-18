import { AuthError } from "./auth-service.js";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;
const MAX_REGISTRATIONS = 5;

function sendAuthError(response, error) {
  if (error instanceof AuthError) {
    return response.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  console.error(error);
  return response.status(500).json({
    error: { code: "AUTH_FAILED", message: "Operazione account non riuscita." },
  });
}

function serializeOrder(order, items) {
  return {
    id: order.id,
    code: order.code,
    firstName: order.first_name,
    lastName: order.last_name,
    catalogTotalCents: order.catalog_total_cents,
    status: order.status,
    createdAt: order.created_at,
    items: items.map((item) => ({
      id: item.id,
      itemType: item.item_type,
      productName: item.product_name,
      colorName: item.color_name,
      colorHex: item.color_hex,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      originalName: item.original_name,
      sourceName: item.source_name,
    })),
  };
}

export function registerAccountRoutes(app, { database, auth }) {
  const accountLoginAttempts = new Map();
  const adminLoginAttempts = new Map();
  const registrationAttempts = new Map();
  const listOrders = database.prepare(`
    SELECT * FROM orders
    WHERE user_account_id = ?
    ORDER BY created_at DESC, id DESC
  `);
  const listItems = database.prepare(`
    SELECT * FROM order_items WHERE order_id = ? ORDER BY position
  `);

  function checkRateLimit(attempts, key, maximum, message) {
    const now = Date.now();
    for (const [entryKey, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(entryKey);
    }
    const attempt = attempts.get(key);
    if (attempt && attempt.resetAt > now && attempt.count >= maximum) {
      throw new AuthError("RATE_LIMITED", message, 429);
    }
    return { key, now, attempt };
  }

  function recordAttempt(attempts, { key, now, attempt }, windowMs) {
    const current = attempt && attempt.resetAt > now
      ? attempt
      : { count: 0, resetAt: now + windowMs };
    attempts.set(key, { ...current, count: current.count + 1 });
  }

  async function handleLogin(request, response, adminOnly = false) {
    let rateLimit;
    let attempts;
    try {
      if (adminOnly && !auth.adminConfigured) {
        throw new AuthError(
          "ADMIN_NOT_CONFIGURED",
          "Imposta ADMIN_USERNAME e ADMIN_PASSWORD prima di usare il pannello amministrativo.",
          503,
        );
      }
      const username = typeof request.body?.username === "string" ? request.body.username.trim().toLowerCase() : "";
      attempts = adminOnly || auth.isAdminUsername(username) ? adminLoginAttempts : accountLoginAttempts;
      rateLimit = checkRateLimit(
        attempts,
        `${request.ip}:${username}`,
        MAX_LOGIN_ATTEMPTS,
        "Troppi tentativi. Riprova piu tardi.",
      );
      recordAttempt(attempts, rateLimit, LOGIN_WINDOW_MS);
      const account = await auth.login(request.body?.username, request.body?.password, { adminOnly });
      attempts.delete(rateLimit.key);
      return response.status(201).json({ data: auth.createSession(request, response, account) });
    } catch (error) {
      if (rateLimit && error instanceof AuthError && error.code === "INVALID_CREDENTIALS" && adminOnly) {
        error.code = "INVALID_ADMIN_CREDENTIALS";
      }
      return sendAuthError(response, error);
    }
  }

  app.post("/api/account/register", async (request, response) => {
    try {
      const rateLimit = checkRateLimit(
        registrationAttempts,
        request.ip,
        MAX_REGISTRATIONS,
        "Troppe registrazioni. Riprova piu tardi.",
      );
      recordAttempt(registrationAttempts, rateLimit, REGISTRATION_WINDOW_MS);
      const account = await auth.register(request.body ?? {});
      return response.status(201).json({ data: auth.createSession(request, response, account) });
    } catch (error) {
      return sendAuthError(response, error);
    }
  });

  app.post("/api/account/login", (request, response) => handleLogin(request, response));

  app.post("/api/account/logout", (request, response) => {
    auth.logout(request, response);
    return response.status(204).end();
  });

  app.get("/api/account/session", auth.requireAccount, (request, response) => {
    response.json({ data: auth.serializeAccount(request.userAccount) });
  });

  app.get("/api/account/orders", auth.requireAccount, (request, response) => {
    const orders = listOrders.all(request.userAccount.id).map((order) =>
      serializeOrder(order, listItems.all(order.id))
    );
    response.json({ data: orders, count: orders.length });
  });

  app.put("/api/account/password", auth.requireAccount, async (request, response) => {
    try {
      const result = await auth.changePassword({
        account: request.userAccount,
        currentPassword: request.body?.currentPassword,
        newPassword: request.body?.newPassword,
        currentSessionToken: request.userSessionToken,
      });
      return response.json({ data: result });
    } catch (error) {
      return sendAuthError(response, error);
    }
  });

  app.post("/api/admin/login", (request, response) => handleLogin(request, response, true));

  app.post("/api/admin/logout", auth.requireAdmin, (request, response) => {
    auth.logout(request, response);
    return response.status(204).end();
  });

  app.get("/api/admin/session", auth.requireAdmin, (request, response) => {
    response.json({ data: auth.serializeAccount(request.userAccount) });
  });
}
