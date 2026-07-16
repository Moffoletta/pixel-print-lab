import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";
import {
  cleanupExpiredUploads,
  MAX_STL_FILE_SIZE,
  UPLOAD_TTL_MS,
} from "../src/custom-model-routes.js";
import { openDatabase, seedDatabase } from "../src/database.js";

let server;
let baseUrl;
let database;
let uploadDirectory;
let orderFileDirectory;
let emailOutboxDirectory;

before(async () => {
  uploadDirectory = await mkdtemp(path.join(tmpdir(), "pixel-print-lab-test-"));
  orderFileDirectory = await mkdtemp(path.join(tmpdir(), "pixel-print-lab-orders-"));
  emailOutboxDirectory = await mkdtemp(path.join(tmpdir(), "pixel-print-lab-emails-"));
  database = openDatabase(":memory:");
  seedDatabase(database);
  server = createApp({
    database,
    uploadDirectory,
    orderFileDirectory,
    emailOutboxDirectory,
    adminPassword: "test-admin-password",
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
    [uploadDirectory, orderFileDirectory, emailOutboxDirectory].map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

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
    "/admin.html",
    "/admin.css",
    "/admin.js",
  ];
  const responses = await Promise.all(paths.map((path) => fetch(`${baseUrl}${path}`)));

  for (const response of responses) {
    assert.equal(response.status, 200);
  }
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
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count, 3);
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
  assert.equal((await extensionResponse.json()).error.code, "INVALID_STL_EXTENSION");
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
  assert.equal(body.error.code, "STL_TOO_LARGE");
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

test("crea una richiesta mista con snapshot, file permanente ed email simulata", async () => {
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
  assert.match(body.data.code, /^PPL-\d{8}-[0-9A-F]{6}$/);

  const order = database.prepare("SELECT * FROM orders WHERE code = ?").get(body.data.code);
  const items = database
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY position")
    .all(order.id);
  assert.equal(order.first_name, "Mauro");
  assert.equal(order.last_name, "Rossi");
  assert.equal(order.catalog_total_cents, 2400);
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
  const email = await readFile(path.join(emailOutboxDirectory, `${body.data.code}.txt`), "utf8");
  assert.match(email, new RegExp(`Codice: ${body.data.code}`));
  assert.match(email, /Nome: Mauro/);
  assert.match(email, /Vaso Orbitale/);
  assert.match(email, /ordine-personale\.stl/);
  assert.match(email, /https:\/\/www\.makerworld\.com\/en\/models\/123-test/);
  assert.match(email, /Totale catalogo: 24,00 EUR/);
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

test("protegge le API amministrative e gestisce il ciclo completo di un ordine", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/admin/orders`);
  assert.equal(unauthorized.status, 401);

  const wrongLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "errata" }),
  });
  assert.equal(wrongLogin.status, 401);

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "test-admin-password" }),
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
  assert.equal(list.count, 1);
  assert.equal(list.data[0].itemCount, 3);
  const orderId = list.data[0].id;

  const detailResponse = await adminFetch(`/api/admin/orders/${orderId}`);
  const detail = (await detailResponse.json()).data;
  const customFile = detail.items.find((item) => item.itemType === "custom_file");
  assert.equal(detail.items.length, 3);
  assert.equal(
    (await fetch(`${baseUrl}/api/admin/orders/${orderId}/items/${customFile.id}/model`)).status,
    401,
  );
  assert.equal(
    (await adminFetch(`/api/admin/orders/${orderId}/items/${customFile.id}/model`)).status,
    200,
  );

  const updateResponse = await adminFetch(`/api/admin/orders/${orderId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Mario",
      lastName: "Bianchi",
      items: [
        { itemType: "catalog", productId: 2, colorId: 4, quantity: 3 },
        { id: customFile.id, itemType: "custom_file", colorId: 3, quantity: 2 },
        { itemType: "catalog", productId: 1, colorId: 2, quantity: 1 },
      ],
    }),
  });
  assert.equal(updateResponse.status, 200);

  const updated = (await (await adminFetch(`/api/admin/orders/${orderId}`)).json()).data;
  assert.equal(updated.firstName, "Mario");
  assert.equal(updated.lastName, "Bianchi");
  assert.equal(updated.catalogTotalCents, 4050);
  assert.equal(updated.items.length, 3);
  assert.equal(updated.items[0].productName, "Dock Controller");
  assert.equal(updated.items[1].colorName, "Arancione");
  assert.equal(updated.items.some((item) => item.itemType === "custom_link"), false);
  const updatedEmail = await readFile(
    path.join(emailOutboxDirectory, `${updated.code}.txt`),
    "utf8",
  );
  assert.match(updatedEmail, /Nome: Mario/);
  assert.match(updatedEmail, /Dock Controller/);
  assert.doesNotMatch(updatedEmail, /MakerWorld/);

  const updatedCustomFile = updated.items.find((item) => item.itemType === "custom_file");
  assert.equal(
    (await adminFetch(`/api/admin/orders/${orderId}/items/${updatedCustomFile.id}/model`)).status,
    200,
  );
  const deleteResponse = await adminFetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
  assert.equal(deleteResponse.status, 204);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 0);
  assert.equal((await readdir(orderFileDirectory)).length, 0);
  assert.equal((await readdir(emailOutboxDirectory)).length, 0);

  const logout = await adminFetch("/api/admin/logout", { method: "POST" });
  assert.equal(logout.status, 204);
  assert.equal((await adminFetch("/api/admin/session")).status, 401);
});
