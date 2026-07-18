const loginView = document.querySelector("#login-view");
const loginForm = document.querySelector("#login-form");
const loginFeedback = document.querySelector("#login-feedback");
const dashboardView = document.querySelector("#dashboard-view");
const logoutButton = document.querySelector("#logout-button");
const settingsButton = document.querySelector("#settings-button");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsForm = document.querySelector("#settings-form");
const emailNotificationsInput = document.querySelector("#email-notifications-enabled");
const smtpStatus = document.querySelector("#smtp-status");
const settingsFeedback = document.querySelector("#settings-feedback");
const credentialsForm = document.querySelector("#credentials-form");
const credentialsUsername = document.querySelector("#credentials-username");
const credentialsCurrentPassword = document.querySelector("#credentials-current-password");
const credentialsNewPassword = document.querySelector("#credentials-new-password");
const credentialsFeedback = document.querySelector("#credentials-feedback");
const orderCount = document.querySelector("#order-count");
const orderListStatus = document.querySelector("#order-list-status");
const orderList = document.querySelector("#order-list");
const orderListTemplate = document.querySelector("#order-list-template");
const orderEmpty = document.querySelector("#order-empty");
const orderForm = document.querySelector("#order-form");
const orderDate = document.querySelector("#order-date");
const orderCode = document.querySelector("#order-code");
const orderTotal = document.querySelector("#order-total");
const orderStatusSelect = document.querySelector("#order-status");
const saveOrderStatusButton = document.querySelector("#save-order-status");
const firstNameValue = document.querySelector("#order-first-name");
const lastNameValue = document.querySelector("#order-last-name");
const adminItems = document.querySelector("#admin-items");
const adminItemTemplate = document.querySelector("#admin-item-template");
const orderFeedback = document.querySelector("#order-feedback");
const deleteOrderButton = document.querySelector("#delete-order");
const ordersView = document.querySelector("#orders-view");
const catalogView = document.querySelector("#catalog-view");
const navigationButtons = document.querySelectorAll("[data-view]");
const productCount = document.querySelector("#product-count");
const productList = document.querySelector("#product-list");
const productListTemplate = document.querySelector("#product-list-template");
const newProductButton = document.querySelector("#new-product");
const productForm = document.querySelector("#product-form");
const productFormTitle = document.querySelector("#product-form-title");
const productFeedback = document.querySelector("#product-feedback");
const deleteProductButton = document.querySelector("#delete-product");
const assetSummary = document.querySelector("#asset-summary");
const colorList = document.querySelector("#color-list");
const colorTemplate = document.querySelector("#color-template");
const newColorForm = document.querySelector("#new-color-form");
const colorFeedback = document.querySelector("#color-feedback");
const euroFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });

let orders = [];
let products = [];
let colors = [];
let currentOrder;
let selectedProductId;
const orderStatusLabels = {
  in_attesa: "In attesa",
  in_lavorazione: "In lavorazione",
  completato: "Completato",
};

async function api(path, options = {}) {
  const response = await fetch(path, options);
  if (response.status === 401 && path !== "/api/admin/login") {
    showLogin();
    throw new Error("Sessione scaduta. Accedi nuovamente.");
  }
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message ?? "Operazione non riuscita.");
  return body.data;
}

function formatDate(value) {
  return dateFormatter.format(new Date(`${value.replace(" ", "T")}Z`));
}

function showLogin() {
  if (settingsDialog.open) settingsDialog.close();
  dashboardView.hidden = true;
  loginView.hidden = false;
  loginForm.reset();
}

async function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  await loadCatalog();
  await loadOrders();
}

async function loadSettings() {
  settingsFeedback.textContent = "";
  settingsFeedback.classList.remove("admin-feedback--error");
  const settings = await api("/api/admin/settings");
  emailNotificationsInput.checked = settings.emailNotificationsEnabled;
  emailNotificationsInput.disabled = !settings.smtpConfigured && !settings.emailNotificationsEnabled;
  smtpStatus.textContent = settings.smtpConfigured
    ? `SMTP configurato. Destinatario: ${settings.smtpRecipient}`
    : "SMTP non configurato. Aggiungi le variabili richieste prima di attivare l'invio.";
  smtpStatus.dataset.configured = String(settings.smtpConfigured);
  credentialsForm.reset();
  credentialsUsername.value = settings.adminUsername;
  credentialsFeedback.textContent = "";
  credentialsFeedback.classList.remove("admin-feedback--error");
}

