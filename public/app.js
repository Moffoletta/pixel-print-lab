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
const trackingStatus = document.querySelector("#tracking-status");
const requestList = document.querySelector("#request-list");
const requestTemplate = document.querySelector("#request-template");
const trackingAnnouncement = document.querySelector("#tracking-announcement");
const cartOpenButton = document.querySelector("#cart-open");
const cartCount = document.querySelector("#cart-count");
const cartDialog = document.querySelector("#cart-dialog");
const cartItems = document.querySelector("#cart-items");
const cartItemTemplate = document.querySelector("#cart-item-template");
const cartEmpty = document.querySelector("#cart-empty");
const cartSummaryCount = document.querySelector("#cart-summary-count");
const cartTotal = document.querySelector("#cart-total");
const checkoutOpenButton = document.querySelector("#checkout-open");
const checkoutDialog = document.querySelector("#checkout-dialog");
const checkoutDialogBackdrop = document.querySelector("#checkout-dialog-backdrop");
const checkoutFormView = document.querySelector("#checkout-form-view");
const checkoutCount = document.querySelector("#checkout-count");
const checkoutCustomCount = document.querySelector("#checkout-custom-count");
const checkoutTotal = document.querySelector("#checkout-total");
const checkoutForm = document.querySelector("#checkout-form");
const checkoutFeedback = document.querySelector("#checkout-feedback");
const checkoutSubmitButton = document.querySelector("#checkout-submit");
const orderConfirmation = document.querySelector("#order-confirmation");
const confirmationCode = document.querySelector("#confirmation-code");
const checkoutCustomerNote = document.querySelector("#checkout-customer-note");
const accountOpenButton = document.querySelector("#account-open");
const accountDialog = document.querySelector("#account-dialog");
const accountDialogBackdrop = document.querySelector("#account-dialog-backdrop");
const accountGuestView = document.querySelector("#account-guest-view");
const accountUserView = document.querySelector("#account-user-view");
const accountLoginForm = document.querySelector("#account-login-form");
const accountRegisterForm = document.querySelector("#account-register-form");
const accountGuestFeedback = document.querySelector("#account-guest-feedback");
const accountDisplayName = document.querySelector("#account-display-name");
const accountUsername = document.querySelector("#account-username");
const accountAdminLink = document.querySelector("#account-admin-link");
const accountLogoutButton = document.querySelector("#account-logout");
const accountSettingsButton = document.querySelector("#account-settings");
const accountSettingsPanel = document.querySelector("#account-settings-panel");
const accountPasswordForm = document.querySelector("#account-password-form");
const accountCurrentPassword = document.querySelector("#account-current-password");
const accountNewPassword = document.querySelector("#account-new-password");
const accountPasswordFeedback = document.querySelector("#account-password-feedback");
const accountOrdersRefresh = document.querySelector("#account-orders-refresh");
const accountOrdersStatus = document.querySelector("#account-orders-status");
const accountOrderList = document.querySelector("#account-order-list");
const accountOrderTemplate = document.querySelector("#account-order-template");
const printSceneScreen = document.querySelector("#print-scene-screen");
const printSceneProgressText = document.querySelector("#print-scene-progress-text");
const printSceneProgressBar = document.querySelector("#print-scene-progress-bar");
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
const MAX_MODEL_FILE_SIZE = 50 * 1024 * 1024;
const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});
const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
});

let products = [];
let colors = [];
let productsById = new Map();
let colorsById = new Map();
let cart = readCart();
let viewerModulePromise;
let inspectedUpload;
let uploadGeneration = 0;
let publicOrdersSignature = "";
let trackingLoadVersion = 0;
let currentAccount;
let accountStateVersion = 0;
let accountAuthPending = false;
const publicStatusLabels = {
  in_attesa: "In attesa",
  in_lavorazione: "In lavorazione",
  completato: "Completato",
  consegnato: "Consegnato",
};

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
      item.sourceType === "file" ? `${(item.modelFormat ?? "stl").toUpperCase()} personale` : `Link / ${item.sourceName}`,
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

function discardInspectedUpload() {
  uploadGeneration += 1;
  if (inspectedUpload) fetch(`/api/custom-models/${inspectedUpload.id}`, { method: "DELETE" }).catch(console.error);
  inspectedUpload = undefined;
}

function updateCustomSource() {
  const source = getCustomSource();
  const usesFile = source === "file";
  customFilePanel.hidden = !usesFile;
  customLinkPanel.hidden = usesFile;
  customFileInput.required = usesFile;
  customLinkInput.required = !usesFile;
  if (!usesFile) discardInspectedUpload();
  customFeedback.textContent = "";
  customFeedback.classList.remove("custom-feedback--error");
}

