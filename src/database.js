import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultDatabasePath = path.join(currentDirectory, "..", "data", "pixel-print-lab.db");

const migrations = [
  {
    version: 1,
    name: "create_catalog",
    sql: `
      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        image_url TEXT NOT NULL,
        image_alt TEXT NOT NULL,
        dimension_label TEXT NOT NULL,
        dimension_value TEXT NOT NULL,
        material TEXT NOT NULL,
        model_url TEXT,
        visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE colors (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        hex_value TEXT NOT NULL CHECK (hex_value GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX products_visible_sort_idx ON products (visible, sort_order, id);
      CREATE INDEX colors_active_sort_idx ON colors (active, sort_order, id);
    `,
  },
  {
    version: 2,
    name: "add_demo_model_urls",
    sql: `
      UPDATE products
      SET model_url = '/models/vaso-orbitale.stl', updated_at = CURRENT_TIMESTAMP
      WHERE slug = 'vaso-orbitale' AND model_url IS NULL;

      UPDATE products
      SET model_url = '/models/supporto-controller.stl', updated_at = CURRENT_TIMESTAMP
      WHERE slug = 'supporto-controller' AND model_url IS NULL;
    `,
  },
  {
    version: 3,
    name: "create_orders",
    sql: `
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        catalog_total_cents INTEGER NOT NULL CHECK (catalog_total_cents >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY,
        order_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        item_type TEXT NOT NULL CHECK (item_type IN ('catalog', 'custom_file', 'custom_link')),
        product_id INTEGER,
        product_code TEXT,
        product_name TEXT NOT NULL,
        unit_price_cents INTEGER CHECK (unit_price_cents IS NULL OR unit_price_cents >= 0),
        color_id INTEGER NOT NULL,
        color_name TEXT NOT NULL,
        color_hex TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
        original_name TEXT,
        source_name TEXT,
        external_url TEXT,
        model_filename TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        UNIQUE (order_id, position)
      );

      CREATE INDEX orders_created_at_idx ON orders (created_at DESC, id DESC);
      CREATE INDEX order_items_order_idx ON order_items (order_id, position);
    `,
  },
  {
    version: 4,
    name: "prevent_catalog_id_reuse",
    sql: `
      DROP INDEX products_visible_sort_idx;
      DROP INDEX colors_active_sort_idx;

      ALTER TABLE products RENAME TO products_legacy;
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        image_url TEXT NOT NULL,
        image_alt TEXT NOT NULL,
        dimension_label TEXT NOT NULL,
        dimension_value TEXT NOT NULL,
        material TEXT NOT NULL,
        model_url TEXT,
        visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO products SELECT * FROM products_legacy;
      DROP TABLE products_legacy;

      ALTER TABLE colors RENAME TO colors_legacy;
      CREATE TABLE colors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        hex_value TEXT NOT NULL CHECK (hex_value GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO colors SELECT * FROM colors_legacy;
      DROP TABLE colors_legacy;

      CREATE INDEX products_visible_sort_idx ON products (visible, sort_order, id);
      CREATE INDEX colors_active_sort_idx ON colors (active, sort_order, id);
    `,
  },
  {
    version: 5,
    name: "add_model_file_metadata",
    sql: `
      ALTER TABLE order_items
      ADD COLUMN model_format TEXT
      CHECK (model_format IS NULL OR model_format IN ('stl', '3mf'));

      ALTER TABLE order_items
      ADD COLUMN model_metadata_json TEXT;

      UPDATE order_items
      SET model_format = 'stl'
      WHERE item_type = 'custom_file' AND model_format IS NULL;
    `,
  },
  {
    version: 6,
    name: "add_order_status",
    sql: `
      ALTER TABLE orders
      ADD COLUMN status TEXT NOT NULL DEFAULT 'in_attesa'
      CHECK (status IN ('in_attesa', 'in_lavorazione', 'completato'));
    `,
  },
  {
    version: 7,
    name: "add_app_settings",
    sql: `
      CREATE TABLE app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        email_notifications_enabled INTEGER NOT NULL DEFAULT 0
          CHECK (email_notifications_enabled IN (0, 1)),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO app_settings (id, email_notifications_enabled) VALUES (1, 0);
    `,
  },
  {
    version: 8,
    name: "add_user_accounts",
    sql: `
      CREATE TABLE user_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer'
          CHECK (role IN ('customer', 'admin')),
        auth_source TEXT NOT NULL DEFAULT 'local'
          CHECK (auth_source IN ('local', 'environment')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (auth_source = 'environment' OR password_hash IS NOT NULL)
      );

      CREATE TABLE user_sessions (
        token_hash TEXT PRIMARY KEY,
        user_account_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_account_id) REFERENCES user_accounts(id) ON DELETE CASCADE
      );

      ALTER TABLE orders
      ADD COLUMN user_account_id INTEGER
      REFERENCES user_accounts(id) ON DELETE SET NULL;

      CREATE INDEX user_sessions_expiry_idx ON user_sessions (expires_at);
      CREATE INDEX user_sessions_account_idx ON user_sessions (user_account_id);
      CREATE INDEX orders_account_created_idx
        ON orders (user_account_id, created_at DESC, id DESC);
    `,
  },
  {
    version: 9,
    name: "add_admin_credentials_override",
    sql: `
      ALTER TABLE app_settings
      ADD COLUMN admin_username TEXT;

      ALTER TABLE app_settings
      ADD COLUMN admin_password_hash TEXT;
    `,
  },
  {
    version: 10,
    name: "add_delivered_order_status",
    sql: `
      CREATE TABLE orders_new (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        catalog_total_cents INTEGER NOT NULL CHECK (catalog_total_cents >= 0),
        status TEXT NOT NULL DEFAULT 'in_attesa'
          CHECK (status IN ('in_attesa', 'in_lavorazione', 'completato', 'consegnato')),
        user_account_id INTEGER REFERENCES user_accounts(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO orders_new
        SELECT id, code, first_name, last_name, catalog_total_cents, status, user_account_id, created_at
        FROM orders;

      DROP TABLE orders;
      ALTER TABLE orders_new RENAME TO orders;

      CREATE INDEX orders_created_at_idx ON orders (created_at DESC, id DESC);
      CREATE INDEX orders_account_created_idx ON orders (user_account_id, created_at DESC, id DESC);
    `,
  },
];