function renderOrderList() {
  orderList.replaceChildren();
  orderCount.textContent = String(orders.length).padStart(2, "0");
  orderListStatus.hidden = orders.length > 0;
  orderListStatus.textContent = orders.length ? "" : "Nessuna richiesta presente.";
  const fragment = document.createDocumentFragment();
  orders.forEach((order) => {
    const button = orderListTemplate.content.firstElementChild.cloneNode(true);
    button.dataset.orderId = order.id;
    button.querySelector('[data-field="list-code"]').textContent = order.code;
    button.querySelector('[data-field="list-name"]').textContent = `${order.firstName} ${order.lastName}`;
    button.querySelector('[data-field="list-status"]').textContent = orderStatusLabels[order.status] ?? order.status;
    button.querySelector('[data-field="list-status"]').dataset.status = order.status;
    button.querySelector('[data-field="list-pieces"]').textContent = order.pieceCount;
    button.querySelector('[data-field="list-date"]').textContent = formatDate(order.createdAt);
    button.classList.toggle("order-list-item--active", currentOrder?.id === order.id);
    button.addEventListener("click", () => loadOrder(order.id));
    fragment.append(button);
  });
  orderList.append(fragment);
}

async function loadOrders() {
  orderListStatus.hidden = false;
  orderListStatus.textContent = "Caricamento richieste...";
  const result = await api("/api/admin/orders");
  orders = result;
  renderOrderList();
  if (currentOrder && orders.some((order) => order.id === currentOrder.id)) {
    await loadOrder(currentOrder.id);
  } else if (orders.length > 0) {
    await loadOrder(orders[0].id);
  } else {
    currentOrder = undefined;
    orderForm.hidden = true;
    orderEmpty.hidden = false;
  }
}

function createItemEditor(item) {
  const element = adminItemTemplate.content.firstElementChild.cloneNode(true);
  const productField = element.querySelector('[data-field="product-field"]');
  const modelLink = element.querySelector('[data-field="model-link"]');
  const externalLink = element.querySelector('[data-field="external-link"]');

  element.dataset.itemId = item.id ?? "";
  element.dataset.itemType = item.itemType;
  element.querySelector('[data-field="item-type"]').textContent = item.itemType.replace("_", " ");
  element.querySelector('[data-field="item-name"]').textContent = item.productName;
  element.querySelector('[data-field="color"]').textContent = item.colorName;
  element.querySelector('[data-field="quantity"]').textContent = item.quantity;

  if (item.itemType === "catalog") {
    element.querySelector('[data-field="product"]').textContent = item.productCode;
  } else {
    productField.hidden = true;
    if (item.itemType === "custom_file") {
      modelLink.hidden = false;
      modelLink.href = `/api/admin/orders/${currentOrder.id}/items/${item.id}/model`;
      modelLink.textContent = `Scarica ${(item.modelFormat ?? "stl").toUpperCase()}`;
      modelLink.download = item.originalName ?? "modello";
      const compatibility = item.modelMetadata?.compatibility;
      if (compatibility) modelLink.title = `Verifica piatto standard: ${compatibility.status}`;
    }
    if (item.itemType === "custom_link") {
      externalLink.hidden = false;
      externalLink.href = item.externalUrl;
    }
  }

  return element;
}

async function loadOrder(id) {
  currentOrder = await api(`/api/admin/orders/${id}`);
  orderEmpty.hidden = true;
  orderForm.hidden = false;
  orderDate.textContent = formatDate(currentOrder.createdAt);
  orderCode.textContent = currentOrder.code;
  orderTotal.textContent = euroFormatter.format(currentOrder.catalogTotalCents / 100);
  orderStatusSelect.value = currentOrder.status;
  firstNameValue.textContent = currentOrder.firstName;
  lastNameValue.textContent = currentOrder.lastName;
  adminItems.replaceChildren(...currentOrder.items.map(createItemEditor));
  orderFeedback.textContent = "";
  renderOrderList();
}