function validateSelectedFile() {
  const file = customFileInput.files[0];
  if (!file) {
    throw new Error("Seleziona un file STL o 3MF.");
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".gcode.3mf")) {
    throw new Error("I file .gcode.3mf non sono supportati.");
  }
  if (!lowerName.endsWith(".stl") && !lowerName.endsWith(".3mf")) {
    throw new Error("Il file deve avere estensione .stl o .3mf.");
  }
  if (file.size === 0) {
    throw new Error("Il file modello e vuoto.");
  }
  if (file.size > MAX_MODEL_FILE_SIZE) {
    throw new Error("Il file modello non puo superare 50 MB.");
  }
  return file;
}

function selectedModelFormat(file) {
  return file.name.toLowerCase().endsWith(".3mf") ? "3mf" : "stl";
}

function uploadMatchesFile(upload, file) {
  return upload?.sourceFileName === file.name && upload.sourceFileSize === file.size && upload.sourceFileModified === file.lastModified;
}

async function uploadModel(file) {
  const uploadData = new FormData();
  uploadData.append("model", file);
  const upload = await parseApiResponse(await fetch("/api/custom-models/upload", { method: "POST", body: uploadData }));
  return { ...upload, sourceFileName: file.name, sourceFileSize: file.size, sourceFileModified: file.lastModified };
}

async function inspectedModelFor(file) {
  if (uploadMatchesFile(inspectedUpload, file)) return inspectedUpload;
  const generation = uploadGeneration;
  const upload = await uploadModel(file);
  const currentFile = customFileInput.files[0];
  if (generation !== uploadGeneration || getCustomSource() !== "file" || !currentFile || !uploadMatchesFile(upload, currentFile)) {
    fetch(`/api/custom-models/${upload.id}`, { method: "DELETE" }).catch(console.error);
    throw new Error("Il file selezionato e cambiato durante il controllo.");
  }
  inspectedUpload = upload;
  return upload;
}

async function parseApiResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message ?? "La richiesta non e riuscita.");
    error.code = body.error?.code;
    error.status = response.status;
    throw error;
  }
  return body.data;
}

function renderAccount() {
  const authenticated = Boolean(currentAccount);
  accountGuestView.hidden = authenticated;
  accountUserView.hidden = !authenticated;
  accountOpenButton.textContent = authenticated ? `@${currentAccount.username}` : "Accedi";
  checkoutCustomerNote.textContent = authenticated
    ? `La richiesta verra salvata nello storico di @${currentAccount.username}.`
    : "Puoi inviare la richiesta come ospite. Accordi e consegna avverranno privatamente.";
  if (!authenticated) {
    accountOrderList.replaceChildren();
    return;
  }
  accountDisplayName.textContent = `${currentAccount.firstName} ${currentAccount.lastName}`;
  accountUsername.textContent = `@${currentAccount.username}`;
  accountAdminLink.hidden = currentAccount.role !== "admin";
}

function renderAccountOrders(orders) {
  const elements = orders.map((order) => {
    const element = accountOrderTemplate.content.firstElementChild.cloneNode(true);
    const date = new Date(`${order.createdAt.replace(" ", "T")}Z`);
    element.querySelector('[data-field="account-order-date"]').textContent = Number.isNaN(date.valueOf())
      ? order.createdAt
      : dateFormatter.format(date);
    element.querySelector('[data-field="account-order-code"]').textContent = order.code;
    element.querySelector('[data-field="account-order-status"]').textContent = publicStatusLabels[order.status] ?? order.status;
    element.querySelector('[data-field="account-order-total"]').textContent = euroFormatter.format(order.catalogTotalCents / 100);
    const deleteButton = element.querySelector('[data-field="account-order-delete"]');
    deleteButton.addEventListener("click", () => deleteAccountOrder(order.code));
    const itemList = element.querySelector('[data-field="account-order-items"]');
    order.items.forEach((item) => {
      const listItem = document.createElement("li");
      const name = document.createElement("span");
      const detail = document.createElement("span");
      name.textContent = item.productName;
      detail.textContent = `${item.colorName} / ${item.quantity} pz.`;
      listItem.append(name, detail);
      itemList.append(listItem);
    });
    return element;
  });
  accountOrderList.replaceChildren(...elements);
  accountOrdersStatus.textContent = orders.length ? "" : "Non hai ancora inviato ordini con questo account.";
}

