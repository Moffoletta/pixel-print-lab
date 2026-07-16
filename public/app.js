import {
  addCartItem,
  addCustomCartItem,
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
const customForm = document.querySelector("#custom-model-form");
const customSourceInputs = document.querySelectorAll('input[name="custom-source"]');
const customFilePanel = document.querySelector("#custom-file-panel");
const customLinkPanel = document.querySelector("#custom-link-panel");
const customFileInput = document.querySelector("#custom-file");
const customFileName = document.querySelector("#custom-file-name");
const customLinkInput = document.querySelector("#custom-link");
const customPreviewButton = document.querySelector("#custom-preview");
const customColorOptions = document.querySelector("#custom-color-options");
const customQuantityInput = document.querySelector("#custom-quantity");
const customSubmitButton = document.querySelector("#custom-submit");
const customFeedback = document.querySelector("#custom-feedback");
const MAX_STL_FILE_SIZE = 50 * 1024 * 1024;
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

function createColorOption(color, groupName, selected) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  const swatch = document.createElement("span");
  const name = document.createElement("span");

  label.className = "color-option";
  input.type = "radio";
  input.name = groupName;
  input.value = color.id;
  input.checked = selected;
  input.defaultChecked = selected;
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
    colorOptions.append(createColorOption(color, `product-${product.id}-color`, colorIndex === 0));
  });

  if (!product.modelUrl) {
    viewModelButton.disabled = true;
    viewModelButton.textContent = "3D non disponibile";
  } else {
    viewModelButton.addEventListener("click", async () => {
      viewModelButton.disabled = true;
      viewModelButton.textContent = "Caricamento...";
      try {
        const { openModelViewer } = await getViewerModule();
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
  const color = colorsById.get(item.colorId);
  const element = cartItemTemplate.content.firstElementChild.cloneNode(true);
  const swatch = element.querySelector('[data-field="cart-swatch"]');
  const quantityInput = element.querySelector('[data-field="cart-quantity"]');
  const removeButton = element.querySelector('[data-field="cart-remove"]');
  const viewButton = element.querySelector('[data-field="cart-view"]');
  const externalLink = element.querySelector('[data-field="cart-link"]');
  let itemName;

  if (item.type === "custom") {
    itemName = item.name;
    setText(
      element,
      "cart-code",
      item.sourceType === "file" ? "STL personale" : `Link / ${item.sourceName}`,
    );
    setText(element, "cart-name", item.name);
    setText(element, "cart-unit-price", "Prezzo da definire");
    setText(element, "cart-line-total", "Preventivo");
    if (item.sourceType === "file") {
      viewButton.hidden = false;
      viewButton.addEventListener("click", async () => {
        try {
          const { openModelViewer } = await getViewerModule();
          await openModelViewer(item);
        } catch (error) {
          console.error(error);
        }
      });
    } else {
      externalLink.hidden = false;
      externalLink.href = item.externalUrl;
    }
  } else {
    const product = productsById.get(item.productId);
    itemName = product.name;
    setText(element, "cart-code", product.code);
    setText(element, "cart-name", product.name);
    setText(element, "cart-unit-price", `${euroFormatter.format(product.priceCents / 100)} / cad.`);
    setText(
      element,
      "cart-line-total",
      euroFormatter.format((product.priceCents * item.quantity) / 100),
    );
  }

  setText(element, "cart-color", color.name);
  swatch.style.backgroundColor = color.hexValue;
  quantityInput.value = item.quantity;
  quantityInput.setAttribute("aria-label", `Quantita per ${itemName}, colore ${color.name}`);

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
    const uploadStillUsed = cart.some(
      (cartItem) => cartItem.type === "custom" && cartItem.id === item.id,
    );
    if (item.type === "custom" && item.sourceType === "file" && !uploadStillUsed) {
      fetch(`/api/custom-models/${item.id}`, { method: "DELETE" }).catch(console.error);
    }
    saveCart();
    renderCart();
  });

  return element;
}

function getViewerModule() {
  viewerModulePromise ??= import("./viewer.js");
  return viewerModulePromise;
}

function getCustomSource() {
  return customForm.elements.namedItem("custom-source").value;
}

function updateCustomSource() {
  const source = getCustomSource();
  const usesFile = source === "file";
  customFilePanel.hidden = !usesFile;
  customLinkPanel.hidden = usesFile;
  customFileInput.required = usesFile;
  customLinkInput.required = !usesFile;
  customFeedback.textContent = "";
  customFeedback.classList.remove("custom-feedback--error");
}

function validateSelectedFile() {
  const file = customFileInput.files[0];
  if (!file) {
    throw new Error("Seleziona un file STL.");
  }
  if (!file.name.toLowerCase().endsWith(".stl")) {
    throw new Error("Il file deve avere estensione .stl.");
  }
  if (file.size === 0) {
    throw new Error("Il file STL e vuoto.");
  }
  if (file.size > MAX_STL_FILE_SIZE) {
    throw new Error("Il file STL non puo superare 50 MB.");
  }
  return file;
}

async function parseApiResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message ?? "La richiesta non e riuscita.");
  }
  return body.data;
}

