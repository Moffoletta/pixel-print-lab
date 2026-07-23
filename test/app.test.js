import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import Database from "better-sqlite3";
import yazl from "yazl";
import { createApp } from "../src/app.js";
import { createAuthService } from "../src/auth-service.js";
import {
  cleanupExpiredUploads,
  MAX_STL_FILE_SIZE,
  UPLOAD_TTL_MS,
} from "../src/custom-model-routes.js";
import { migrateDatabase, openDatabase, seedDatabase } from "../src/database.js";
import { createEmailService } from "../src/email-service.js";

let server;
let baseUrl;
let database;
let uploadDirectory;
let orderFileDirectory;
let catalogDirectory;
let sentEmails;
let rejectEmails;
let emailService;

before(async () => {
  uploadDirectory = await mkdtemp(path.join(tmpdir(), "pixel-print-lab-test-"));
  orderFileDirectory = await mkdtemp(path.join(tmpdir(), "pixel-print-lab-orders-"));
  catalogDirectory = await mkdtemp(path.join(tmpdir(), "pixel-print-lab-catalog-"));
  sentEmails = [];
  rejectEmails = false;
  emailService = {
    configured: true,
    recipient: "ordini@example.test",
    async sendOrderEmail(message) {
      if (rejectEmails) throw new Error("SMTP non disponibile");
      sentEmails.push(message);
    },
  };
  database = openDatabase(":memory:");
  seedDatabase(database);
  server = createApp({
    database,
    uploadDirectory,
    orderFileDirectory,
    catalogDirectory,
    adminUsername: "test-admin",
    adminPassword: "test-admin-password",
    emailService,
    uploadRateLimit: false,
    orderRateLimit: false,
  }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  database.close();
  await Promise.all(
    [uploadDirectory, orderFileDirectory, catalogDirectory].map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function authenticateAdmin() {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "test-admin-password" }),
  });
  assert.equal(response.status, 201);
  return response.headers.get("set-cookie").split(";", 1)[0];
}

function create3mfBuffer({ bambu = false, gcode = false, malformedModel = false, modelOverride, secondaryModel, firstSize = [20, 30, 40], repeatFirstObject = false } = {}) {
  const secondBuildObjectId = repeatFirstObject ? 1 : 2;
  const model = modelOverride ?? (malformedModel ? "<model><broken>" : `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">Progetto di test</metadata>
  <resources>
    <object id="1" type="model"><mesh><vertices>
      <vertex x="0" y="0" z="0"/><vertex x="${firstSize[0]}" y="0" z="0"/>
      <vertex x="0" y="${firstSize[1]}" z="0"/><vertex x="0" y="0" z="${firstSize[2]}"/>
    </vertices><triangles>
      <triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="1" v3="3"/>
      <triangle v1="0" v2="2" v3="3"/><triangle v1="1" v2="2" v3="3"/>
    </triangles></mesh></object>
    <object id="2" type="model"><mesh><vertices>
      <vertex x="0" y="0" z="0"/><vertex x="200" y="0" z="0"/>
      <vertex x="0" y="200" z="0"/><vertex x="0" y="0" z="200"/>
    </vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object>
  </resources>
  <build><item objectid="1"/><item objectid="${secondBuildObjectId}" transform="1 0 0 0 1 0 0 0 1 250 0 0"/></build>
</model>`);
  const relationships = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from(contentTypes), "[Content_Types].xml");
  zip.addBuffer(Buffer.from(relationships), "_rels/.rels");
  zip.addBuffer(Buffer.from(model), "3D/3dmodel.model");
  if (secondaryModel) zip.addBuffer(Buffer.from(secondaryModel), "3D/Objects/secondary.model");
  if (bambu) {
    const plateConfig = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value="Primo"/>
    <model_instance><metadata key="object_id" value="1"/><metadata key="instance_id" value="1"/></model_instance>
  </plate>
  <plate><metadata key="plater_id" value="2"/><metadata key="plater_name" value="Secondo"/>
    <model_instance><metadata key="object_id" value="${secondBuildObjectId}"/><metadata key="instance_id" value="${repeatFirstObject ? 2 : 1}"/></model_instance>
  </plate>
</config>`;
    zip.addBuffer(Buffer.from(plateConfig), "Metadata/model_settings.config");
    zip.addBuffer(Buffer.from(JSON.stringify({
      printer_settings_id: "Profilo conservato nel file originale",
      printer_model: "Stampante non usata dalla validazione",
    })), "Metadata/project_settings.config");
  }
  if (gcode) zip.addBuffer(Buffer.from("G1 X0 Y0"), "Metadata/plate_1.gcode");
  zip.end();
  return new Promise((resolve, reject) => {
    const chunks = [];
    zip.outputStream.on("data", (chunk) => chunks.push(chunk));
    zip.outputStream.once("error", reject);
    zip.outputStream.once("end", () => resolve(Buffer.concat(chunks)));
  });
}

test("espone lo stato di salute del server", async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("serve la pagina pubblica con un catalogo accessibile", async () => {
  const response = await fetch(baseUrl);
  const page = await response.text();

  assert.equal(response.status, 200);
  assert.match(page, /<html lang="it">/);
  assert.match(page, /<main id="contenuto">/);
  assert.match(page, /<h1 id="titolo-principale">/);
  assert.match(page, /Vai al contenuto/);
  assert.match(page, /id="product-list"/);
  assert.match(page, /id="stato-richieste"/);
  assert.match(page, /id="request-list"/);
  assert.match(page, /id="request-template"/);
  assert.match(page, /href="#stato-richieste"/);
  assert.ok(page.indexOf('id="product-list"') < page.indexOf('id="stato-richieste"'));
  assert.match(page, /id="product-template"/);
  assert.match(page, /id="cart-dialog"/);
  assert.match(page, /id="cart-item-template"/);
  assert.match(page, /id="viewer-dialog"/);
  assert.match(page, /id="custom-model-form"/);
  assert.match(page, /id="custom-file"/);
  assert.match(page, /id="custom-link"/);
  assert.match(page, /id="checkout-dialog"/);
  assert.match(page, /id="checkout-form"/);
  assert.match(page, /id="confirmation-code"/);
  assert.match(page, /type="importmap"/);
  assert.match(page, /<script type="module" src="\/app.js"><\/script>/);
});

test("serve gli asset pubblici", async () => {
  const paths = [
    "/images/vaso-orbitale.svg",
    "/images/supporto-controller.svg",
    "/app.js",
    "/cart.js",
    "/viewer.js",
    "/models/vaso-orbitale.stl",
    "/models/supporto-controller.stl",
    "/vendor/three/build/three.module.js",
    "/vendor/three/examples/jsm/loaders/STLLoader.js",
    "/vendor/three/examples/jsm/loaders/3MFLoader.js",
    "/admin.html",
    "/admin.css",
    "/admin.js",
  ];
  const responses = await Promise.all(paths.map((path) => fetch(`${baseUrl}${path}`)));

  for (const response of responses) {
    assert.equal(response.status, 200);
  }
});

test("mostra i dettagli amministrativi dell'ordine in sola lettura", async () => {
  const page = await (await fetch(`${baseUrl}/admin.html`)).text();

  assert.match(page, /<strong id="order-first-name"><\/strong>/);
  assert.match(page, /<strong id="order-last-name"><\/strong>/);
  assert.doesNotMatch(page, /id="add-catalog-item"/);
  assert.doesNotMatch(page, /id="save-order"/);
  assert.doesNotMatch(page, /data-field="remove-item"/);
  assert.match(page, /id="settings-button"/);
  assert.match(page, /id="settings-dialog"/);
  assert.match(page, /id="email-notifications-enabled"/);
});

test("riconosce e usa una configurazione SMTP completa", async () => {
  assert.equal(createEmailService({}).configured, false);
  assert.equal(createEmailService({ SMTP_HOST: "smtp.example.test" }).configured, false);
  let transportOptions;
  let sentMessage;
  const service = createEmailService({
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_FROM: "noreply@example.test",
    SMTP_TO: "ordini@example.test",
  }, (options) => {
    transportOptions = options;
    return { async sendMail(message) { sentMessage = message; } };
  });
  assert.equal(service.configured, true);
  assert.equal(service.recipient, "ordini@example.test");
  assert.equal(transportOptions.secure, true);
  await service.sendOrderEmail({ subject: "Nuovo ordine", text: "Dettagli" });
  assert.deepEqual(sentMessage, {
    from: "noreply@example.test",
    to: "ordini@example.test",
    subject: "Nuovo ordine",
    text: "Dettagli",
  });
});

test("espone i prodotti visibili ordinati", async () => {
  const response = await fetch(`${baseUrl}/api/products`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.count, 2);
  assert.equal(body.data[0].slug, "vaso-orbitale");
  assert.equal(body.data[0].priceCents, 1200);
  assert.equal(body.data[0].modelUrl, "/models/vaso-orbitale.stl");
  assert.deepEqual(body.data[0].dimension, { label: "Altezza", value: "14 cm" });
  assert.equal(body.data[1].slug, "supporto-controller");
});

test("espone il dettaglio di un prodotto", async () => {
  const response = await fetch(`${baseUrl}/api/products/1`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.code, "MOD_001");
  assert.equal(body.data.name, "Vaso Orbitale");
});

test("valida l'identificativo del prodotto", async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/products/non-numerico`);
  const missingResponse = await fetch(`${baseUrl}/api/products/999`);

  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error.code, "INVALID_PRODUCT_ID");
  assert.equal(missingResponse.status, 404);
  assert.equal((await missingResponse.json()).error.code, "PRODUCT_NOT_FOUND");
});

