const loginView = document.querySelector("#login-view");
const loginForm = document.querySelector("#login-form");
const loginFeedback = document.querySelector("#login-feedback");
const dashboardView = document.querySelector("#dashboard-view");
const logoutButton = document.querySelector("#logout-button");
const orderCount = document.querySelector("#order-count");
const orderListStatus = document.querySelector("#order-list-status");
const orderList = document.querySelector("#order-list");
const orderListTemplate = document.querySelector("#order-list-template");
const orderEmpty = document.querySelector("#order-empty");
const orderForm = document.querySelector("#order-form");
const orderDate = document.querySelector("#order-date");
const orderCode = document.querySelector("#order-code");
const orderTotal = document.querySelector("#order-total");
const firstNameInput = document.querySelector("#order-first-name");
const lastNameInput = document.querySelector("#order-last-name");
const adminItems = document.querySelector("#admin-items");
const adminItemTemplate = document.querySelector("#admin-item-template");
const addCatalogItemButton = document.querySelector("#add-catalog-item");
const orderFeedback = document.querySelector("#order-feedback");
const deleteOrderButton = document.querySelector("#delete-order");
const saveOrderButton = document.querySelector("#save-order");
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

function addOptions(select, values, selectedId, getLabel) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value.id;
    option.textContent = getLabel(value);
    option.selected = value.id === selectedId;
    select.append(option);
  });
}

function createItemEditor(item) {
  const element = adminItemTemplate.content.firstElementChild.cloneNode(true);
  const productField = element.querySelector('[data-field="product-field"]');
  const productSelect = element.querySelector('[data-field="product"]');
  const colorSelect = element.querySelector('[data-field="color"]');
  const quantityInput = element.querySelector('[data-field="quantity"]');
  const removeButton = element.querySelector('[data-field="remove-item"]');
  const modelLink = element.querySelector('[data-field="model-link"]');
  const externalLink = element.querySelector('[data-field="external-link"]');

  element.dataset.itemId = item.id ?? "";
  element.dataset.itemType = item.itemType;
  element.querySelector('[data-field="item-type"]').textContent = item.itemType.replace("_", " ");
  element.querySelector('[data-field="item-name"]').textContent = item.productName ?? "Nuovo prodotto";
  const availableColors = colors.filter((color) => color.active);
  if (item.id) {
    addOptions(colorSelect, [{ id: item.colorId, name: `${item.colorName} (ordine)` }], item.colorId, (color) => color.name);
  }
  addOptions(colorSelect, availableColors.filter((color) => color.id !== item.colorId), item.colorId ?? availableColors[0]?.id, (color) => color.name);
  quantityInput.value = item.quantity ?? 1;

  if (item.itemType === "catalog") {
    const availableProducts = products.filter((product) => product.visible);
    if (item.id) {
      addOptions(productSelect, [{ id: item.productId, name: `${item.productName} (ordine)` }], item.productId, (product) => product.name);
    }
    addOptions(productSelect, availableProducts.filter((product) => product.id !== item.productId), item.productId ?? availableProducts[0]?.id, (product) => product.name);
    productSelect.addEventListener("change", () => {
      const product = products.find(({ id }) => id === Number(productSelect.value));
      element.querySelector('[data-field="item-name"]').textContent = product?.name ?? item.productName;
    });
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

  removeButton.addEventListener("click", () => {
    if (adminItems.children.length === 1) {
      orderFeedback.textContent = "Una richiesta deve contenere almeno un elemento.";
      orderFeedback.classList.add("admin-feedback--error");
      return;
    }
    element.remove();
  });
  return element;
}

async function loadOrder(id) {
  currentOrder = await api(`/api/admin/orders/${id}`);
  orderEmpty.hidden = true;
  orderForm.hidden = false;
  orderDate.textContent = formatDate(currentOrder.createdAt);
  orderCode.textContent = currentOrder.code;
  orderTotal.textContent = euroFormatter.format(currentOrder.catalogTotalCents / 100);
  firstNameInput.value = currentOrder.firstName;
  lastNameInput.value = currentOrder.lastName;
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

function serializeEditorItem(element) {
  const itemType = element.dataset.itemType;
  const item = {
    itemType,
    colorId: Number(element.querySelector('[data-field="color"]').value),
    quantity: Number(element.querySelector('[data-field="quantity"]').value),
  };
  if (element.dataset.itemId) item.id = Number(element.dataset.itemId);
  if (itemType === "catalog") {
    item.productId = Number(element.querySelector('[data-field="product"]').value);
  }
  return item;
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
  await api("/api/admin/logout", { method: "POST" });
  showLogin();
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

addCatalogItemButton.addEventListener("click", () => {
  const availableProducts = products.filter((product) => product.visible);
  const availableColors = colors.filter((color) => color.active);
  if (!availableProducts.length || !availableColors.length) {
    orderFeedback.textContent = "Servono almeno un prodotto visibile e un colore attivo.";
    orderFeedback.classList.add("admin-feedback--error");
    return;
  }
  adminItems.append(
    createItemEditor({
      itemType: "catalog",
      productId: availableProducts[0].id,
      productName: availableProducts[0].name,
      colorId: availableColors[0].id,
      quantity: 1,
    }),
  );
});

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveOrderButton.disabled = true;
  orderFeedback.textContent = "";
  orderFeedback.classList.remove("admin-feedback--error");
  try {
    await api(`/api/admin/orders/${currentOrder.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: firstNameInput.value,
        lastName: lastNameInput.value,
        items: [...adminItems.children].map(serializeEditorItem),
      }),
    });
    await loadOrders();
    orderFeedback.textContent = "Modifiche salvate.";
  } catch (error) {
    orderFeedback.textContent = error.message;
    orderFeedback.classList.add("admin-feedback--error");
  } finally {
    saveOrderButton.disabled = false;
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