async function reconcileUploadedFiles(items) {
  const checks = await Promise.all(
    items.map(async (item) => {
      if (item.type !== "custom" || item.sourceType !== "file") {
        return true;
      }
      try {
        const response = await fetch(item.modelUrl, { method: "HEAD" });
        return response.status !== 404;
      } catch {
        return true;
      }
    }),
  );
  return items.filter((_item, index) => checks[index]);
}

customSourceInputs.forEach((input) => input.addEventListener("change", updateCustomSource));

customFileInput.addEventListener("change", () => {
  const file = customFileInput.files[0];
  customFileName.textContent = file?.name ?? "Nessun file selezionato";
  customPreviewButton.disabled = !file;
  customFeedback.textContent = "";
});

customPreviewButton.addEventListener("click", async () => {
  let objectUrl;
  try {
    const file = validateSelectedFile();
    objectUrl = URL.createObjectURL(file);
    const { openModelViewer } = await getViewerModule();
    await openModelViewer({ name: file.name, modelUrl: objectUrl });
  } catch (error) {
    customFeedback.textContent = error.message;
    customFeedback.classList.add("custom-feedback--error");
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
});

customForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const sourceType = getCustomSource();
  const colorId = Number(customForm.elements.namedItem("custom-color").value);
  const quantity = Number(customQuantityInput.value);
  let uploadedId;

  customSubmitButton.disabled = true;
  customSubmitButton.textContent = sourceType === "file" ? "Caricamento STL..." : "Controllo link...";
  customFeedback.textContent = "";
  customFeedback.classList.remove("custom-feedback--error");

  try {
    let customModel;
    if (sourceType === "file") {
      const uploadData = new FormData();
      uploadData.append("model", validateSelectedFile());
      customModel = await parseApiResponse(
        await fetch("/api/custom-models/upload", { method: "POST", body: uploadData }),
      );
      uploadedId = customModel.id;
    } else {
      customModel = await parseApiResponse(
        await fetch("/api/custom-models/link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: customLinkInput.value }),
        }),
      );
    }

    cart = addCustomCartItem(cart, {
      ...customModel,
      sourceType,
      colorId,
      quantity,
    });
    saveCart();
    renderCart();
    customForm.reset();
    customFileName.textContent = "Nessun file selezionato";
    customPreviewButton.disabled = true;
    updateCustomSource();
    customFeedback.textContent = "Richiesta aggiunta al carrello. Prezzo da definire.";
    uploadedId = undefined;
  } catch (error) {
    if (uploadedId) {
      fetch(`/api/custom-models/${uploadedId}`, { method: "DELETE" }).catch(console.error);
    }
    customFeedback.textContent = error.message;
    customFeedback.classList.add("custom-feedback--error");
  } finally {
    customSubmitButton.disabled = colors.length === 0;
    customSubmitButton.textContent = "Aggiungi richiesta al carrello";
  }
});

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
    cart = await reconcileUploadedFiles(cart);
    saveCart();

    if (colors.length === 0) {
      throw new Error("Nessun colore disponibile.");
    }

    colors.forEach((color, index) => {
      customColorOptions.append(createColorOption(color, "custom-color", index === 0));
    });
    cartOpenButton.disabled = false;
    customSubmitButton.disabled = false;
    renderCart();

    if (products.length === 0) {
      catalogStatus.textContent = "Nessun modello disponibile al momento.";
      return;
    }

    const cards = document.createDocumentFragment();
    products.forEach((product, index) => cards.append(createProductCard(product, index)));
    productList.append(cards);
    catalogStatus.hidden = true;
  } catch (error) {
    console.error(error);
    catalogStatus.textContent = "Catalogo non disponibile. Riprova tra poco.";
    catalogStatus.classList.add("catalog-status--error");
  } finally {
    productList.setAttribute("aria-busy", "false");
  }
}

cartOpenButton.addEventListener("click", () => cartDialog.showModal());
updateCustomSource();
loadCatalog();