function showSection(name) {
  ordersView.hidden = name !== "orders";
  catalogView.hidden = name !== "catalog";
  navigationButtons.forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle("admin-nav__button--active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
}

function renderProductList() {
  productList.replaceChildren();
  productCount.textContent = String(products.length).padStart(2, "0");
  products.forEach((product) => {
    const button = productListTemplate.content.firstElementChild.cloneNode(true);
    button.querySelector('[data-field="product-code"]').textContent = product.code;
    button.querySelector('[data-field="product-name"]').textContent = product.name;
    button.querySelector('[data-field="product-status"]').textContent = product.visible ? "Visibile" : "Nascosto";
    button.querySelector('[data-field="product-price"]').textContent = euroFormatter.format(product.priceCents / 100);
    button.classList.toggle("order-list-item--active", product.id === selectedProductId);
    button.addEventListener("click", () => selectProduct(product.id));
    productList.append(button);
  });
}

function renderAssetSummary(product) {
  assetSummary.replaceChildren();
  if (!product) {
    assetSummary.textContent = "L'immagine e obbligatoria. Il modello STL e facoltativo.";
    return;
  }
  const imageLink = document.createElement("a");
  imageLink.href = product.imageUrl;
  imageLink.target = "_blank";
  imageLink.rel = "noopener";
  imageLink.textContent = "Apri immagine attuale";
  assetSummary.append(imageLink);
  if (product.modelUrl) {
    const modelLink = document.createElement("a");
    modelLink.href = product.modelUrl;
    modelLink.target = "_blank";
    modelLink.rel = "noopener";
    modelLink.textContent = "Apri STL attuale";
    assetSummary.append(modelLink);
  }
}

function newProduct() {
  selectedProductId = undefined;
  productForm.reset();
  productForm.elements.visible.checked = true;
  productForm.elements.sortOrder.value = (Math.max(0, ...products.map((product) => product.sortOrder)) + 10);
  productForm.elements.image.required = true;
  productFormTitle.textContent = "Nuovo prodotto";
  deleteProductButton.hidden = true;
  productFeedback.textContent = "";
  renderAssetSummary();
  renderProductList();
}

function selectProduct(id) {
  const product = products.find((entry) => entry.id === id);
  if (!product) return newProduct();
  selectedProductId = id;
  productForm.reset();
  for (const field of ["code", "slug", "name", "category", "description", "priceCents", "imageAlt", "dimensionLabel", "dimensionValue", "material", "sortOrder"]) {
    productForm.elements[field].value = product[field];
  }
  productForm.elements.visible.checked = product.visible;
  productForm.elements.image.required = false;
  productFormTitle.textContent = product.name;
  deleteProductButton.hidden = false;
  productFeedback.textContent = "";
  renderAssetSummary(product);
  renderProductList();
}

function renderColors() {
  colorList.replaceChildren();
  colors.forEach((color, index) => {
    const form = colorTemplate.content.firstElementChild.cloneNode(true);
    const nameInput = form.querySelector('[data-field="name"]');
    const hexInput = form.querySelector('[data-field="hex"]');
    const activeInput = form.querySelector('[data-field="active"]');
    const swatch = form.querySelector('[data-field="swatch"]');
    nameInput.value = color.name;
    hexInput.value = color.hexValue;
    activeInput.checked = color.active;
    swatch.style.backgroundColor = color.hexValue;
    hexInput.addEventListener("input", () => { swatch.style.backgroundColor = hexInput.value; });
    form.querySelector('[data-field="up"]').disabled = index === 0;
    form.querySelector('[data-field="down"]').disabled = index === colors.length - 1;
    form.querySelector('[data-field="up"]').addEventListener("click", () => moveColor(index, -1));
    form.querySelector('[data-field="down"]').addEventListener("click", () => moveColor(index, 1));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api(`/api/admin/colors/${color.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: nameInput.value,
            hexValue: hexInput.value,
            active: activeInput.checked,
            sortOrder: color.sortOrder,
          }),
        });
        await loadCatalog(selectedProductId, true);
        colorFeedback.textContent = "Colore salvato.";
        colorFeedback.classList.remove("admin-feedback--error");
      } catch (error) {
        colorFeedback.textContent = error.message;
        colorFeedback.classList.add("admin-feedback--error");
      }
    });
    colorList.append(form);
  });
}

async function moveColor(index, direction) {
  const reordered = [...colors];
  [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
  try {
    colors = await api("/api/admin/colors/order", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((color) => color.id) }),
    });
    renderColors();
  } catch (error) {
    colorFeedback.textContent = error.message;
    colorFeedback.classList.add("admin-feedback--error");
  }
}

async function loadCatalog(productId = selectedProductId, preserveProductForm = false) {
  const catalog = await api("/api/admin/catalog");
  products = catalog.products;
  colors = catalog.colors;
  renderColors();
  if (preserveProductForm) {
    renderProductList();
    return;
  }
  if (productId && products.some((product) => product.id === productId)) selectProduct(productId);
  else newProduct();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button");
  button.disabled = true;
  loginFeedback.textContent = "";
  loginFeedback.classList.remove("admin-feedback--error");
  try {
    const formData = new FormData(loginForm);
    await api("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    });
    await showDashboard();
  } catch (error) {
    loginFeedback.textContent = error.message;
    loginFeedback.classList.add("admin-feedback--error");
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  if (settingsDialog.open) settingsDialog.close();
  await api("/api/admin/logout", { method: "POST" });
  showLogin();
});

settingsButton.addEventListener("click", async () => {
  settingsDialog.showModal();
  try {
    await loadSettings();
  } catch (error) {
    settingsFeedback.textContent = error.message;
    settingsFeedback.classList.add("admin-feedback--error");
  }
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = settingsForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  settingsFeedback.textContent = "";
  settingsFeedback.classList.remove("admin-feedback--error");
  try {
    await api("/api/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emailNotificationsEnabled: emailNotificationsInput.checked }),
    });
    settingsFeedback.textContent = "Impostazioni salvate.";
    await loadSettings();
    settingsFeedback.textContent = "Impostazioni salvate.";
  } catch (error) {
    settingsFeedback.textContent = error.message;
    settingsFeedback.classList.add("admin-feedback--error");
  } finally {
    submitButton.disabled = false;
  }
});

credentialsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = credentialsForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  credentialsFeedback.textContent = "";
  credentialsFeedback.classList.remove("admin-feedback--error");
  try {
    await api("/api/admin/credentials", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: credentialsUsername.value,
        currentPassword: credentialsCurrentPassword.value,
        password: credentialsNewPassword.value || undefined,
      }),
    });
    showLogin();
    loginFeedback.textContent = "Credenziali aggiornate. Accedi con le nuove credenziali.";
    loginFeedback.classList.remove("admin-feedback--error");
  } catch (error) {
    credentialsFeedback.textContent = error.message;
    credentialsFeedback.classList.add("admin-feedback--error");
  } finally {
    submitButton.disabled = false;
  }
});

saveOrderStatusButton.addEventListener("click", async () => {
  if (!currentOrder) return;
  const orderId = currentOrder.id;
  const requestedStatus = orderStatusSelect.value;
  saveOrderStatusButton.disabled = true;
  orderFeedback.textContent = "";
  orderFeedback.classList.remove("admin-feedback--error");
  try {
    const result = await api(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: requestedStatus }),
    });
    if (currentOrder?.id === orderId) currentOrder.status = result.status;
    const listOrder = orders.find((order) => order.id === orderId);
    if (listOrder) listOrder.status = result.status;
    renderOrderList();
    orderFeedback.textContent = "Stato pubblico aggiornato.";
  } catch (error) {
    orderFeedback.textContent = error.message;
    orderFeedback.classList.add("admin-feedback--error");
  } finally {
    saveOrderStatusButton.disabled = false;
  }
});

navigationButtons.forEach((button) => {
  button.addEventListener("click", () => showSection(button.dataset.view));
});

newProductButton.addEventListener("click", newProduct);

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = productForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  productFeedback.textContent = "";
  productFeedback.classList.remove("admin-feedback--error");
  try {
    const formData = new FormData(productForm);
    formData.set("visible", String(productForm.elements.visible.checked));
    formData.set("removeModel", String(productForm.elements.removeModel.checked));
    const saved = await api(selectedProductId ? `/api/admin/products/${selectedProductId}` : "/api/admin/products", {
      method: selectedProductId ? "PUT" : "POST",
      body: formData,
    });
    await loadCatalog(saved.id);
    productFeedback.textContent = "Prodotto salvato.";
  } catch (error) {
    productFeedback.textContent = error.message;
    productFeedback.classList.add("admin-feedback--error");
  } finally {
    submitButton.disabled = false;
  }
});

deleteProductButton.addEventListener("click", async () => {
  const product = products.find(({ id }) => id === selectedProductId);
  if (!product || !confirm(`Eliminare definitivamente ${product.name}?`)) return;
  deleteProductButton.disabled = true;
  try {
    await api(`/api/admin/products/${product.id}`, { method: "DELETE" });
    await loadCatalog();
  } catch (error) {
    productFeedback.textContent = error.message;
    productFeedback.classList.add("admin-feedback--error");
  } finally {
    deleteProductButton.disabled = false;
  }
});

newColorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(newColorForm);
  try {
    await api("/api/admin/colors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        hexValue: formData.get("hexValue"),
        active: true,
        sortOrder: Math.max(0, ...colors.map((color) => color.sortOrder)) + 10,
      }),
    });
    newColorForm.reset();
    await loadCatalog(selectedProductId, true);
    colorFeedback.textContent = "Colore aggiunto.";
    colorFeedback.classList.remove("admin-feedback--error");
  } catch (error) {
    colorFeedback.textContent = error.message;
    colorFeedback.classList.add("admin-feedback--error");
  }
});

deleteOrderButton.addEventListener("click", async () => {
  if (!confirm(`Eliminare definitivamente ${currentOrder.code}?`)) return;
  deleteOrderButton.disabled = true;
  try {
    await api(`/api/admin/orders/${currentOrder.id}`, { method: "DELETE" });
    currentOrder = undefined;
    await loadOrders();
  } catch (error) {
    orderFeedback.textContent = error.message;
    orderFeedback.classList.add("admin-feedback--error");
  } finally {
    deleteOrderButton.disabled = false;
  }
});

api("/api/admin/session")
  .then(showDashboard)
  .catch(() => showLogin());
