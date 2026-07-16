export const MAX_QUANTITY = 99;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function createKey(productId, colorId) {
  return `${productId}:${colorId}`;
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
    return [...cart, { key, ...selection }];
  }

  return cart.map((item) =>
    item.key === key
      ? { ...item, quantity: Math.min(item.quantity + selection.quantity, MAX_QUANTITY) }
      : item,
  );
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

    return cart.filter((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const { productId, colorId, quantity } = item;
      return (
        isPositiveInteger(productId) &&
        isPositiveInteger(colorId) &&
        isPositiveInteger(quantity) &&
        quantity <= MAX_QUANTITY &&
        item.key === createKey(productId, colorId)
      );
    });
  } catch {
    return [];
  }
}

export function reconcileCart(cart, products, colors) {
  const productIds = new Set(products.map(({ id }) => id));
  const colorIds = new Set(colors.map(({ id }) => id));
  return cart.filter(
    ({ productId, colorId }) => productIds.has(productId) && colorIds.has(colorId),
  );
}