test("espone i colori attivi", async () => {
  const response = await fetch(`${baseUrl}/api/colors`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.count, 4);
  assert.deepEqual(body.data[0], { id: 1, name: "Nero", hexValue: "#17201A" });
});

test("il seed puo essere eseguito piu volte senza duplicare dati", () => {
  seedDatabase(database);

  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM products").get().count, 2);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM colors").get().count, 4);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count, 9);
  assert.equal(database.prepare("SELECT email_notifications_enabled FROM app_settings WHERE id = 1").get().email_notifications_enabled, 0);
});

test("migra un catalogo esistente senza perdere dati e impedisce il riuso degli ID", () => {
  const legacyDatabase = new Database(":memory:");
  try {
    legacyDatabase.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO schema_migrations (version, name) VALUES
        (1, 'create_catalog'), (2, 'add_demo_model_urls'), (3, 'create_orders');
      CREATE TABLE products (
        id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0), image_url TEXT NOT NULL,
        image_alt TEXT NOT NULL, dimension_label TEXT NOT NULL, dimension_value TEXT NOT NULL,
        material TEXT NOT NULL, model_url TEXT, visible INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE colors (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, hex_value TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX products_visible_sort_idx ON products (visible, sort_order, id);
      CREATE INDEX colors_active_sort_idx ON colors (active, sort_order, id);
      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY, item_type TEXT NOT NULL, model_filename TEXT
      );
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL,
        last_name TEXT NOT NULL, catalog_total_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO products VALUES (
        7, 'LEGACY', 'legacy', 'Legacy', 'Test', 'Dato esistente', 500,
        '/images/legacy.png', 'Legacy', 'Lato', '5 cm', 'PLA', NULL, 1, 10,
        '2025-01-01 10:00:00', '2025-02-01 10:00:00'
      );
      INSERT INTO colors VALUES (
        9, 'Legacy', '#123456', 1, 10, '2025-01-01 10:00:00', '2025-02-01 10:00:00'
      );
      INSERT INTO order_items (id, item_type, model_filename) VALUES (1, 'custom_file', 'legacy.stl');
      INSERT INTO orders (id, code, first_name, last_name, catalog_total_cents)
      VALUES (1, 'LEGACY-ORDER', 'Nome', 'Storico', 0);
    `);

    const productBefore = legacyDatabase.prepare("SELECT * FROM products").get();
    const colorBefore = legacyDatabase.prepare("SELECT * FROM colors").get();
    migrateDatabase(legacyDatabase);

    assert.deepEqual(legacyDatabase.prepare("SELECT * FROM products").get(), productBefore);
    assert.deepEqual(legacyDatabase.prepare("SELECT * FROM colors").get(), colorBefore);
    assert.match(legacyDatabase.prepare("SELECT sql FROM sqlite_master WHERE name = 'products'").get().sql, /AUTOINCREMENT/);
    assert.match(legacyDatabase.prepare("SELECT sql FROM sqlite_master WHERE name = 'colors'").get().sql, /AUTOINCREMENT/);
    assert.equal(legacyDatabase.prepare("SELECT model_format FROM order_items WHERE id = 1").get().model_format, "stl");
    assert.equal(legacyDatabase.prepare("SELECT status FROM orders WHERE id = 1").get().status, "in_attesa");
    assert.equal(legacyDatabase.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count, 9);
    assert.equal(legacyDatabase.prepare("SELECT email_notifications_enabled FROM app_settings WHERE id = 1").get().email_notifications_enabled, 0);
    assert.equal(legacyDatabase.prepare("SELECT admin_username FROM app_settings WHERE id = 1").get().admin_username, null);
    legacyDatabase.prepare("DELETE FROM products WHERE id = 7").run();
    const nextId = Number(legacyDatabase.prepare(`
      INSERT INTO products (
        code, slug, name, category, description, price_cents, image_url, image_alt,
        dimension_label, dimension_value, material
      ) VALUES ('NEXT', 'next', 'Next', 'Test', 'Next', 1, '/next.png', 'Next', 'Lato', '1 cm', 'PLA')
    `).run().lastInsertRowid);
    assert.ok(nextId > 7);
  } finally {
    legacyDatabase.close();
  }
});

test("carica, serve ed elimina un file STL valido", async () => {
  const stl = `solid test
facet normal 0 0 1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
endsolid test`;
  const form = new FormData();
  form.append("model", new Blob([stl], { type: "model/stl" }), "prova.stl");

  const uploadResponse = await fetch(`${baseUrl}/api/custom-models/upload`, {
    method: "POST",
    body: form,
  });
  const upload = await uploadResponse.json();

  assert.equal(uploadResponse.status, 201);
  assert.equal(upload.data.name, "prova.stl");
  assert.match(upload.data.id, /^[0-9a-f-]{36}$/);
  assert.match(upload.data.modelUrl, /^\/uploads\/[0-9a-f-]{36}\.stl$/);

  const modelResponse = await fetch(`${baseUrl}${upload.data.modelUrl}`);
  assert.equal(modelResponse.status, 200);
  assert.equal(modelResponse.headers.get("content-type"), "model/stl");
  assert.match(await modelResponse.text(), /^solid test/);

  const deleteResponse = await fetch(`${baseUrl}/api/custom-models/${upload.data.id}`, {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204);
  assert.equal((await fetch(`${baseUrl}${upload.data.modelUrl}`)).status, 404);
});

test("accetta anche un file STL binario", async () => {
  const binaryStl = Buffer.alloc(134);
  binaryStl.writeUInt32LE(1, 80);
  const form = new FormData();
  form.append("model", new Blob([binaryStl]), "binario.stl");

  const response = await fetch(`${baseUrl}/api/custom-models/upload`, {
    method: "POST",
    body: form,
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.data.name, "binario.stl");
  await fetch(`${baseUrl}/api/custom-models/${body.data.id}`, { method: "DELETE" });
});

test("ispeziona, serve ed elimina un archivio 3MF generico", async () => {
  const archive = await create3mfBuffer();
  const form = new FormData();
  form.append("model", new Blob([archive], { type: "model/3mf" }), "progetto.3mf");
  const response = await fetch(`${baseUrl}/api/custom-models/upload`, { method: "POST", body: form });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.data.modelFormat, "3mf");
  assert.equal(body.data.inspection.projectType, "generic");
  assert.equal(body.data.inspection.plateCount, 1);
  assert.deepEqual(body.data.inspection.previewBuildItemIndexes, [0, 1]);
  assert.deepEqual(body.data.inspection.boundsMm.size, [450, 200, 40]);
  assert.equal(body.data.inspection.compatibility.status, "incompatible");
  assert.deepEqual(body.data.inspection.referencePlate.volumeMm, [256, 256, 256]);
  const fileResponse = await fetch(`${baseUrl}${body.data.modelUrl}`);
  assert.equal(fileResponse.status, 200);
  assert.equal(fileResponse.headers.get("content-type"), "model/3mf");
  assert.deepEqual(Buffer.from(await fileResponse.arrayBuffer()), archive);
  assert.equal((await fetch(`${baseUrl}/api/custom-models/${body.data.id}`, { method: "DELETE" })).status, 204);
});

test("accetta un singolo pezzo distribuito in piu parti modello 3MF", async () => {
  const rootModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="1" type="model"><components><component objectid="3"/></components></object></resources>
  <build><item objectid="1"/></build>
</model>`;
  const secondaryModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="3" type="model"><mesh><vertices>
    <vertex x="0" y="0" z="0"/><vertex x="12" y="0" z="0"/><vertex x="0" y="14" z="0"/>
  </vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources>
</model>`;
  const form = new FormData();
  form.append("model", new Blob([await create3mfBuffer({ modelOverride: rootModel, secondaryModel })]), "multipart.3mf");
  const response = await fetch(`${baseUrl}/api/custom-models/upload`, { method: "POST", body: form });
  const model = (await response.json()).data;
  assert.equal(response.status, 201);
  assert.deepEqual(model.inspection.boundsMm.size, [12, 14, 0]);
  await fetch(`${baseUrl}/api/custom-models/${model.id}`, { method: "DELETE" });
});

test("rifiuta G-code 3MF e documenti XML non validi senza lasciare upload", async () => {
  const generic = await create3mfBuffer();
  const namedGcode = new FormData();
  namedGcode.append("model", new Blob([generic]), "progetto.gcode.3mf");
  const namedResponse = await fetch(`${baseUrl}/api/custom-models/upload`, { method: "POST", body: namedGcode });
  assert.equal(namedResponse.status, 400);
  assert.equal((await namedResponse.json()).error.code, "GCODE_3MF_NOT_SUPPORTED");

  const embeddedGcode = new FormData();
  embeddedGcode.append("model", new Blob([await create3mfBuffer({ gcode: true })]), "rinominato.3mf");
  const embeddedResponse = await fetch(`${baseUrl}/api/custom-models/upload`, { method: "POST", body: embeddedGcode });
  assert.equal(embeddedResponse.status, 400);
  assert.equal((await embeddedResponse.json()).error.code, "GCODE_3MF_NOT_SUPPORTED");

  const malformed = new FormData();
  malformed.append("model", new Blob([await create3mfBuffer({ malformedModel: true })]), "rotto.3mf");
  const malformedResponse = await fetch(`${baseUrl}/api/custom-models/upload`, { method: "POST", body: malformed });
  assert.equal(malformedResponse.status, 400);
  assert.equal((await malformedResponse.json()).error.code, "INVALID_3MF_XML");
  assert.equal((await readdir(uploadDirectory)).length, 0);
});

test("usa un unico piatto standard come riferimento informativo", async () => {
  for (const scenario of [
    { size: 250, expectedStatus: "compatible" },
    { size: 260, expectedStatus: "incompatible" },
    { size: 256.0004, expectedStatus: "incompatible" },
  ]) {
    const archive = await create3mfBuffer({
      bambu: true,
      firstSize: [scenario.size, 30, 40],
    });
    const form = new FormData();
    form.append("model", new Blob([archive]), `standard-${scenario.size}.3mf`);
    const response = await fetch(`${baseUrl}/api/custom-models/upload`, { method: "POST", body: form });
    const model = (await response.json()).data;
    assert.equal(response.status, 201);
    assert.equal(model.inspection.compatibility.status, scenario.expectedStatus);
    assert.equal(model.inspection.compatibility.target, "Piatto standard");
    await fetch(`${baseUrl}/api/custom-models/${model.id}`, { method: "DELETE" });
  }
});

test("rifiuta grafi di componenti 3MF ciclici", async () => {
  const cyclicModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model"><components><component objectid="2"/></components></object>
    <object id="2" type="model"><components><component objectid="1"/></components></object>
  </resources>
  <build><item objectid="1"/></build>
</model>`;
  const form = new FormData();
  form.append("model", new Blob([await create3mfBuffer({ modelOverride: cyclicModel })]), "ciclo.3mf");
  const response = await fetch(`${baseUrl}/api/custom-models/upload`, { method: "POST", body: form });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_3MF_COMPONENTS");
  assert.equal((await readdir(uploadDirectory)).length, 0);
});

test("seleziona l'istanza esatta quando due piatti Bambu riusano lo stesso oggetto", async () => {
  const form = new FormData();
  form.append("model", new Blob([await create3mfBuffer({ bambu: true, repeatFirstObject: true })]), "istanze.3mf");
  const response = await fetch(`${baseUrl}/api/custom-models/upload`, { method: "POST", body: form });
  const model = (await response.json()).data;
  assert.equal(response.status, 201);
  assert.deepEqual(model.inspection.previewBuildItemIndexes, [0]);
  assert.deepEqual(model.inspection.boundsMm.size, [20, 30, 40]);
  await fetch(`${baseUrl}/api/custom-models/${model.id}`, { method: "DELETE" });
});

test("rifiuta estensioni e contenuti STL non validi", async () => {
  const wrongExtension = new FormData();
  wrongExtension.append("model", new Blob(["solid test"]), "prova.txt");
  const extensionResponse = await fetch(`${baseUrl}/api/custom-models/upload`, {
    method: "POST",
    body: wrongExtension,
  });

  const invalidContent = new FormData();
  invalidContent.append("model", new Blob(["questo non e un modello STL valido"]), "prova.stl");
  const contentResponse = await fetch(`${baseUrl}/api/custom-models/upload`, {
    method: "POST",
    body: invalidContent,
  });

  assert.equal(extensionResponse.status, 400);
  assert.equal((await extensionResponse.json()).error.code, "INVALID_MODEL_EXTENSION");
  assert.equal(contentResponse.status, 400);
  assert.equal((await contentResponse.json()).error.code, "INVALID_STL_CONTENT");
  assert.equal((await readdir(uploadDirectory)).length, 0);
  assert.equal(MAX_STL_FILE_SIZE, 50 * 1024 * 1024);
});

test("rifiuta un file che supera 50 MB", async () => {
  const form = new FormData();
  form.append("model", new Blob([new Uint8Array(MAX_STL_FILE_SIZE + 1)]), "troppo-grande.stl");

  const response = await fetch(`${baseUrl}/api/custom-models/upload`, {
    method: "POST",
    body: form,
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.error.code, "MODEL_TOO_LARGE");
  assert.equal((await readdir(uploadDirectory)).length, 0);
});

test("accetta soltanto link HTTPS dai siti autorizzati", async () => {
  const allowedResponse = await fetch(`${baseUrl}/api/custom-models/link`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://www.printables.com/model/123-prova" }),
  });
  const deceptiveResponse = await fetch(`${baseUrl}/api/custom-models/link`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://printables.com.example.org/model/123" }),
  });
  const httpResponse = await fetch(`${baseUrl}/api/custom-models/link`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "http://thingiverse.com/thing:123" }),
  });

  const allowed = await allowedResponse.json();
  assert.equal(allowedResponse.status, 201);
  assert.equal(allowed.data.sourceName, "Printables");
  assert.equal(deceptiveResponse.status, 400);
  assert.equal((await deceptiveResponse.json()).error.code, "LINK_NOT_ALLOWED");
  assert.equal(httpResponse.status, 400);
  assert.equal((await httpResponse.json()).error.code, "INVALID_LINK");
});