async function deleteAccountOrder(code) {
  if (!confirm(`Eliminare definitivamente l'ordine ${code}?`)) return;
  try {
    await parseApiResponse(await fetch(`/api/account/orders/${encodeURIComponent(code)}`, { method: "DELETE" }));
    accountOrdersStatus.textContent = "Ordine eliminato.";
    accountOrdersStatus.classList.remove("account-feedback--error");
    await loadAccountOrders();
  } catch (error) {
    accountOrdersStatus.textContent = error.message;
    accountOrdersStatus.classList.add("account-feedback--error");
  }
}

async function loadAccountOrders() {
  if (!currentAccount) return;
  const version = accountStateVersion;
  const accountId = currentAccount.id;
  accountOrdersRefresh.disabled = true;
  accountOrdersStatus.textContent = "Caricamento storico...";
  try {
    const orders = await parseApiResponse(await fetch("/api/account/orders", { cache: "no-store" }));
    if (version !== accountStateVersion || currentAccount?.id !== accountId) return;
    renderAccountOrders(orders);
  } catch (error) {
    if (version !== accountStateVersion || currentAccount?.id !== accountId) return;
    if (error.status === 401) {
      currentAccount = undefined;
      accountStateVersion += 1;
      renderAccount();
    }
    accountOrdersStatus.textContent = error.message;
  } finally {
    if (version === accountStateVersion) accountOrdersRefresh.disabled = false;
  }
}

async function loadAccountSession() {
  const version = accountStateVersion;
  try {
    const response = await fetch("/api/account/session", { cache: "no-store" });
    const account = response.status === 401 ? undefined : await parseApiResponse(response);
    if (version !== accountStateVersion) return;
    currentAccount = account;
  } catch (error) {
    if (version !== accountStateVersion) return;
    console.error(error);
    currentAccount = undefined;
  }
  renderAccount();
}

async function submitAccountForm(form, endpoint) {
  if (accountAuthPending) return;
  accountAuthPending = true;
  const buttons = [
    accountLoginForm.querySelector('[type="submit"]'),
    accountRegisterForm.querySelector('[type="submit"]'),
  ];
  const formData = new FormData(form);
  buttons.forEach((button) => { button.disabled = true; });
  accountGuestFeedback.textContent = "";
  accountGuestFeedback.classList.remove("account-feedback--error");
  const version = ++accountStateVersion;
  try {
    const account = await parseApiResponse(
      await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      }),
    );
    if (version !== accountStateVersion) return;
    currentAccount = account;
    form.reset();
    renderAccount();
    accountDisplayName.focus();
    await loadAccountOrders();
  } catch (error) {
    if (version !== accountStateVersion) return;
    accountGuestFeedback.textContent = error.message;
    accountGuestFeedback.classList.add("account-feedback--error");
  } finally {
    accountAuthPending = false;
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function updatePrintScene(orders) {
  const completed = orders.filter((order) => order.status === "completato").length;
  const pending = orders.length - completed;
  printSceneProgressText.textContent = orders.length ? `Livello ${completed} / ${pending}` : "Livello 0 / 0";
  printSceneProgressBar.style.width = orders.length ? `${(completed / orders.length) * 100}%` : "0%";
  const printingOrder = orders.find((order) => order.status === "in_lavorazione");
  printSceneScreen.textContent = printingOrder ? printingOrder.code : "STANDBY";
}

async function loadPublicOrders() {
  const loadVersion = ++trackingLoadVersion;
  try {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const orders = await parseApiResponse(response);
    if (loadVersion !== trackingLoadVersion) return;
    const signature = JSON.stringify(orders);
    trackingStatus.classList.remove("request-tracker__status--error");
    trackingStatus.textContent = orders.length ? "" : "Nessuna richiesta presente.";
    trackingStatus.hidden = orders.length > 0;
    if (signature === publicOrdersSignature) return;
    const hadPreviousData = publicOrdersSignature !== "";
    publicOrdersSignature = signature;
    requestList.replaceChildren();
    orders.forEach((order, index) => {
      const item = requestTemplate.content.firstElementChild.cloneNode(true);
      item.querySelector('[data-field="request-code"]').textContent = order.code;
      const statusEl = item.querySelector('[data-field="request-status"]');
      statusEl.textContent = publicStatusLabels[order.status] ?? order.status;
      statusEl.dataset.status = order.status;
      item.querySelector('[data-field="request-order"]').textContent = String(index + 1).padStart(2, "0");
      item.querySelector('[data-field="request-animation"]').hidden = order.status !== "in_lavorazione";
      requestList.append(item);
    });
    updatePrintScene(orders);
    trackingAnnouncement.textContent = hadPreviousData ? "Lo stato delle richieste e stato aggiornato." : "Elenco richieste caricato.";
  } catch (error) {
    if (loadVersion !== trackingLoadVersion) return;
    console.error(error);
    trackingStatus.hidden = false;
    trackingStatus.textContent = "Stato richieste non disponibile.";
    trackingStatus.classList.add("request-tracker__status--error");
  }
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
  discardInspectedUpload();
  const file = customFileInput.files[0];
  customFileName.textContent = file?.name ?? "Nessun file selezionato";
  customPreviewButton.disabled = !file;
  customFeedback.textContent = "";
});

