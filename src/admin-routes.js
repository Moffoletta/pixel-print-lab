import { unlink } from "node:fs/promises";
import path from "node:path";
import { AuthError } from "./auth-service.js";
import {
  CatalogAssetError,
  createCatalogUpload,
  getUploadedPaths,
  managedAssetPath,
  removeFiles,
  validateCatalogFiles,
} from "./catalog-assets.js";
import { modelContentType } from "./model-files.js";
import {
  defaultOrderFileDirectory,
  ORDER_STATUSES,
} from "./order-routes.js";

class AdminError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function sendError(response, error) {
  if (error instanceof AdminError || error instanceof CatalogAssetError || error instanceof AuthError) {
    return response.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  if (error?.name === "MulterError") {
    return response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: {
        code: "INVALID_CATALOG_UPLOAD",
        message: error.code === "LIMIT_FILE_SIZE" ? "Il file caricato supera il limite consentito." : "Il caricamento non e valido.",
      },
    });
  }
  if (error?.code?.startsWith("SQLITE_CONSTRAINT")) {
    return response.status(409).json({
      error: { code: "CATALOG_CONFLICT", message: "Codice, slug o nome gia utilizzato." },
    });
  }
  console.error(error);
  return response.status(500).json({
    error: { code: "ADMIN_OPERATION_FAILED", message: "Operazione amministrativa non riuscita." },
  });
}

function requiredText(value, label, maximum = 120) {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > maximum) {
    throw new AdminError("INVALID_CATALOG_FIELD", `${label} deve contenere da 1 a ${maximum} caratteri.`);
  }
  return value.trim();
}

function parseBoolean(value, label) {
  if (value === true || value === "true" || value === "1") return 1;
  if (value === false || value === "false" || value === "0") return 0;
  throw new AdminError("INVALID_CATALOG_FIELD", `${label} non e valido.`);
}

function parseNonNegativeInteger(value, label) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AdminError("INVALID_CATALOG_FIELD", `${label} deve essere un numero intero positivo.`);
  }
  return parsed;
}

function validateProduct(body) {
  const code = requiredText(body.code, "Il codice", 30).toUpperCase();
  const slug = requiredText(body.slug, "Lo slug", 80).toLowerCase();
  if (!/^[A-Z0-9_-]+$/.test(code) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new AdminError("INVALID_CATALOG_FIELD", "Codice o slug non hanno un formato valido.");
  }
  return {
    code,
    slug,
    name: requiredText(body.name, "Il nome"),
    category: requiredText(body.category, "La categoria"),
    description: requiredText(body.description, "La descrizione", 1000),
    priceCents: parseNonNegativeInteger(body.priceCents, "Il prezzo"),
    imageAlt: requiredText(body.imageAlt, "Il testo alternativo", 180),
    dimensionLabel: requiredText(body.dimensionLabel, "L'etichetta della dimensione", 60),
    dimensionValue: requiredText(body.dimensionValue, "Il valore della dimensione", 60),
    material: requiredText(body.material, "Il materiale", 80),
    visible: parseBoolean(body.visible, "La visibilita"),
    sortOrder: parseNonNegativeInteger(body.sortOrder, "L'ordine"),
    removeModel: body.removeModel === true || body.removeModel === "true" || body.removeModel === "1",
  };
}

function serializeAdminProduct(product) {
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
    dimensionLabel: product.dimension_label,
    dimensionValue: product.dimension_value,
    material: product.material,
    modelUrl: product.model_url,
    visible: Boolean(product.visible),
    sortOrder: product.sort_order,
  };
}

function serializeAdminColor(color) {
  return {
    id: color.id,
    name: color.name,
    hexValue: color.hex_value,
    active: Boolean(color.active),
    sortOrder: color.sort_order,
  };
}

function validateColor(body) {
  const name = requiredText(body?.name, "Il nome del colore", 60);
  const hexValue = typeof body?.hexValue === "string" ? body.hexValue.trim().toUpperCase() : "";
  if (!/^#[0-9A-F]{6}$/.test(hexValue)) {
    throw new AdminError("INVALID_CATALOG_FIELD", "Il colore deve usare il formato esadecimale #RRGGBB.");
  }
  return {
    name,
    hexValue,
    active: parseBoolean(body?.active, "Lo stato del colore"),
    sortOrder: parseNonNegativeInteger(body?.sortOrder, "L'ordine del colore"),
  };
}

