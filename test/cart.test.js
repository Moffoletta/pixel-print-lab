import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addCartItem,
  addCustomCartItem,
  calculateCartTotal,
  getCartItemCount,
  parseStoredCart,
  reconcileCart,
  removeCartItem,
  updateCartQuantity,
} from "../public/cart.js";

const firstSelection = { productId: 1, colorId: 2, quantity: 3 };

test("aggiunge e unisce configurazioni uguali", () => {
  const initialCart = addCartItem([], firstSelection);
  const updatedCart = addCartItem(initialCart, { ...firstSelection, quantity: 2 });

  assert.deepEqual(updatedCart, [
    { type: "catalog", key: "1:2", productId: 1, colorId: 2, quantity: 5 },
  ]);
  assert.equal(getCartItemCount(updatedCart), 5);
});

test("mantiene separati colori diversi e limita la quantita a 99", () => {
  let cart = addCartItem([], { productId: 1, colorId: 1, quantity: 98 });
  cart = addCartItem(cart, { productId: 1, colorId: 1, quantity: 2 });
  cart = addCartItem(cart, { productId: 1, colorId: 2, quantity: 1 });

  assert.equal(cart.length, 2);
  assert.equal(cart[0].quantity, 99);
  assert.equal(cart[1].quantity, 1);
});

test("aggiorna e rimuove un elemento", () => {
  const cart = addCartItem([], firstSelection);
  const updatedCart = updateCartQuantity(cart, "1:2", 7);
  const emptyCart = removeCartItem(updatedCart, "1:2");

  assert.equal(updatedCart[0].quantity, 7);
  assert.deepEqual(emptyCart, []);
  assert.throws(() => updateCartQuantity(cart, "1:2", 100), RangeError);
});

test("calcola il totale usando i prezzi correnti del catalogo", () => {
  const cart = [
    { key: "1:1", productId: 1, colorId: 1, quantity: 2 },
    { key: "2:1", productId: 2, colorId: 1, quantity: 3 },
  ];
  const products = new Map([
    [1, { priceCents: 1200 }],
    [2, { priceCents: 950 }],
  ]);

  assert.equal(calculateCartTotal(cart, products), 5250);
});

test("ignora dati locali corrotti o non validi", () => {
  assert.deepEqual(parseStoredCart("testo non JSON"), []);
  assert.deepEqual(parseStoredCart('{"item": 1}'), []);
  assert.deepEqual(
    parseStoredCart('[{"key":"1:2","productId":1,"colorId":2,"quantity":4},{"bad":true}]'),
    [{ key: "1:2", productId: 1, colorId: 2, quantity: 4, type: "catalog" }],
  );
});

test("rimuove configurazioni non piu disponibili", () => {
  const cart = [
    { key: "1:1", productId: 1, colorId: 1, quantity: 1 },
    { key: "2:9", productId: 2, colorId: 9, quantity: 1 },
  ];

  assert.deepEqual(reconcileCart(cart, [{ id: 1 }, { id: 2 }], [{ id: 1 }]), [cart[0]]);
});

test("aggiunge un modello personale senza influire sul totale", () => {
  const custom = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    sourceType: "file",
    name: "modello.stl",
    modelUrl: "/uploads/123e4567-e89b-42d3-a456-426614174000.stl",
    colorId: 1,
    quantity: 2,
  };
  const cart = addCustomCartItem([], custom);

  assert.equal(cart[0].type, "custom");
  assert.equal(cart[0].key, "custom:123e4567-e89b-42d3-a456-426614174000:1");
  assert.equal(calculateCartTotal(cart, new Map()), 0);
});

test("conserva link autorizzati e scarta link manipolati", () => {
  const id = "123e4567-e89b-42d3-a456-426614174001";
  const validLink = {
    id,
    sourceType: "link",
    name: "Modello da Printables",
    externalUrl: "https://www.printables.com/model/123",
    sourceName: "Printables",
    colorId: 2,
    quantity: 1,
  };
  const cart = addCustomCartItem([], validLink);
  const restored = parseStoredCart(JSON.stringify(cart));
  const manipulated = parseStoredCart(
    JSON.stringify([{ ...cart[0], externalUrl: "https://printables.com.example.org/model/123" }]),
  );

  assert.deepEqual(restored, cart);
  assert.deepEqual(manipulated, []);
});

test("normalizza gli elementi catalogo salvati dalle versioni precedenti", () => {
  const restored = parseStoredCart(
    '[{"key":"1:2","productId":1,"colorId":2,"quantity":4}]',
  );

  assert.equal(restored[0].type, "catalog");
});