customPreviewButton.addEventListener("click", async () => {
  let objectUrl;
  try {
    const file = validateSelectedFile();
    const { openModelViewer } = await getViewerModule();
    if (selectedModelFormat(file) === "3mf") {
      customPreviewButton.disabled = true;
      customFeedback.textContent = "Controllo del progetto 3MF...";
      inspectedUpload = await inspectedModelFor(file);
      await openModelViewer(inspectedUpload);
      const compatibility = inspectedUpload.inspection?.compatibility;
      customFeedback.textContent = compatibility?.status === "incompatible"
        ? compatibility.warnings[0]?.message ?? "Il progetto supera il volume della stampante."
        : "Primo piatto pronto e compreso nel volume standard.";
    } else {
      objectUrl = URL.createObjectURL(file);
      await openModelViewer({ name: file.name, modelUrl: objectUrl, modelFormat: "stl" });
    }
  } catch (error) {
    customFeedback.textContent = error.message;
    customFeedback.classList.add("custom-feedback--error");
  } finally {
    customPreviewButton.disabled = !customFileInput.files[0];
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
  customSubmitButton.textContent = sourceType === "file" ? "Controllo modello..." : "Controllo link...";
  customFeedback.textContent = "";
  customFeedback.classList.remove("custom-feedback--error");

  try {
    let customModel;
    if (sourceType === "file") {
      const file = validateSelectedFile();
      customModel = await inspectedModelFor(file);
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

    const { sourceFileName: _sourceFileName, sourceFileSize: _sourceFileSize, sourceFileModified: _sourceFileModified, ...modelData } = customModel;
    cart = addCustomCartItem(cart, {
      ...modelData,
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
    inspectedUpload = undefined;
    uploadedId = undefined;
  } catch (error) {
    if (uploadedId) {
      fetch(`/api/custom-models/${uploadedId}`, { method: "DELETE" }).catch(console.error);
      if (inspectedUpload?.id === uploadedId) inspectedUpload = undefined;
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
  const customCount = cart.reduce(
    (total, item) => (item.type === "custom" ? total + item.quantity : total),
    0,
  );
  const total = calculateCartTotal(cart, productsById);
  cartCount.textContent = String(count).padStart(2, "0");
  cartOpenButton.setAttribute(
    "aria-label",
    `Apri il carrello, ${count} ${count === 1 ? "elemento" : "elementi"}`,
  );
  cartItems.replaceChildren(...cart.map(createCartItem));
  cartEmpty.hidden = cart.length > 0;
  cartSummaryCount.textContent = count;
  cartTotal.textContent = euroFormatter.format(total / 100);
  checkoutCount.textContent = count;
  checkoutCustomCount.textContent = customCount;
  checkoutTotal.textContent = euroFormatter.format(total / 100);
  checkoutOpenButton.disabled = cart.length === 0;
}

function serializeOrderItem(item) {
  if (item.type === "catalog") {
    return {
      type: "catalog",
      productId: item.productId,
      colorId: item.colorId,
      quantity: item.quantity,
    };
  }
  if (item.sourceType === "file") {
    return {
      type: "custom",
      sourceType: "file",
      id: item.id,
      name: item.name,
      modelFormat: item.modelFormat ?? "stl",
      colorId: item.colorId,
      quantity: item.quantity,
    };
  }
  return {
    type: "custom",
    sourceType: "link",
    externalUrl: item.externalUrl,
    colorId: item.colorId,
    quantity: item.quantity,
  };
}

checkoutOpenButton.addEventListener("click", () => {
  checkoutForm.reset();
  if (currentAccount) {
    checkoutForm.elements.firstName.value = currentAccount.firstName;
    checkoutForm.elements.lastName.value = currentAccount.lastName;
  }
  checkoutFeedback.textContent = "";
  checkoutFeedback.classList.remove("checkout-feedback--error");
  checkoutFormView.hidden = false;
  orderConfirmation.hidden = true;
  confirmationCode.textContent = "";
  cartDialog.close();
  checkoutDialogBackdrop.hidden = false;
  checkoutDialog.show();
  checkoutForm.elements.firstName.focus();
});
checkoutDialog.addEventListener("close", () => {
  checkoutDialogBackdrop.hidden = true;
});
checkoutDialogBackdrop.addEventListener("click", () => checkoutDialog.close());
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !checkoutDialog.open) return;
  if (document.querySelector("dialog:modal")) return;
  checkoutDialog.close();
});

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(checkoutForm);
  checkoutSubmitButton.disabled = true;
  checkoutSubmitButton.textContent = "Invio in corso...";
  checkoutFeedback.textContent = "";
  checkoutFeedback.classList.remove("checkout-feedback--error");

  try {
    const order = await parseApiResponse(
      await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          items: cart.map(serializeOrderItem),
        }),
      }),
    );
    cart = [];
    saveCart();
    renderCart();
    checkoutFormView.hidden = true;
    orderConfirmation.hidden = false;
    confirmationCode.textContent = order.code;
    loadPublicOrders();
    if (currentAccount) loadAccountOrders();
  } catch (error) {
    if (error.code === "SESSION_EXPIRED") {
      currentAccount = undefined;
      accountStateVersion += 1;
      renderAccount();
    }
    checkoutFeedback.textContent = error.message;
    checkoutFeedback.classList.add("checkout-feedback--error");
  } finally {
    checkoutSubmitButton.disabled = false;
    checkoutSubmitButton.textContent = "Conferma e invia";
  }
});

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
accountOpenButton.addEventListener("click", () => {
  accountGuestFeedback.textContent = "";
  accountDialogBackdrop.hidden = false;
  accountDialog.show();
  if (!accountGuestView.hidden) document.querySelector("#login-username").focus();
  if (currentAccount) loadAccountOrders();
});
accountDialog.addEventListener("close", () => {
  accountDialogBackdrop.hidden = true;
});
accountDialogBackdrop.addEventListener("click", () => accountDialog.close());
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !accountDialog.open) return;
  if (document.querySelector("dialog:modal")) return;
  accountDialog.close();
});
accountLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAccountForm(accountLoginForm, "/api/account/login");
});
accountRegisterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAccountForm(accountRegisterForm, "/api/account/register");
});
accountLogoutButton.addEventListener("click", async () => {
  accountLogoutButton.disabled = true;
  const version = ++accountStateVersion;
  try {
    const response = await fetch("/api/account/logout", { method: "POST" });
    if (!response.ok) throw new Error("Disconnessione non riuscita.");
    if (version !== accountStateVersion) return;
    currentAccount = undefined;
    renderAccount();
    document.querySelector("#login-username").focus();
  } catch (error) {
    if (version === accountStateVersion) accountOrdersStatus.textContent = error.message;
  } finally {
    if (version === accountStateVersion) accountLogoutButton.disabled = false;
  }
});