test("elimina gli upload temporanei scaduti", async () => {
  const expiredFile = path.join(uploadDirectory, "expired.stl");
  await writeFile(expiredFile, "solid expired");
  const expiredDate = new Date(Date.now() - UPLOAD_TTL_MS - 1000);
  await utimes(expiredFile, expiredDate, expiredDate);

  await cleanupExpiredUploads(uploadDirectory);

  await assert.rejects(stat(expiredFile), { code: "ENOENT" });
});

test("conserva progetto Bambu 3MF, primo piatto e metadati nell'ordine", async () => {
  const archive = await create3mfBuffer({ bambu: true });
  const uploadForm = new FormData();
  uploadForm.append("model", new Blob([archive], { type: "model/3mf" }), "bambu-a1-mini.3mf");
  const uploadResponse = await fetch(`${baseUrl}/api/custom-models/upload`, { method: "POST", body: uploadForm });
  const upload = (await uploadResponse.json()).data;
  assert.equal(uploadResponse.status, 201);
  assert.equal(upload.inspection.projectType, "bambu");
  assert.equal(upload.inspection.plateCount, 2);
  assert.deepEqual(upload.inspection.previewBuildItemIndexes, [0]);
  assert.deepEqual(upload.inspection.boundsMm.size, [20, 30, 40]);
  assert.deepEqual(upload.inspection.referencePlate.volumeMm, [256, 256, 256]);
  assert.equal(upload.inspection.compatibility.status, "compatible");

  const orderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Ada",
      lastName: "Bambu",
      items: [{
        type: "custom",
        sourceType: "file",
        id: upload.id,
        name: upload.name,
        modelFormat: "3mf",
        colorId: 1,
        quantity: 1,
      }],
    }),
  });
  const code = (await orderResponse.json()).data.code;
  assert.equal(orderResponse.status, 201);
  const order = database.prepare("SELECT * FROM orders WHERE code = ?").get(code);
  const storedItem = database.prepare("SELECT * FROM order_items WHERE order_id = ?").get(order.id);
  assert.equal(storedItem.model_format, "3mf");
  assert.equal(JSON.parse(storedItem.model_metadata_json).plateCount, 2);
  assert.deepEqual(await readFile(path.join(orderFileDirectory, storedItem.model_filename)), archive);
  assert.equal((await fetch(`${baseUrl}${upload.modelUrl}`)).status, 404);

  const cookie = await authenticateAdmin();
  const adminFetch = (pathName, options = {}) => fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: { cookie, ...(options.headers ?? {}) },
  });
  const detail = (await (await adminFetch(`/api/admin/orders/${order.id}`)).json()).data;
  assert.equal(detail.items[0].modelFormat, "3mf");
  assert.equal(detail.items[0].modelMetadata.previewPlate, 1);
  const download = await adminFetch(`/api/admin/orders/${order.id}/items/${detail.items[0].id}/model`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "model/3mf");
  assert.match(download.headers.get("content-disposition"), /bambu-a1-mini\.3mf/i);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), archive);

  const update = await adminFetch(`/api/admin/orders/${order.id}`, {
    method: "PUT",
  });
  assert.equal(update.status, 404);
  assert.equal((await adminFetch(`/api/admin/orders/${order.id}`, { method: "DELETE" })).status, 204);
  await assert.rejects(stat(path.join(orderFileDirectory, storedItem.model_filename)), { code: "ENOENT" });
});