const products = [
  {
    code: "MOD_001",
    slug: "vaso-orbitale",
    name: "Vaso Orbitale",
    category: "Casa / Decorazione",
    description: "Un piccolo vaso geometrico, pensato per fiori secchi e scrivanie con poco spazio.",
    priceCents: 1200,
    imageUrl: "/images/vaso-orbitale.svg",
    imageAlt: "Vaso arancione sfaccettato su una griglia tecnica",
    dimensionLabel: "Altezza",
    dimensionValue: "14 cm",
    material: "PLA",
    modelUrl: "/models/vaso-orbitale.stl",
    sortOrder: 10,
  },
  {
    code: "MOD_002",
    slug: "supporto-controller",
    name: "Dock Controller",
    category: "Desk / Gaming",
    description: "Supporto inclinato per tenere il controller visibile, stabile e sempre a portata di mano.",
    priceCents: 950,
    imageUrl: "/images/supporto-controller.svg",
    imageAlt: "Supporto blu per controller rappresentato in pixel art",
    dimensionLabel: "Larghezza",
    dimensionValue: "9 cm",
    material: "PLA",
    modelUrl: "/models/supporto-controller.stl",
    sortOrder: 20,
  },
];

const colors = [
  { name: "Nero", hexValue: "#17201A", sortOrder: 10 },
  { name: "Bianco", hexValue: "#F3F0E6", sortOrder: 20 },
  { name: "Arancione", hexValue: "#FF6534", sortOrder: 30 },
  { name: "Blu", hexValue: "#4277FF", sortOrder: 40 },
];

export function openDatabase(filename = process.env.DATABASE_PATH ?? defaultDatabasePath) {
  const database = new Database(filename);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  migrateDatabase(database);
  return database;
}

export function migrateDatabase(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedVersions = new Set(
    database.prepare("SELECT version FROM schema_migrations").all().map(({ version }) => version),
  );
  const recordMigration = database.prepare(
    "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
  );

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    database.transaction(() => {
      database.exec(migration.sql);
      recordMigration.run(migration.version, migration.name);
    })();
  }
}

export function seedDatabase(database) {
  const insertProduct = database.prepare(`
    INSERT INTO products (
      code, slug, name, category, description, price_cents, image_url, image_alt,
      dimension_label, dimension_value, material, model_url, sort_order
    ) VALUES (
      @code, @slug, @name, @category, @description, @priceCents, @imageUrl, @imageAlt,
      @dimensionLabel, @dimensionValue, @material, @modelUrl, @sortOrder
    )
    ON CONFLICT (slug) DO NOTHING
  `);
  const insertColor = database.prepare(`
    INSERT INTO colors (name, hex_value, sort_order)
    VALUES (@name, @hexValue, @sortOrder)
    ON CONFLICT (name) DO NOTHING
  `);

  database.transaction(() => {
    for (const product of products) {
      insertProduct.run(product);
    }
    for (const color of colors) {
      insertColor.run(color);
    }
  })();
}
