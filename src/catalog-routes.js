function serializeProduct(product) {
  return {
    id: product.id,
    code: product.code,
    slug: product.slug,
    name: product.name,
    category: product.category,
    description: product.description,
    priceCents: product.price_cents,
    imageUrl: product.image_url,
    imageAlt: product.image_alt,
    dimension: {
      label: product.dimension_label,
      value: product.dimension_value,
    },
    material: product.material,
    modelUrl: product.model_url,
  };
}

export function registerCatalogRoutes(app, database) {
  const listProducts = database.prepare(`
    SELECT * FROM products
    WHERE visible = 1
    ORDER BY sort_order, id
  `);
  const findVisibleProduct = database.prepare(`
    SELECT * FROM products
    WHERE id = ? AND visible = 1
  `);
  const listColors = database.prepare(`
    SELECT id, name, hex_value
    FROM colors
    WHERE active = 1
    ORDER BY sort_order, id
  `);

  app.get("/api/products", (_request, response) => {
    const products = listProducts.all().map(serializeProduct);
    response.json({ data: products, count: products.length });
  });

  app.get("/api/products/:id", (request, response) => {
    if (!/^\d+$/.test(request.params.id)) {
      return response.status(400).json({
        error: { code: "INVALID_PRODUCT_ID", message: "L'identificativo prodotto deve essere numerico." },
      });
    }

    const product = findVisibleProduct.get(Number.parseInt(request.params.id, 10));
    if (!product) {
      return response.status(404).json({
        error: { code: "PRODUCT_NOT_FOUND", message: "Prodotto non trovato." },
      });
    }

    return response.json({ data: serializeProduct(product) });
  });

  app.get("/api/colors", (_request, response) => {
    const colors = listColors.all().map((color) => ({
      id: color.id,
      name: color.name,
      hexValue: color.hex_value,
    }));
    response.json({ data: colors, count: colors.length });
  });
}
