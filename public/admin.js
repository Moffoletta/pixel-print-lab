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
const euroFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });

let orders = [];
let products = [];
let colors = [];
let currentOrder;

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
  const [productResult, colorResult] = await Promise.all([
    fetch("/api/products").then((response) => response.json()),
    fetch("/api/colors").then((response) => response.json()),
  ]);
  products = productResult.data;
  colors = colorResult.data;
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
  addOptions(colorSelect, colors, item.colorId ?? colors[0]?.id, (color) => color.name);
  quantityInput.value = item.quantity ?? 1;

  if (item.itemType === "catalog") {
    addOptions(productSelect, products, item.productId ?? products[0]?.id, (product) => product.name);
    productSelect.addEventListener("change", () => {
      const product = products.find(({ id }) => id === Number(productSelect.value));
      element.querySelector('[data-field="item-name"]').textContent = product.name;
    });
  } else {
    productField.hidden = true;
    if (item.itemType === "custom_file") {
      modelLink.hidden = false;
      modelLink.href = `/api/admin/orders/${currentOrder.id}/items/${item.id}/model`;
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
    await api("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: new FormData(loginForm).get("password") }),
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

addCatalogItemButton.addEventListener("click", () => {
  adminItems.append(
    createItemEditor({
      itemType: "catalog",
      productId: products[0]?.id,
      productName: products[0]?.name,
      colorId: colors[0]?.id,
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
