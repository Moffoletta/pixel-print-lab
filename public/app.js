const productList = document.querySelector("#product-list");
const productTemplate = document.querySelector("#product-template");
const catalogStatus = document.querySelector("#catalog-status");
const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

function setText(card, field, value) {
  card.querySelector(`[data-field="${field}"]`).textContent = value;
}

function createProductCard(product, index) {
  const card = productTemplate.content.firstElementChild.cloneNode(true);
  const image = card.querySelector('[data-field="image"]');
  const price = card.querySelector('[data-field="price"]');

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

  return card;
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) {
      throw new Error(`Richiesta catalogo fallita: ${response.status}`);
    }

    const { data: products } = await response.json();
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

loadProducts();