function parseModelMetadata(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function serializeItem(item) {
  const modelMetadata = parseModelMetadata(item.model_metadata_json);
  return {
    id: item.id,
    position: item.position,
    itemType: item.item_type,
    productId: item.product_id,
    productCode: item.product_code,
    productName: item.product_name,
    unitPriceCents: item.unit_price_cents,
    colorId: item.color_id,
    colorName: item.color_name,
    colorHex: item.color_hex,
    quantity: item.quantity,
    originalName: item.original_name,
    sourceName: item.source_name,
    externalUrl: item.external_url,
    hasModel: Boolean(item.model_filename),
    modelFormat: item.model_format ?? (item.model_filename?.toLowerCase().endsWith(".3mf") ? "3mf" : item.model_filename ? "stl" : null),
    modelMetadata,
  };
}

export function registerAdminRoutes(
  app,
  {
    database,
    requireAdmin,
    catalogDirectory,
    orderFileDirectory = defaultOrderFileDirectory,
    emailService,
    authService,
  },
) {
  const catalogUpload = createCatalogUpload(catalogDirectory);
  const findOrder = database.prepare("SELECT * FROM orders WHERE id = ?");
  const listItems = database.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY position");
  const findItem = database.prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?");
  const findAnyProduct = database.prepare("SELECT * FROM products WHERE id = ?");
  const findAnyColor = database.prepare("SELECT * FROM colors WHERE id = ?");
  const listAdminProducts = database.prepare("SELECT * FROM products ORDER BY sort_order, id");
  const listAdminColors = database.prepare("SELECT * FROM colors ORDER BY sort_order, id");
  const insertProduct = database.prepare(`
    INSERT INTO products (
      code, slug, name, category, description, price_cents, image_url, image_alt,
      dimension_label, dimension_value, material, model_url, visible, sort_order
    ) VALUES (
      @code, @slug, @name, @category, @description, @priceCents, @imageUrl, @imageAlt,
      @dimensionLabel, @dimensionValue, @material, @modelUrl, @visible, @sortOrder
    )
  `);
  const updateProduct = database.prepare(`
    UPDATE products SET
      code = @code, slug = @slug, name = @name, category = @category,
      description = @description, price_cents = @priceCents, image_url = @imageUrl,
      image_alt = @imageAlt, dimension_label = @dimensionLabel,
      dimension_value = @dimensionValue, material = @material, model_url = @modelUrl,
      visible = @visible, sort_order = @sortOrder, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);
  const insertColor = database.prepare(`
    INSERT INTO colors (name, hex_value, active, sort_order)
    VALUES (@name, @hexValue, @active, @sortOrder)
  `);
  const updateColor = database.prepare(`
    UPDATE colors SET name = @name, hex_value = @hexValue, active = @active,
      sort_order = @sortOrder, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);
  const reorderColors = database.transaction((ids) => {
    const updatePosition = database.prepare("UPDATE colors SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    ids.forEach((id, index) => updatePosition.run((index + 1) * 10, id));
  });
  const updateOrderStatus = database.prepare(`
    UPDATE orders SET status = ? WHERE id = ?
  `);
  const getSettings = database.prepare("SELECT email_notifications_enabled FROM app_settings WHERE id = 1");
  const updateEmailNotifications = database.prepare(`
    UPDATE app_settings
    SET email_notifications_enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);

  function serializeSettings() {
    const adminAccess = authService.adminAccess();
    return {
      emailNotificationsEnabled: Boolean(getSettings.get().email_notifications_enabled),
      smtpConfigured: Boolean(emailService?.configured),
      smtpRecipient: emailService?.recipient ?? null,
      adminUsername: adminAccess.username,
      adminCredentialsCustomized: adminAccess.customized,
    };
  }

  function handleProductUpload(request, response, existingProduct) {
    catalogUpload(request, response, async (uploadError) => {
      const uploadedPaths = getUploadedPaths(request.files);
      if (uploadError) {
        await removeFiles(uploadedPaths);
        return sendError(response, uploadError);
      }
      try {
        const product = validateProduct(request.body);
        const assets = await validateCatalogFiles(request.files);
        if (!existingProduct && !assets.imageUrl) {
          throw new AdminError("CATALOG_IMAGE_REQUIRED", "Seleziona un'immagine per il prodotto.");
        }
        const values = {
          ...product,
          imageUrl: assets.imageUrl ?? existingProduct?.image_url,
          modelUrl: assets.modelUrl ?? (product.removeModel ? null : existingProduct?.model_url ?? null),
        };

        let id;
        if (existingProduct) {
          id = existingProduct.id;
          updateProduct.run({ ...values, id });
        } else {
          id = Number(insertProduct.run(values).lastInsertRowid);
        }

        const obsoleteFiles = [];
        if (existingProduct && assets.imageUrl) {
          obsoleteFiles.push(managedAssetPath(existingProduct.image_url, catalogDirectory));
        }
        if (existingProduct && (assets.modelUrl || product.removeModel)) {
          obsoleteFiles.push(managedAssetPath(existingProduct.model_url, catalogDirectory));
        }
        await removeFiles(obsoleteFiles);
        return response.status(existingProduct ? 200 : 201).json({
          data: serializeAdminProduct(findAnyProduct.get(id)),
        });
      } catch (error) {
        await removeFiles(uploadedPaths);
        return sendError(response, error);
      }
    });
  }

  app.get("/api/admin/settings", requireAdmin, (_request, response) => {
    response.json({ data: serializeSettings() });
  });

  app.put("/api/admin/settings", requireAdmin, (request, response) => {
    try {
      if (typeof request.body?.emailNotificationsEnabled !== "boolean") {
        throw new AdminError("INVALID_SETTINGS", "L'impostazione email non e valida.");
      }
      if (request.body.emailNotificationsEnabled && !emailService?.configured) {
        throw new AdminError("SMTP_NOT_CONFIGURED", "Configura SMTP prima di attivare le email.", 409);
      }
      updateEmailNotifications.run(request.body.emailNotificationsEnabled ? 1 : 0);
      return response.json({ data: serializeSettings() });
    } catch (error) {
      return sendError(response, error);
    }
  });

  app.put("/api/admin/credentials", requireAdmin, async (request, response) => {
    try {
      const result = await authService.changeAdminCredentials({
        currentPassword: request.body?.currentPassword,
        username: request.body?.username,
        password: request.body?.password,
      });
      return response.json({ data: result });
    } catch (error) {
      return sendError(response, error);
    }
  });

  app.get("/api/admin/catalog", requireAdmin, (_request, response) => {
    response.json({
      data: {
        products: listAdminProducts.all().map(serializeAdminProduct),
        colors: listAdminColors.all().map(serializeAdminColor),
      },
    });
  });

  app.post("/api/admin/products", requireAdmin, (request, response) => {
    handleProductUpload(request, response, null);
  });

  app.put("/api/admin/products/:id", requireAdmin, (request, response) => {
    const id = Number.parseInt(request.params.id, 10);
    const product = Number.isInteger(id) ? findAnyProduct.get(id) : undefined;
    if (!product) return sendError(response, new AdminError("PRODUCT_NOT_FOUND", "Prodotto non trovato.", 404));
    handleProductUpload(request, response, product);
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (request, response) => {
    try {
      const id = Number.parseInt(request.params.id, 10);
      const product = Number.isInteger(id) ? findAnyProduct.get(id) : undefined;
      if (!product) throw new AdminError("PRODUCT_NOT_FOUND", "Prodotto non trovato.", 404);
      database.prepare("DELETE FROM products WHERE id = ?").run(id);
      await removeFiles([
        managedAssetPath(product.image_url, catalogDirectory),
        managedAssetPath(product.model_url, catalogDirectory),
      ]);
      return response.status(204).end();
    } catch (error) {
      return sendError(response, error);
    }
  });

  app.post("/api/admin/colors", requireAdmin, (request, response) => {
    try {
      const color = validateColor(request.body);
      const id = Number(insertColor.run(color).lastInsertRowid);
      return response.status(201).json({ data: serializeAdminColor(findAnyColor.get(id)) });
    } catch (error) {
      return sendError(response, error);
    }
  });

  app.put("/api/admin/colors/order", requireAdmin, (request, response) => {
    try {
      const ids = request.body?.ids;
      const existingIds = listAdminColors.all().map(({ id }) => id);
      if (
        !Array.isArray(ids) || ids.length !== existingIds.length ||
        new Set(ids).size !== ids.length || ids.some((id) => !existingIds.includes(id))
      ) {
        throw new AdminError("INVALID_COLOR_ORDER", "L'ordinamento dei colori non e valido.");
      }
      reorderColors(ids);
      return response.json({ data: listAdminColors.all().map(serializeAdminColor) });
    } catch (error) {
      return sendError(response, error);
    }
  });

  app.put("/api/admin/colors/:id", requireAdmin, (request, response) => {
    try {
      const id = Number.parseInt(request.params.id, 10);
      if (!Number.isInteger(id) || !findAnyColor.get(id)) {
        throw new AdminError("COLOR_NOT_FOUND", "Colore non trovato.", 404);
      }
      updateColor.run({ ...validateColor(request.body), id });
      return response.json({ data: serializeAdminColor(findAnyColor.get(id)) });
    } catch (error) {
      return sendError(response, error);
    }
  });

  app.get("/api/admin/orders", requireAdmin, (_request, response) => {
    const orders = database
      .prepare(`
        SELECT
          orders.*,
          COUNT(order_items.id) AS item_count,
          COALESCE(SUM(order_items.quantity), 0) AS piece_count
        FROM orders
        LEFT JOIN order_items ON order_items.order_id = orders.id
        WHERE orders.status != 'consegnato'
        GROUP BY orders.id
        ORDER BY orders.created_at DESC, orders.id DESC
      `)
      .all()
      .map((order) => ({
        id: order.id,
        code: order.code,
        firstName: order.first_name,
        lastName: order.last_name,
        catalogTotalCents: order.catalog_total_cents,
        itemCount: order.item_count,
        pieceCount: order.piece_count,
        status: order.status,
        createdAt: order.created_at,
      }));
    response.json({ data: orders, count: orders.length });
  });

  app.get("/api/admin/orders/archive", requireAdmin, (_request, response) => {
    const orders = database
      .prepare(`
        SELECT
          orders.*,
          COUNT(order_items.id) AS item_count,
          COALESCE(SUM(order_items.quantity), 0) AS piece_count
        FROM orders
        LEFT JOIN order_items ON order_items.order_id = orders.id
        WHERE orders.status = 'consegnato'
        GROUP BY orders.id
        ORDER BY orders.created_at DESC, orders.id DESC
      `)
      .all()
      .map((order) => ({
        id: order.id,
        code: order.code,
        firstName: order.first_name,
        lastName: order.last_name,
        catalogTotalCents: order.catalog_total_cents,
        itemCount: order.item_count,
        pieceCount: order.piece_count,
        status: order.status,
        createdAt: order.created_at,
      }));
    response.json({ data: orders, count: orders.length });
  });

  app.get("/api/admin/orders/:id", requireAdmin, (request, response) => {
    const id = Number.parseInt(request.params.id, 10);
    const order = Number.isInteger(id) ? findOrder.get(id) : undefined;
    if (!order) return sendError(response, new AdminError("ORDER_NOT_FOUND", "Richiesta non trovata.", 404));
    response.json({
      data: {
        id: order.id,
        code: order.code,
        firstName: order.first_name,
        lastName: order.last_name,
        catalogTotalCents: order.catalog_total_cents,
        status: order.status,
        createdAt: order.created_at,
        items: listItems.all(order.id).map(serializeItem),
      },
    });
  });

  app.patch("/api/admin/orders/:id/status", requireAdmin, (request, response) => {
    try {
      if (!/^\d+$/.test(request.params.id)) throw new AdminError("ORDER_NOT_FOUND", "Richiesta non trovata.", 404);
      const id = Number(request.params.id);
      if (!ORDER_STATUSES.has(request.body?.status)) {
        throw new AdminError("INVALID_ORDER_STATUS", "Lo stato della richiesta non e valido.");
      }
      if (updateOrderStatus.run(request.body.status, id).changes === 0) {
        throw new AdminError("ORDER_NOT_FOUND", "Richiesta non trovata.", 404);
      }
      return response.json({ data: { id, status: request.body.status } });
    } catch (error) {
      return sendError(response, error);
    }
  });

  app.get("/api/admin/orders/:orderId/items/:itemId/model", requireAdmin, (request, response) => {
    const orderId = Number.parseInt(request.params.orderId, 10);
    const itemId = Number.parseInt(request.params.itemId, 10);
    const item = findItem.get(itemId, orderId);
    if (!item?.model_filename) {
      return sendError(response, new AdminError("MODEL_NOT_FOUND", "File modello non trovato.", 404));
    }
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Type", modelContentType(item.model_format ?? (item.model_filename.toLowerCase().endsWith(".3mf") ? "3mf" : "stl")));
    response.setHeader("X-Content-Type-Options", "nosniff");
    return response.download(path.join(orderFileDirectory, item.model_filename), item.original_name ?? item.model_filename);
  });

  app.delete("/api/admin/orders/:id", requireAdmin, async (request, response) => {
    try {
      const id = Number.parseInt(request.params.id, 10);
      const order = Number.isInteger(id) ? findOrder.get(id) : undefined;
      if (!order) throw new AdminError("ORDER_NOT_FOUND", "Richiesta non trovata.", 404);
      const modelFilenames = new Set(
        listItems.all(id).map((item) => item.model_filename).filter(Boolean),
      );
      database.prepare("DELETE FROM orders WHERE id = ?").run(id);
      await Promise.all([...modelFilenames].map((filename) =>
        unlink(path.join(orderFileDirectory, filename)).catch(console.error),
      ));
      response.status(204).end();
    } catch (error) {
      return sendError(response, error);
    }
  });
}