accountSettingsButton.addEventListener("click", () => {
  accountSettingsPanel.hidden = !accountSettingsPanel.hidden;
  if (!accountSettingsPanel.hidden) {
    accountPasswordForm.reset();
    accountPasswordFeedback.textContent = "";
    accountPasswordFeedback.classList.remove("account-feedback--error");
    accountCurrentPassword.focus();
  }
});

accountPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = accountPasswordForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  accountPasswordFeedback.textContent = "";
  accountPasswordFeedback.classList.remove("account-feedback--error");
  const version = ++accountStateVersion;
  try {
    await parseApiResponse(
      await fetch("/api/account/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: accountCurrentPassword.value,
          newPassword: accountNewPassword.value,
        }),
      }),
    );
    if (version !== accountStateVersion) return;
    accountPasswordForm.reset();
    accountPasswordFeedback.textContent = "Password aggiornata.";
    accountSettingsPanel.hidden = true;
  } catch (error) {
    if (version === accountStateVersion) {
      accountPasswordFeedback.textContent = error.message;
      accountPasswordFeedback.classList.add("account-feedback--error");
    }
  } finally {
    if (version === accountStateVersion) submitButton.disabled = false;
  }
});

accountOrdersRefresh.addEventListener("click", loadAccountOrders);
updateCustomSource();
loadAccountSession();
loadCatalog();
loadPublicOrders();
setInterval(() => {
  if (document.visibilityState === "visible") loadPublicOrders();
}, 45_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") loadPublicOrders();
});