test("crea una richiesta mista con snapshot e file permanente senza email automatica", async () => {
  const stl = `solid order
facet normal 0 0 1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
endsolid order`;
  const uploadForm = new FormData();
  uploadForm.append("model", new Blob([stl]), "ordine-personale.stl");
  const uploadResponse = await fetch(`${baseUrl}/api/custom-models/upload`, {
    method: "POST",
    body: uploadForm,
  });
  const upload = (await uploadResponse.json()).data;

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "  Mauro ",
      lastName: " Rossi  ",
      items: [
        { type: "catalog", productId: 1, colorId: 1, quantity: 2, priceCents: 1 },
        {
          type: "custom",
          sourceType: "file",
          id: upload.id,
          name: upload.name,
          colorId: 2,
          quantity: 1,
        },
        {
          type: "custom",
          sourceType: "link",
          externalUrl: "https://www.makerworld.com/en/models/123-test",
          colorId: 3,
          quantity: 4,
        },
      ],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(body.data), ["code"]);
  assert.match(body.data.code, /^[A-Z]{2}-\d{4}$/);

  const order = database.prepare("SELECT * FROM orders WHERE code = ?").get(body.data.code);
  const items = database
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY position")
    .all(order.id);
  assert.equal(order.first_name, "Mauro");
  assert.equal(order.last_name, "Rossi");
  assert.equal(order.catalog_total_cents, 2400);
  assert.equal(order.status, "in_attesa");
  assert.equal(order.user_account_id, null);
  assert.equal(items.length, 3);
  assert.equal(items[0].product_name, "Vaso Orbitale");
  assert.equal(items[0].unit_price_cents, 1200);
  assert.equal(items[0].color_name, "Nero");
  assert.equal(items[1].item_type, "custom_file");
  assert.equal(items[1].original_name, "ordine-personale.stl");
  assert.equal(items[2].item_type, "custom_link");
  assert.equal(items[2].source_name, "MakerWorld");

  await stat(path.join(orderFileDirectory, items[1].model_filename));
  assert.equal((await fetch(`${baseUrl}${upload.modelUrl}`)).status, 404);
  assert.equal(sentEmails.length, 0);
});

