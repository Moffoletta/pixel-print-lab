import {
  addCartItem,
  calculateCartTotal,
  getCartItemCount,
  parseStoredCart,
  reconcileCart,
  removeCartItem,
  updateCartQuantity,
} from "./cart.js";

const CART_STORAGE_KEY = "pixel-print-lab:cart:v1";
const productList = document.querySelector("#product-list");
const productTemplate = document.querySelector("#product-template");
const catalogStatus = document.querySelector("#catalog-status");
const cartOpenButton = document.querySelector("#cart-open");
const cartCount = document.querySelector("#cart-count");
const cartDialog = document.querySelector("#cart-dialog");
const cartItems = document.querySelector("#cart-items");
const cartItemTemplate = document.querySelector("#cart-item-template");
const cartEmpty = document.querySelector("#cart-empty");
const cartSummaryCount = document.querySelector("#cart-summary-count");
const cartTotal = document.querySelector("#cart-total");
const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

let products = [];
let colors = [];
let productsById = new Map();
let colorsById = new Map();
let cart = readCart();
let viewerModulePromise;

function readCart() {
  try {
    return parseStoredCart(localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.warn("Impossibile salvare il carrello nel browser.", error);
  }
}

function setText(element, field, value) {
  element.querySelector(`[data-field="${field}"]`).textContent = value;
}

function createColorOption(color, productId, selected) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  const swatch = document.createElement("span");
  const name = document.createElement("span");

  label.className = "color-option";
  input.type = "radio";
  input.name = `product-${productId}-color`;
  input.value = color.id;
  input.checked = selected;
  input.required = true;
  swatch.className = "color-option__swatch";
  swatch.style.backgroundColor = color.hexValue;
  name.textContent = color.name;

  label.append(input, swatch, name);
  return label;
}

function createProductCard(product, index) {
  const card = productTemplate.content.firstElementChild.cloneNode(true);
  const image = card.querySelector('[data-field="image"]');
  const price = card.querySelector('[data-field="price"]');
  const form = card.querySelector('[data-field="config-form"]');
  const colorOptions = card.querySelector('[data-field="color-options"]');
  const quantityInput = card.querySelector('[data-field="quantity"]');
  const feedback = card.querySelector('[data-field="feedback"]');
  const viewModelButton = card.querySelector('[data-field="view-model"]');

  card.dataset.product = product.slug;
  if (index % 2 === 1) {
    card.classList.add("product-card--blue");
  }

  setText(card, "code", product.code);
  setText(card, "category", product.category);
  setText(card, "name", product.name);
  setText(card, "description", product.description);
  setText(card, "dimension-label", product.dimension.label);
  setText(card, "dimension-value", product.dimension.value);
  setText(card, "material", product.material);

  image.src = product.imageUrl;
  image.alt = product.imageAlt;
  price.value = (product.priceCents / 100).toFixed(2);
  price.textContent = euroFormatter.format(product.priceCents / 100);
  colors.forEach((color, colorIndex) => {
    colorOptions.append(createColorOption(color, product.id, colorIndex === 0));
  });

  if (!product.modelUrl) {
    viewModelButton.disabled = true;
    viewModelButton.textContent = "3D non disponibile";
  } else {
    viewModelButton.addEventListener("click", async () => {
      viewModelButton.disabled = true;
      viewModelButton.textContent = "Caricamento...";
      try {
        viewerModulePromise ??= import("./viewer.js");
        const { openModelViewer } = await viewerModulePromise;
        await openModelViewer(product);
      } catch (error) {
        console.error(error);
        feedback.textContent = "Impossibile aprire il modello 3D.";
      } finally {
        viewModelButton.disabled = false;
        viewModelButton.textContent = "Apri 3D";
      }
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const colorId = Number(formData.get(`product-${product.id}-color`));
    const quantity = Number(quantityInput.value);
    const existingItem = cart.find(
      (item) => item.productId === product.id && item.colorId === colorId,
    );

    cart = addCartItem(cart, { productId: product.id, colorId, quantity });
    saveCart();
    renderCart();
    feedback.textContent = existingItem
      ? "Quantita aggiornata nel carrello."
      : "Aggiunto al carrello."
  });

  return card;
}

function createCartItem(item) {
  const product = productsById.get(item.productId);
  const color = colorsById.get(item.colorId);
  const element = cartItemTemplate.content.firstElementChild.cloneNode(true);
  const swatch = element.querySelector('[data-field="cart-swatch"]');
  const quantityInput = element.querySelector('[data-field="cart-quantity"]');
  const removeButton = element.querySelector('[data-field="cart-remove"]');

  setText(element, "cart-code", product.code);
  setText(element, "cart-name", product.name);
  setText(element, "cart-color", color.name);
  setText(element, "cart-unit-price", `${euroFormatter.format(product.priceCents / 100)} / cad.`);
  setText(
    element,
    "cart-line-total",
    euroFormatter.format((product.priceCents * item.quantity) / 100),
  );
  swatch.style.backgroundColor = color.hexValue;
  quantityInput.value = item.quantity;
  quantityInput.setAttribute("aria-label", `Quantita per ${product.name}, colore ${color.name}`);

  quantityInput.addEventListener("change", () => {
    const quantity = Number(quantityInput.value);
    if (!quantityInput.checkValidity() || !Number.isInteger(quantity)) {
      quantityInput.value = item.quantity;
      quantityInput.reportValidity();
      return;
    }
    cart = updateCartQuantity(cart, item.key, quantity);
    saveCart();
    renderCart();
  });

  removeButton.addEventListener("click", () => {
    cart = removeCartItem(cart, item.key);
    saveCart();
    renderCart();
  });

  return element;
}

function renderCart() {
  const count = getCartItemCount(cart);
  cartCount.textContent = String(count).padStart(2, "0");
  cartOpenButton.setAttribute(
    "aria-label",
    `Apri il carrello, ${count} ${count === 1 ? "elemento" : "elementi"}`,
  );
  cartItems.replaceChildren(...cart.map(createCartItem));
  cartEmpty.hidden = cart.length > 0;
  cartSummaryCount.textContent = count;
  cartTotal.textContent = euroFormatter.format(calculateCartTotal(cart, productsById) / 100);
}

async function loadCatalog() {
  try {
    const [productsResponse, colorsResponse] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/colors"),
    ]);
    if (!productsResponse.ok || !colorsResponse.ok) {
      throw new Error(
        `Richiesta catalogo fallita: prodotti ${productsResponse.status}, colori ${colorsResponse.status}`,
      );
    }

    ({ data: products } = await productsResponse.json());
    ({ data: colors } = await colorsResponse.json());
    productsById = new Map(products.map((product) => [product.id, product]));
    colorsById = new Map(colors.map((color) => [color.id, color]));
    cart = reconcileCart(cart, products, colors);
    saveCart();

    if (products.length === 0) {
      catalogStatus.textContent = "Nessun modello disponibile al momento.";
      return;
    }
    if (colors.length === 0) {
      throw new Error("Nessun colore disponibile.");
    }

    const cards = document.createDocumentFragment();
    products.forEach((product, index) => cards.append(createProductCard(product, index)));
    productList.append(cards);
    catalogStatus.hidden = true;
    cartOpenButton.disabled = false;
    renderCart();
  } catch (error) {
    console.error(error);
    catalogStatus.textContent = "Catalogo non disponibile. Riprova tra poco.";
    catalogStatus.classList.add("catalog-status--error");
  } finally {
    productList.setAttribute("aria-busy", "false");
  }
}

cartOpenButton.addEventListener("click", () => cartDialog.showModal());
loadCatalog();
