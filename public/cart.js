export const MAX_QUANTITY = 99;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function createKey(productId, colorId) {
  return `${productId}:${colorId}`;
}

function createCustomKey(id, colorId) {
  return `custom:${id}:${colorId}`;
}

function modelFormatFor(item) {
  if (item.modelFormat === undefined && item.modelUrl === `/uploads/${item.id}.stl`) return "stl";
  return ["stl", "3mf"].includes(item.modelFormat) ? item.modelFormat : null;
}

function isValidInspection(inspection) {
  if (!inspection || typeof inspection !== "object") return false;
  return (
    ["generic", "bambu"].includes(inspection.projectType) &&
    Number.isInteger(inspection.plateCount) && inspection.plateCount > 0 && inspection.plateCount <= 100 &&
    Array.isArray(inspection.previewBuildItemIndexes) && inspection.previewBuildItemIndexes.length <= 10_000 &&
    inspection.previewBuildItemIndexes.every((index) => Number.isInteger(index) && index >= 0) &&
    inspection.boundsMm && Array.isArray(inspection.boundsMm.size) && inspection.boundsMm.size.length === 3 &&
    inspection.boundsMm.size.every((value) => Number.isFinite(value) && value >= 0)
  );
}

function validateSelection({ productId, colorId, quantity }) {
  if (!isPositiveInteger(productId) || !isPositiveInteger(colorId)) {
    throw new TypeError("Prodotto e colore devono avere identificativi numerici positivi.");
  }
  if (!isPositiveInteger(quantity) || quantity > MAX_QUANTITY) {
    throw new RangeError(`La quantita deve essere compresa tra 1 e ${MAX_QUANTITY}.`);
  }
}

export function addCartItem(cart, selection) {
  validateSelection(selection);
  const key = createKey(selection.productId, selection.colorId);
  const existingItem = cart.find((item) => item.key === key);

  if (!existingItem) {
    return [...cart, { type: "catalog", key, ...selection }];
  }

  return cart.map((item) =>
    item.key === key
      ? { ...item, quantity: Math.min(item.quantity + selection.quantity, MAX_QUANTITY) }
      : item,
  );
}

export function addCustomCartItem(cart, selection) {
  const { id, sourceType, name, colorId, quantity } = selection;
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    throw new TypeError("Il modello personale deve avere un identificativo valido.");
  }
  if (!isPositiveInteger(colorId)) {
    throw new TypeError("Il colore deve avere un identificativo numerico positivo.");
  }
  if (!isPositiveInteger(quantity) || quantity > MAX_QUANTITY) {
    throw new RangeError(`La quantita deve essere compresa tra 1 e ${MAX_QUANTITY}.`);
  }
  if (
    !["file", "link"].includes(sourceType) ||
    typeof name !== "string" ||
    name.length === 0 ||
    name.length > 120
  ) {
    throw new TypeError("I dati del modello personale non sono validi.");
  }
  if (sourceType === "file") {
    const format = modelFormatFor(selection);
    if (!format || selection.modelUrl !== `/uploads/${id}.${format}` || (format === "3mf" && !isValidInspection(selection.inspection))) {
      throw new TypeError("Il percorso o i dati del file modello non sono validi.");
    }
  }
  if (sourceType === "link" && !isAllowedExternalUrl(selection.externalUrl)) {
    throw new TypeError("Il link esterno non e valido.");
  }

  const key = createCustomKey(id, colorId);
  const existingItem = cart.find((item) => item.key === key);
  if (existingItem) {
    return cart.map((item) =>
      item.key === key
        ? { ...item, quantity: Math.min(item.quantity + quantity, MAX_QUANTITY) }
        : item,
    );
  }

  const normalizedSelection = sourceType === "file" ? { ...selection, modelFormat: modelFormatFor(selection) } : selection;
  return [...cart, { type: "custom", key, ...normalizedSelection }];
}

export function updateCartQuantity(cart, key, quantity) {
  if (!isPositiveInteger(quantity) || quantity > MAX_QUANTITY) {
    throw new RangeError(`La quantita deve essere compresa tra 1 e ${MAX_QUANTITY}.`);
  }

  return cart.map((item) => (item.key === key ? { ...item, quantity } : item));
}

export function removeCartItem(cart, key) {
  return cart.filter((item) => item.key !== key);
}

export function getCartItemCount(cart) {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

export function calculateCartTotal(cart, productsById) {
  return cart.reduce((total, item) => {
    if (item.type === "custom") {
      return total;
    }
    const product = productsById.get(item.productId);
    return product ? total + product.priceCents * item.quantity : total;
  }, 0);
}

export function parseStoredCart(serializedCart) {
  if (!serializedCart) {
    return [];
  }

  try {
    const cart = JSON.parse(serializedCart);
    if (!Array.isArray(cart)) {
      return [];
    }

    return cart.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      if (item.type === "custom") {
        return isValidStoredCustomItem(item)
          ? [{ ...item, ...(item.sourceType === "file" ? { modelFormat: modelFormatFor(item) } : {}) }]
          : [];
      }
      const { productId, colorId, quantity } = item;
      const valid =
        isPositiveInteger(productId) &&
        isPositiveInteger(colorId) &&
        isPositiveInteger(quantity) &&
        quantity <= MAX_QUANTITY &&
        item.key === createKey(productId, colorId);
      return valid ? [{ ...item, type: "catalog" }] : [];
    });
  } catch {
    return [];
  }
}

export function reconcileCart(cart, products, colors) {
  const productIds = new Set(products.map(({ id }) => id));
  const colorIds = new Set(colors.map(({ id }) => id));
  return cart.filter((item) => {
    if (!colorIds.has(item.colorId)) {
      return false;
    }
    return item.type === "custom" || productIds.has(item.productId);
  });
}

function isAllowedExternalUrl(value) {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const domains = ["printables.com", "thingiverse.com", "makerworld.com", "cults3d.com"];
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    );
  } catch {
    return false;
  }
}

function isValidStoredCustomItem(item) {
  const validBase =
    typeof item.id === "string" &&
    UUID_PATTERN.test(item.id) &&
    typeof item.name === "string" &&
    item.name.length > 0 &&
    item.name.length <= 120 &&
    isPositiveInteger(item.colorId) &&
    isPositiveInteger(item.quantity) &&
    item.quantity <= MAX_QUANTITY &&
    item.key === createCustomKey(item.id, item.colorId);
  if (!validBase) {
    return false;
  }
  if (item.sourceType === "file") {
    const format = modelFormatFor(item);
    return Boolean(format) && item.modelUrl === `/uploads/${item.id}.${format}` && (format !== "3mf" || isValidInspection(item.inspection));
  }
  return (
    item.sourceType === "link" &&
    ["Printables", "Thingiverse", "MakerWorld", "Cults3D"].includes(item.sourceName) &&
    isAllowedExternalUrl(item.externalUrl)
  );
}