test("gestisce l'invio SMTP opzionale dalle impostazioni amministrative", async () => {
  assert.equal((await fetch(`${baseUrl}/api/admin/settings`)).status, 401);
  const cookie = await authenticateAdmin();
  const adminFetch = (pathName, options = {}) => fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: { cookie, ...(options.headers ?? {}) },
  });
  const initial = (await (await adminFetch("/api/admin/settings")).json()).data;
  assert.deepEqual(initial, {
    emailNotificationsEnabled: false,
    smtpConfigured: true,
    smtpRecipient: "ordini@example.test",
    adminUsername: "test-admin",
    adminCredentialsCustomized: false,
  });

  const invalid = await adminFetch("/api/admin/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ emailNotificationsEnabled: "true" }),
  });
  assert.equal(invalid.status, 400);

  emailService.configured = false;
  const unavailable = await adminFetch("/api/admin/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ emailNotificationsEnabled: true }),
  });
  assert.equal(unavailable.status, 409);
  assert.equal((await unavailable.json()).error.code, "SMTP_NOT_CONFIGURED");
  emailService.configured = true;

  const enabled = await adminFetch("/api/admin/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ emailNotificationsEnabled: true }),
  });
  assert.equal(enabled.status, 200);
  assert.equal(database.prepare("SELECT email_notifications_enabled FROM app_settings WHERE id = 1").get().email_notifications_enabled, 1);

  const createOrder = (firstName) => fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName,
      lastName: "Email",
      items: [{ type: "catalog", productId: 2, colorId: 4, quantity: 1 }],
    }),
  });
  const sentResponse = await createOrder("Invio");
  const sentCode = (await sentResponse.json()).data.code;
  assert.equal(sentResponse.status, 201);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].subject, `Nuova richiesta ${sentCode}`);
  assert.match(sentEmails[0].text, /Nome: Invio/);
  assert.match(sentEmails[0].text, /Dock Controller/);

  rejectEmails = true;
  const originalConsoleError = console.error;
  console.error = () => {};
  let failedResponse;
  try {
    failedResponse = await createOrder("Errore");
  } finally {
    console.error = originalConsoleError;
    rejectEmails = false;
  }
  const failedCode = (await failedResponse.json()).data.code;
  assert.equal(failedResponse.status, 201);
  assert.ok(database.prepare("SELECT id FROM orders WHERE code = ?").get(failedCode));

  const disabled = await adminFetch("/api/admin/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ emailNotificationsEnabled: false }),
  });
  assert.equal(disabled.status, 200);
  database.prepare("DELETE FROM orders WHERE code IN (?, ?)").run(sentCode, failedCode);
});

test("rispetta il limite di 15 ordini in lavorazione", async () => {
  const maxOpenOrders = 15;
  const existingOpenOrders = database.prepare("SELECT COUNT(*) AS count FROM orders WHERE status != 'completato'").get().count;
  const ordersToInsert = Math.max(0, maxOpenOrders - existingOpenOrders);

  const insertOrder = database.prepare(`
    INSERT INTO orders (code, first_name, last_name, catalog_total_cents, status)
    VALUES (@code, 'Limite', 'Test', 0, 'in_attesa')
  `);
  for (let i = 0; i < ordersToInsert; i += 1) {
    insertOrder.run({ code: `CAP-${String(i).padStart(3, "0")}` });
  }

  try {
    const fullResponse = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Pieno",
        lastName: "Test",
        items: [{ type: "catalog", productId: 2, colorId: 4, quantity: 1 }],
      }),
    });
    assert.equal(fullResponse.status, 503);
    const fullBody = await fullResponse.json();
    assert.equal(fullBody.error.code, "ORDER_CAPACITY_REACHED");

    if (ordersToInsert > 0) {
      database.prepare("UPDATE orders SET status = 'completato' WHERE code = 'CAP-000'").run();

      const retryResponse = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: "Libero",
          lastName: "Test",
          items: [{ type: "catalog", productId: 2, colorId: 4, quantity: 1 }],
        }),
      });
      assert.equal(retryResponse.status, 201);
      const retryCode = (await retryResponse.json()).data.code;
      database.prepare("DELETE FROM orders WHERE code = ?").run(retryCode);
    }
  } finally {
    database.prepare("DELETE FROM orders WHERE code LIKE 'CAP-%'").run();
  }
});


