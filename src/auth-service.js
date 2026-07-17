import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = "ppl_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_KEY_LENGTH = 64;
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/;
const DUMMY_PASSWORD_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$KeZz9UqPc9MxmhAJcEbr5s8vLnEhZQGY8nGwjvP2mV8oMsqSx9yknajYdTBCpT7tJYwo4M5GsqTzSZsXj8L98A";

export class AuthError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
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
        try {
          return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
        } catch {
          return [part.slice(0, separator), ""];
        }
      }),
  );
}

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username)) {
    throw new AuthError(
      "INVALID_USERNAME",
      "Il nome utente deve contenere da 3 a 32 caratteri: lettere, numeri, punto, trattino o underscore.",
    );
  }
  return username;
}

function validateName(value, label) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (name.length < 1 || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new AuthError("INVALID_ACCOUNT_NAME", `${label} deve contenere da 1 a 60 caratteri.`);
  }
  return name;
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) {
    throw new AuthError("INVALID_PASSWORD", "La password deve contenere da 10 a 128 caratteri.");
  }
  return value;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT_KEY_LENGTH, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function verifyPassword(password, storedHash = DUMMY_PASSWORD_HASH) {
  const [algorithm, n, r, p, saltValue, keyValue] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !keyValue) return false;
  try {
    const expected = Buffer.from(keyValue, "base64url");
    const actual = await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function credentialMatches(candidate, configuredValue) {
  if (typeof candidate !== "string" || typeof configuredValue !== "string") return false;
  const candidateHash = crypto.createHash("sha256").update(candidate).digest();
  const configuredHash = crypto.createHash("sha256").update(configuredValue).digest();
  return crypto.timingSafeEqual(candidateHash, configuredHash);
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function serializeAccount(account) {
  return {
    id: account.id,
    username: account.username,
    firstName: account.first_name,
    lastName: account.last_name,
    role: account.role,
  };
}

export function createAuthService({ database, adminUsername, adminPassword }) {
  const configuredAdminUsername = normalizeUsername(adminUsername);
  const adminConfigured = configuredAdminUsername.length > 0 && typeof adminPassword === "string" && adminPassword.length > 0;
  const findAccountByUsername = database.prepare("SELECT * FROM user_accounts WHERE username = ? COLLATE NOCASE");
  const findEnvironmentAccount = database.prepare(`
    SELECT * FROM user_accounts WHERE auth_source = 'environment' ORDER BY id LIMIT 1
  `);
  const findSession = database.prepare(`
    SELECT user_accounts.*
    FROM user_sessions
    JOIN user_accounts ON user_accounts.id = user_sessions.user_account_id
    WHERE user_sessions.token_hash = ? AND user_sessions.expires_at > ?
  `);
  const insertLocalAccount = database.prepare(`
    INSERT INTO user_accounts (username, password_hash, first_name, last_name)
    VALUES (@username, @passwordHash, @firstName, @lastName)
  `);
  const insertEnvironmentAdmin = database.prepare(`
    INSERT INTO user_accounts (username, password_hash, first_name, last_name, role, auth_source)
    VALUES (@username, NULL, @firstName, @lastName, 'admin', 'environment')
  `);
  const reactivateEnvironmentAdmin = database.prepare(`
    UPDATE user_accounts
    SET username = @username, first_name = @firstName, last_name = @lastName,
      role = 'admin', updated_at = CURRENT_TIMESTAMP
    WHERE id = @id AND auth_source = 'environment'
  `);
  const reactivateCurrentEnvironmentAdmin = database.prepare(`
    UPDATE user_accounts
    SET role = 'admin', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND auth_source = 'environment'
  `);
  const insertSession = database.prepare(`
    INSERT INTO user_sessions (token_hash, user_account_id, expires_at)
    VALUES (?, ?, ?)
  `);
  const deleteSession = database.prepare("DELETE FROM user_sessions WHERE token_hash = ?");
  const deleteExpiredSessions = database.prepare("DELETE FROM user_sessions WHERE expires_at <= ?");

  database.exec(`
    DELETE FROM user_sessions
    WHERE user_account_id IN (
      SELECT id FROM user_accounts WHERE auth_source = 'environment'
    );
    UPDATE user_accounts
    SET role = 'customer', updated_at = CURRENT_TIMESTAMP
    WHERE auth_source = 'environment';
  `);

  function environmentAdmin() {
    const existing = findAccountByUsername.get(configuredAdminUsername);
    if (existing && existing.auth_source !== "environment") {
      throw new AuthError(
        "ADMIN_ACCOUNT_CONFLICT",
        "ADMIN_USERNAME coincide con un account cliente esistente. Configura un nome utente amministrativo diverso.",
        503,
      );
    }
    if (existing) {
      reactivateCurrentEnvironmentAdmin.run(existing.id);
      return findAccountByUsername.get(configuredAdminUsername);
    }
    const previousEnvironmentAccount = findEnvironmentAccount.get();
    if (previousEnvironmentAccount) {
      reactivateEnvironmentAdmin.run({
        id: previousEnvironmentAccount.id,
        username: configuredAdminUsername,
        firstName: configuredAdminUsername,
        lastName: "Admin",
      });
      return findAccountByUsername.get(configuredAdminUsername);
    }
    const id = Number(insertEnvironmentAdmin.run({
      username: configuredAdminUsername,
      firstName: configuredAdminUsername,
      lastName: "Admin",
    }).lastInsertRowid);
    return database.prepare("SELECT * FROM user_accounts WHERE id = ?").get(id);
  }

  function setSessionCookie(request, response, token, maxAgeSeconds = SESSION_TTL_MS / 1000) {
    const secure = request.secure;
    response.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`,
    );
  }

  function createSession(request, response, account) {
    deleteExpiredSessions.run(Date.now());
    const previousSession = accountFromRequest(request);
    if (previousSession) deleteSession.run(tokenHash(previousSession.token));
    const token = crypto.randomBytes(32).toString("base64url");
    insertSession.run(tokenHash(token), account.id, Date.now() + SESSION_TTL_MS);
    setSessionCookie(request, response, token);
    return serializeAccount(account);
  }

  function accountFromRequest(request) {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (!token) return null;
    const account = findSession.get(tokenHash(token), Date.now());
    return { account: account ?? null, token };
  }

  async function register({ username: rawUsername, password: rawPassword, firstName, lastName }) {
    const username = validateUsername(rawUsername);
    if (adminConfigured && username === configuredAdminUsername) {
      throw new AuthError("USERNAME_UNAVAILABLE", "Il nome utente non e disponibile.", 409);
    }
    if (findAccountByUsername.get(username)) {
      throw new AuthError("USERNAME_UNAVAILABLE", "Il nome utente non e disponibile.", 409);
    }
    const password = validatePassword(rawPassword);
    const values = {
      username,
      passwordHash: await hashPassword(password),
      firstName: validateName(firstName, "Il nome"),
      lastName: validateName(lastName, "Il cognome"),
    };
    try {
      const id = Number(insertLocalAccount.run(values).lastInsertRowid);
      return database.prepare("SELECT * FROM user_accounts WHERE id = ?").get(id);
    } catch (error) {
      if (error?.code?.startsWith("SQLITE_CONSTRAINT")) {
        throw new AuthError("USERNAME_UNAVAILABLE", "Il nome utente non e disponibile.", 409);
      }
      throw error;
    }
  }

  async function login(usernameValue, passwordValue, { adminOnly = false } = {}) {
    const username = normalizeUsername(usernameValue);
    const password = typeof passwordValue === "string" ? passwordValue : "";
    if (
      adminConfigured && username === configuredAdminUsername &&
      credentialMatches(password, adminPassword)
    ) {
      return environmentAdmin();
    }

    if (adminOnly) {
      throw new AuthError("INVALID_CREDENTIALS", "Nome utente o password non corretti.", 401);
    }
    const account = findAccountByUsername.get(username);
    const valid = account?.auth_source === "local"
      ? await verifyPassword(password, account.password_hash)
      : await verifyPassword(password);
    if (!valid) {
      throw new AuthError("INVALID_CREDENTIALS", "Nome utente o password non corretti.", 401);
    }
    return account;
  }

  function optionalAccount(request, _response, next) {
    const session = accountFromRequest(request);
    if (session && !session.account) {
      setSessionCookie(request, _response, "", 0);
      _response.status(401).json({
        error: { code: "SESSION_EXPIRED", message: "La sessione e scaduta. Accedi di nuovo prima di inviare l'ordine." },
      });
      return;
    }
    request.userAccount = session?.account ?? null;
    request.userSessionToken = session?.token ?? null;
    next();
  }

  function requireAccount(request, response, next) {
    optionalAccount(request, response, () => {
      if (!request.userAccount) {
        response.status(401).json({
          error: { code: "AUTH_REQUIRED", message: "Accedi per continuare." },
        });
        return;
      }
      response.setHeader("Cache-Control", "no-store");
      next();
    });
  }

  function requireAdmin(request, response, next) {
    requireAccount(request, response, () => {
      if (request.userAccount.role !== "admin" || request.userAccount.auth_source !== "environment") {
        response.status(403).json({
          error: { code: "ADMIN_AUTH_REQUIRED", message: "Accesso amministrativo richiesto." },
        });
        return;
      }
      next();
    });
  }

  function logout(request, response) {
    const session = accountFromRequest(request);
    if (session) deleteSession.run(tokenHash(session.token));
    setSessionCookie(request, response, "", 0);
  }

  return {
    adminConfigured,
    createSession,
    login,
    logout,
    optionalAccount,
    register,
    requireAccount,
    requireAdmin,
    serializeAccount,
    isAdminUsername: (username) => adminConfigured && normalizeUsername(username) === configuredAdminUsername,
  };
}
