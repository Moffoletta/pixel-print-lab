import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
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

before(async () => {
  uploadDirectory = await mkdtemp(path.join(tmpdir(), "pixel-print-lab-test-"));
  database = openDatabase(":memory:");
  seedDatabase(database);
  server = createApp({ database, uploadDirectory }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  database.close();
  await rm(uploadDirectory, { recursive: true, force: true });
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
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count, 2);
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