test("gestisce il cambio delle credenziali amministrative", async () => {
  assert.equal((await fetch(`${baseUrl}/api/admin/credentials`, { method: "PUT" })).status, 401);
  const cookie = await authenticateAdmin();
  const putCredentials = (body, sessionCookie = cookie) => fetch(`${baseUrl}/api/admin/credentials`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: sessionCookie },
    body: JSON.stringify(body),
  });
  const loginAdmin = (username, password) => fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const wrongPassword = await putCredentials({ currentPassword: "password-sbagliata", password: "nuova-password-1" });
  assert.equal(wrongPassword.status, 401);
  assert.equal((await wrongPassword.json()).error.code, "INVALID_CREDENTIALS");

  const invalidUsername = await putCredentials({ currentPassword: "test-admin-password", username: "NO!" });
  assert.equal(invalidUsername.status, 400);
  assert.equal((await invalidUsername.json()).error.code, "INVALID_USERNAME");

  const shortPassword = await putCredentials({ currentPassword: "test-admin-password", password: "corta" });
  assert.equal(shortPassword.status, 400);
  assert.equal((await shortPassword.json()).error.code, "INVALID_PASSWORD");

  const noChanges = await putCredentials({ currentPassword: "test-admin-password" });
  assert.equal(noChanges.status, 400);
  assert.equal((await noChanges.json()).error.code, "INVALID_CREDENTIALS_UPDATE");

  database.prepare(`
    INSERT INTO user_accounts (username, password_hash, first_name, last_name)
    VALUES ('cliente-esistente', 'hash-fittizio', 'Carlo', 'Rossi')
  `).run();
  const conflict = await putCredentials({ currentPassword: "test-admin-password", username: "cliente-esistente" });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error.code, "USERNAME_UNAVAILABLE");

  const changed = await putCredentials({
    currentPassword: "test-admin-password",
    username: "nuovo-admin",
    password: "nuova-password-segreta",
  });
  assert.equal(changed.status, 200);
  assert.equal((await changed.json()).data.username, "nuovo-admin");

  const staleSession = await fetch(`${baseUrl}/api/admin/settings`, { headers: { cookie } });
  assert.equal(staleSession.status, 401);
  assert.equal((await loginAdmin("test-admin", "test-admin-password")).status, 401);

  const newLogin = await loginAdmin("nuovo-admin", "nuova-password-segreta");
  assert.equal(newLogin.status, 201);
  const newCookie = newLogin.headers.get("set-cookie").split(";", 1)[0];
  const settings = (await (await fetch(`${baseUrl}/api/admin/settings`, { headers: { cookie: newCookie } })).json()).data;
  assert.equal(settings.adminUsername, "nuovo-admin");
  assert.equal(settings.adminCredentialsCustomized, true);

  const reserved = await fetch(`${baseUrl}/api/account/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "nuovo-admin", password: "password-cliente", firstName: "Anna", lastName: "Bianchi" }),
  });
  assert.equal(reserved.status, 409);

  const freshAuth = createAuthService({ database, adminUsername: "test-admin", adminPassword: "test-admin-password" });
  freshAuth.resetAdminCredentials();
  const overrideRow = database.prepare("SELECT admin_username, admin_password_hash FROM app_settings WHERE id = 1").get();
  assert.equal(overrideRow.admin_username, null);
  assert.equal(overrideRow.admin_password_hash, null);
  assert.equal((await loginAdmin("test-admin", "test-admin-password")).status, 201);
  database.prepare("DELETE FROM user_accounts WHERE username = 'cliente-esistente'").run();
});

test("espone pubblicamente soltanto codice e stato in ordine recente", async () => {
  const insert = database.prepare(`
    INSERT INTO orders (code, first_name, last_name, catalog_total_cents, status, created_at)
    VALUES (?, 'Privato', 'Nascosto', 9999, ?, '2099-01-01 10:00:00')
  `);
  const firstId = Number(insert.run("PPL-PUBLIC-OLDER", "completato").lastInsertRowid);
  const secondId = Number(insert.run("PPL-PUBLIC-NEWER", "in_lavorazione").lastInsertRowid);

  const response = await fetch(`${baseUrl}/api/orders`);
  const body = await response.json();
  assert.equal(response.status, 200);
  const newerIndex = body.data.findIndex((order) => order.code === "PPL-PUBLIC-NEWER");
  const olderIndex = body.data.findIndex((order) => order.code === "PPL-PUBLIC-OLDER");
  assert.ok(newerIndex > -1 && olderIndex > -1);
  assert.ok(newerIndex > olderIndex, "L'ordine piu recente deve apparire dopo quello piu vecchio");
  for (const order of body.data) {
    assert.deepEqual(Object.keys(order), ["code", "status"]);
  }
  assert.doesNotMatch(JSON.stringify(body), /Privato|Nascosto|9999|created_at|first_name|items/i);
  assert.throws(
    () => database.prepare("UPDATE orders SET status = 'non_valido' WHERE id = ?").run(firstId),
    /CHECK constraint failed/,
  );

  database.prepare("DELETE FROM orders WHERE id IN (?, ?)").run(firstId, secondId);
});

test("rifiuta richieste manipolate senza creare record", async () => {
  const initialCount = database.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
  const requests = [
    {
      firstName: "",
      lastName: "Rossi",
      items: [{ type: "catalog", productId: 1, colorId: 1, quantity: 1 }],
      expectedCode: "INVALID_CUSTOMER",
    },
    {
      firstName: "Mauro",
      lastName: "Rossi",
      items: [{ type: "catalog", productId: 1, colorId: 1, quantity: 100 }],
      expectedCode: "INVALID_QUANTITY",
    },
    {
      firstName: "Mauro",
      lastName: "Rossi",
      items: [
        {
          type: "custom",
          sourceType: "file",
          id: "123e4567-e89b-42d3-a456-426614174000",
          name: "mancante.stl",
          colorId: 1,
          quantity: 1,
        },
      ],
      expectedCode: "UPLOAD_NOT_FOUND",
    },
    {
      firstName: "Mauro",
      lastName: "Rossi",
      items: [
        {
          type: "custom",
          sourceType: "link",
          externalUrl: "https://printables.com.example.org/model/1",
          colorId: 1,
          quantity: 1,
        },
      ],
      expectedCode: "INVALID_LINK",
    },
  ];

  for (const request of requests) {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const body = await response.json();
    assert.ok(response.status >= 400);
    assert.equal(body.error.code, request.expectedCode);
  }

  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, initialCount);
});

test("gestisce prodotti, asset e colori senza alterare gli snapshot degli ordini", async () => {
  assert.equal((await fetch(`${baseUrl}/api/admin/catalog`)).status, 401);
  const cookie = await authenticateAdmin();
  const adminFetch = (pathName, options = {}) => fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: { cookie, ...(options.headers ?? {}) },
  });
  const stl = `solid catalog
facet normal 0 0 1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
endsolid catalog`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

  function productForm(overrides = {}) {
    const values = {
      code: "MOD_TEST",
      slug: "prodotto-test",
      name: "Prodotto Test",
      category: "Test",
      description: "Prodotto creato dai test amministrativi.",
      priceCents: "1234",
      imageAlt: "Immagine del prodotto di test",
      dimensionLabel: "Larghezza",
      dimensionValue: "10 cm",
      material: "PLA",
      visible: "true",
      sortOrder: "90",
      removeModel: "false",
      ...overrides,
    };
    const form = new FormData();
    Object.entries(values).forEach(([key, value]) => form.append(key, value));
    return form;
  }

  const invalidUpload = productForm({ code: "MOD_BAD", slug: "prodotto-non-valido" });
  invalidUpload.append("image", new Blob([png], { type: "image/png" }), "valida.png");
  invalidUpload.append("unexpected", new Blob(["file non previsto"]), "extra.txt");
  const invalidResponse = await adminFetch("/api/admin/products", { method: "POST", body: invalidUpload });
  assert.equal(invalidResponse.status, 400);
  assert.equal((await readdir(catalogDirectory)).length, 0);

  const fakeJpeg = Buffer.alloc(107);
  fakeJpeg.set([0xff, 0xd8, 0xff], 0);
  fakeJpeg.set([0xff, 0xd9], fakeJpeg.length - 2);
  const malformedImage = productForm({ code: "MOD_JPG", slug: "jpeg-non-valido" });
  malformedImage.append("image", new Blob([fakeJpeg], { type: "image/jpeg" }), "falso.jpg");
  const malformedResponse = await adminFetch("/api/admin/products", { method: "POST", body: malformedImage });
  assert.equal(malformedResponse.status, 400);
  assert.equal((await malformedResponse.json()).error.code, "INVALID_CATALOG_IMAGE");
  assert.equal((await readdir(catalogDirectory)).length, 0);

  const createForm = productForm();
  createForm.append("image", new Blob([png], { type: "image/png" }), "prodotto.png");
  createForm.append("model", new Blob([stl], { type: "model/stl" }), "prodotto.stl");
  const createResponse = await adminFetch("/api/admin/products", { method: "POST", body: createForm });
  const created = (await createResponse.json()).data;
  assert.equal(createResponse.status, 201);
  assert.match(created.imageUrl, /^\/catalog-assets\/[0-9a-f-]+\.png$/);
  assert.match(created.modelUrl, /^\/catalog-assets\/[0-9a-f-]+\.stl$/);
  assert.equal((await fetch(`${baseUrl}${created.imageUrl}`)).status, 200);
  assert.equal((await fetch(`${baseUrl}${created.modelUrl}`)).status, 200);

  const colorResponse = await adminFetch("/api/admin/colors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Verde Test", hexValue: "#12AB34", active: true, sortOrder: 90 }),
  });
  const color = (await colorResponse.json()).data;
  assert.equal(colorResponse.status, 201);

  const orderId = Number(database.prepare(`
    INSERT INTO orders (code, first_name, last_name, catalog_total_cents)
    VALUES ('SNAPSHOT-TEST', 'Test', 'Storico', 1234)
  `).run().lastInsertRowid);
  database.prepare(`
    INSERT INTO order_items (
      order_id, position, item_type, product_id, product_code, product_name,
      unit_price_cents, color_id, color_name, color_hex, quantity
    ) VALUES (?, 1, 'catalog', ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(orderId, created.id, created.code, created.name, created.priceCents, color.id, color.name, color.hexValue);
  const snapshotQuery = database.prepare(`
    SELECT product_id, product_code, product_name, unit_price_cents, color_id, color_name, color_hex
    FROM order_items WHERE order_id = ?
  `);
  const originalSnapshot = snapshotQuery.get(orderId);

  const updateResponse = await adminFetch(`/api/admin/products/${created.id}`, {
    method: "PUT",
    body: productForm({ name: "Prodotto Aggiornato", priceCents: "9999", visible: "false" }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).data.visible, false);
  const colorUpdate = await adminFetch(`/api/admin/colors/${color.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Verde Storico", hexValue: "#229944", active: false, sortOrder: 90 }),
  });
  assert.equal(colorUpdate.status, 200);
  assert.equal(database.prepare("SELECT catalog_total_cents FROM orders WHERE id = ?").get(orderId).catalog_total_cents, 1234);
  assert.deepEqual(snapshotQuery.get(orderId), originalSnapshot);
  assert.equal((await fetch(`${baseUrl}/api/products/${created.id}`)).status, 404);

  const catalog = (await (await adminFetch("/api/admin/catalog")).json()).data;
  const reversedColorIds = catalog.colors.map(({ id }) => id).reverse();
  const reorderResponse = await adminFetch("/api/admin/colors/order", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: reversedColorIds }),
  });
  assert.equal(reorderResponse.status, 200);
  assert.deepEqual((await reorderResponse.json()).data.map(({ id }) => id), reversedColorIds);

  const imagePath = path.join(catalogDirectory, path.basename(created.imageUrl));
  const modelPath = path.join(catalogDirectory, path.basename(created.modelUrl));
  assert.equal((await adminFetch(`/api/admin/products/${created.id}`, { method: "DELETE" })).status, 204);
  await assert.rejects(stat(imagePath), { code: "ENOENT" });
  await assert.rejects(stat(modelPath), { code: "ENOENT" });
  assert.deepEqual(snapshotQuery.get(orderId), originalSnapshot);

  const replacementForm = productForm({ code: "MOD_NEXT", slug: "prodotto-successivo", name: "Prodotto Successivo" });
  replacementForm.append("image", new Blob([png], { type: "image/png" }), "successivo.png");
  const replacementResponse = await adminFetch("/api/admin/products", { method: "POST", body: replacementForm });
  const replacement = (await replacementResponse.json()).data;
  assert.ok(replacement.id > created.id);
  assert.equal((await adminFetch(`/api/admin/products/${replacement.id}`, { method: "DELETE" })).status, 204);

  await adminFetch("/api/admin/colors/order", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: catalog.colors.map(({ id }) => id) }),
  });
  database.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
  database.prepare("DELETE FROM colors WHERE id = ?").run(color.id);
});

test("gestisce account, storico personale e accesso amministrativo unificato", async () => {
  assert.equal((await fetch(`${baseUrl}/api/account/orders`)).status, 401);

  const reservedRegistration = await fetch(`${baseUrl}/api/account/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "test-admin",
      password: "password-molto-sicura",
      firstName: "Admin",
      lastName: "Cliente",
    }),
  });
  assert.equal(reservedRegistration.status, 409);

  const registration = await fetch(`${baseUrl}/api/account/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "cliente.test",
      password: "password-molto-sicura",
      firstName: "Cliente",
      lastName: "Test",
    }),
  });
  const registeredAccount = await registration.json();
  const accountCookie = registration.headers.get("set-cookie").split(";", 1)[0];
  assert.equal(registration.status, 201);
  assert.equal(registeredAccount.data.role, "customer");
  assert.equal(database.prepare("SELECT password_hash FROM user_accounts WHERE username = ?").get("cliente.test").password_hash.includes("password-molto-sicura"), false);

  const accountFetch = (pathName, options = {}) =>
    fetch(`${baseUrl}${pathName}`, {
      ...options,
      headers: { cookie: accountCookie, ...(options.headers ?? {}) },
    });
  const session = await accountFetch("/api/account/session");
  assert.equal(session.status, 200);
  assert.equal((await session.json()).data.username, "cliente.test");
  assert.equal((await accountFetch("/api/admin/session")).status, 403);

  const orderResponse = await accountFetch("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Cliente",
      lastName: "Test",
      items: [{ type: "catalog", productId: 1, colorId: 1, quantity: 2 }],
    }),
  });
  const order = (await orderResponse.json()).data;
  assert.equal(orderResponse.status, 201);
  const savedOrder = database.prepare("SELECT * FROM orders WHERE code = ?").get(order.code);
  assert.equal(savedOrder.user_account_id, registeredAccount.data.id);

  const historyResponse = await accountFetch("/api/account/orders");
  const history = (await historyResponse.json()).data;
  assert.equal(historyResponse.status, 200);
  assert.equal(history.length, 1);
  assert.equal(history[0].code, order.code);
  assert.equal(history[0].items[0].productName, "Vaso Orbitale");

  const logout = await accountFetch("/api/account/logout", { method: "POST" });
  assert.equal(logout.status, 204);
  assert.equal((await accountFetch("/api/account/session")).status, 401);

  const orderCountBeforeExpiredSession = database.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
  const expiredSessionOrder = await accountFetch("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Cliente",
      lastName: "Test",
      items: [{ type: "catalog", productId: 1, colorId: 1, quantity: 1 }],
    }),
  });
  assert.equal(expiredSessionOrder.status, 401);
  assert.equal((await expiredSessionOrder.json()).error.code, "SESSION_EXPIRED");
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, orderCountBeforeExpiredSession);

  const login = await fetch(`${baseUrl}/api/account/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "cliente.test", password: "password-molto-sicura" }),
  });
  assert.equal(login.status, 201);
  assert.equal((await login.json()).data.role, "customer");

  const secondRegistration = await fetch(`${baseUrl}/api/account/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "altro.cliente",
      password: "seconda-password-sicura",
      firstName: "Altro",
      lastName: "Cliente",
    }),
  });
  const secondAccount = await secondRegistration.json();
  const secondCookie = secondRegistration.headers.get("set-cookie").split(";", 1)[0];
  assert.equal(secondRegistration.status, 201);
  const secondHistory = await fetch(`${baseUrl}/api/account/orders`, { headers: { cookie: secondCookie } });
  assert.deepEqual((await secondHistory.json()).data, []);

  const adminLogin = await fetch(`${baseUrl}/api/account/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "test-admin-password" }),
  });
  const adminAccount = await adminLogin.json();
  const adminCookie = adminLogin.headers.get("set-cookie").split(";", 1)[0];
  assert.equal(adminLogin.status, 201);
  assert.equal(adminAccount.data.role, "admin");
  assert.equal((await fetch(`${baseUrl}/api/admin/session`, { headers: { cookie: adminCookie } })).status, 200);
  await fetch(`${baseUrl}/api/account/logout`, { method: "POST", headers: { cookie: adminCookie } });

  database.prepare("DELETE FROM user_accounts WHERE id = ?").run(registeredAccount.data.id);
  assert.equal(database.prepare("SELECT user_account_id FROM orders WHERE id = ?").get(savedOrder.id).user_account_id, null);
  database.prepare("DELETE FROM orders WHERE id = ?").run(savedOrder.id);
  database.prepare("DELETE FROM user_accounts WHERE id = ?").run(secondAccount.data.id);
});

test("gestisce il cambio password dell'utente autenticato", async () => {
  assert.equal((await fetch(`${baseUrl}/api/account/password`, { method: "PUT" })).status, 401);

  const registration = await fetch(`${baseUrl}/api/account/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "utente.password",
      password: "password-iniziale",
      firstName: "Utente",
      lastName: "Password",
    }),
  });
  assert.equal(registration.status, 201);
  const accountCookie = registration.headers.get("set-cookie").split(";", 1)[0];
  const accountId = (await registration.json()).data.id;
  const accountFetch = (pathName, options = {}) =>
    fetch(`${baseUrl}${pathName}`, {
      ...options,
      headers: { cookie: accountCookie, ...(options.headers ?? {}) },
    });
  const changePassword = (body) => fetch(`${baseUrl}/api/account/password`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: accountCookie },
    body: JSON.stringify(body),
  });

  const wrongPassword = await changePassword({ currentPassword: "password-sbagliata", newPassword: "nuova-password-sicura" });
  assert.equal(wrongPassword.status, 401);
  assert.equal((await wrongPassword.json()).error.code, "INVALID_CREDENTIALS");

  const shortPassword = await changePassword({ currentPassword: "password-iniziale", newPassword: "corta" });
  assert.equal(shortPassword.status, 400);
  assert.equal((await shortPassword.json()).error.code, "INVALID_PASSWORD");

  const missingPassword = await changePassword({ currentPassword: "password-iniziale" });
  assert.equal(missingPassword.status, 400);

  const changed = await changePassword({ currentPassword: "password-iniziale", newPassword: "nuova-password-sicura" });
  assert.equal(changed.status, 200);
  const storedHash = database.prepare("SELECT password_hash FROM user_accounts WHERE id = ?").get(accountId).password_hash;
  assert.equal(storedHash.includes("nuova-password-sicura"), false);
  assert.equal(storedHash.includes("password-iniziale"), false);

  assert.equal((await changePassword({ currentPassword: "password-iniziale", newPassword: "altro" })).status, 401);

  const oldLogin = await fetch(`${baseUrl}/api/account/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "utente.password", password: "password-iniziale" }),
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await fetch(`${baseUrl}/api/account/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "utente.password", password: "nuova-password-sicura" }),
  });
  assert.equal(newLogin.status, 201);

  database.prepare("DELETE FROM user_accounts WHERE id = ?").run(accountId);
});

test("protegge le API amministrative e gestisce il ciclo completo di un ordine", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/admin/orders`);
  assert.equal(unauthorized.status, 401);
  assert.equal((await fetch(`${baseUrl}/api/admin/orders/1/status`, { method: "PATCH" })).status, 401);

  const wrongLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "errata" }),
  });
  assert.equal(wrongLogin.status, 401);

  const wrongUsername = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "altro-admin", password: "test-admin-password" }),
  });
  assert.equal(wrongUsername.status, 401);
  assert.equal((await wrongUsername.json()).error.code, "INVALID_ADMIN_CREDENTIALS");

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "test-admin-password" }),
  });
  const setCookie = login.headers.get("set-cookie");
  const cookie = setCookie.split(";", 1)[0];
  assert.equal(login.status, 201);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);

  const adminFetch = (pathName, options = {}) =>
    fetch(`${baseUrl}${pathName}`, {
      ...options,
      headers: { cookie, ...(options.headers ?? {}) },
    });
  assert.equal((await adminFetch("/api/admin/session")).status, 200);

  const listResponse = await adminFetch("/api/admin/orders");
  const list = await listResponse.json();
  assert.equal(listResponse.status, 200);
  const inProgressOrder = list.data.find((order) => order.status === "in_attesa" && order.itemCount === 3);
  assert.ok(inProgressOrder, "Non trovato un ordine in attesa con 3 elementi");
  assert.equal(inProgressOrder.status, "in_attesa");
  const orderId = inProgressOrder.id;

  const detailResponse = await adminFetch(`/api/admin/orders/${orderId}`);
  const detail = (await detailResponse.json()).data;
  const customFile = detail.items.find((item) => item.itemType === "custom_file");
  assert.equal(detail.status, "in_attesa");
  assert.equal(detail.items.length, 3);
  assert.equal(
    (await fetch(`${baseUrl}/api/admin/orders/${orderId}/items/${customFile.id}/model`)).status,
    401,
  );

  const invalidStatus = await adminFetch(`/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "inventato" }),
  });
  assert.equal(invalidStatus.status, 400);
  assert.equal((await invalidStatus.json()).error.code, "INVALID_ORDER_STATUS");
  assert.equal((await adminFetch(`/api/admin/orders/${orderId}junk/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "in_attesa" }),
  })).status, 404);

  const statusUpdate = await adminFetch(`/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "in_lavorazione" }),
  });
  assert.equal(statusUpdate.status, 200);
  const publicOrders = (await (await fetch(`${baseUrl}/api/orders`)).json()).data;
  assert.equal(publicOrders.find((order) => order.code === detail.code).status, "in_lavorazione");
  assert.equal(
    (await adminFetch(`/api/admin/orders/${orderId}/items/${customFile.id}/model`)).status,
    200,
  );

  const updateResponse = await adminFetch(`/api/admin/orders/${orderId}`, {
    method: "PUT",
  });
  assert.equal(updateResponse.status, 404);

  const updated = (await (await adminFetch(`/api/admin/orders/${orderId}`)).json()).data;
  assert.equal(updated.firstName, "Mauro");
  assert.equal(updated.lastName, "Rossi");
  assert.equal(updated.catalogTotalCents, 2400);
  assert.equal(updated.status, "in_lavorazione");
  assert.equal(updated.items.length, 3);
  assert.equal(updated.items[0].productName, "Vaso Orbitale");
  assert.equal(updated.items.some((item) => item.itemType === "custom_link"), true);

  const updatedCustomFile = updated.items.find((item) => item.itemType === "custom_file");
  assert.equal(
    (await adminFetch(`/api/admin/orders/${orderId}/items/${updatedCustomFile.id}/model`)).status,
    200,
  );
  const deleteResponse = await adminFetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
  assert.equal(deleteResponse.status, 204);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 0);
  assert.equal((await readdir(orderFileDirectory)).length, 0);
  assert.equal((await (await fetch(`${baseUrl}/api/orders`)).json()).data.some((order) => order.code === detail.code), false);

  const logout = await adminFetch("/api/admin/logout", { method: "POST" });
  assert.equal(logout.status, 204);
  assert.equal((await adminFetch("/api/admin/session")).status, 401);
});

test("applica un unico rate limit concorrente alle credenziali amministrative", async () => {
  const attempts = await Promise.all(
    Array.from({ length: 6 }, (_value, index) =>
      fetch(`${baseUrl}${index % 2 === 0 ? "/api/account/login" : "/api/admin/login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "test-admin", password: `errata-${index}` }),
      })
    ),
  );
  assert.equal(attempts.filter(({ status }) => status === 429).length, 1);
  assert.equal(attempts.filter(({ status }) => status === 401).length, 5);
});
