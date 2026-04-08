import {
  product, productVariant, barcode, category,
  uomConversion, productLocationPrice, productImage
} from "@server/lib/db/schema/tenantSchema";
import {
  productSchema, productValidator, skuValidator,
  variantSchema, barcodeSchema
} from "@modules/product-catalog/server/schemas/productSchema";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { ZodError } from "zod";

const productRoutes = Router();
productRoutes.use(resolveTenantContext());
productRoutes.use(authenticated());
productRoutes.use(checkModuleAuthorization('product-catalog'));

// ============================================================
// PRODUCTS
// ============================================================

/**
 * @swagger
 * /api/modules/product-catalog/product:
 *   get:
 *     tags:
 *       - Product Catalog
 *     summary: Get all products
 *     description: Retrieve a list of products with pagination, sorting, and filtering
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: The page number to retrieve
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           default: 10
 *         description: The number of products to retrieve per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: name
 *         description: The field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           default: asc
 *           enum: [asc, desc]
 *         description: The sort order (asc or desc)
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: A filter to apply to product name or SKU code
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, discontinued, archived]
 *         description: Filter by product status
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 count:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         skuCode:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         categoryId:
 *           type: string
 *         brand:
 *           type: string
 *         uom:
 *           type: string
 *         baseCostPrice:
 *           type: number
 *         sellingPrice:
 *           type: number
 *         taxApplicable:
 *           type: boolean
 *         status:
 *           type: string
 *           enum: [draft, active, discontinued, archived]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
productRoutes.get("/", authorized("ADMIN", "retail.product.view"), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const sortParam = req.query.sort || 'name';
  const orderParam = req.query.order || 'asc';
  const filterParam = req.query.filter || '';
  const statusParam = req.query.status as string | undefined;
  const categoryIdParam = req.query.categoryId as string | undefined;

  const sortColumns = {
    id: product.id,
    skuCode: product.skuCode,
    name: product.name,
    brand: product.brand,
    status: product.status,
    sellingPrice: product.sellingPrice,
    createdAt: product.createdAt,
  } as const;

  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || product.name;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  const conditions = [];

  if (filterParam) {
    conditions.push(
      or(
        ilike(product.name, `%${filterParam}%`),
        ilike(product.skuCode, `%${filterParam}%`),
      )
    );
  }

  if (statusParam) {
    conditions.push(eq(product.status, statusParam as any));
  }

  if (categoryIdParam) {
    conditions.push(eq(product.categoryId, categoryIdParam));
  }

  const filterCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ value: total }] = await req.tenantDb
    .select({ value: count() })
    .from(product)
    .where(filterCondition);

  const products = await req.tenantDb
    .select()
    .from(product)
    .where(filterCondition)
    .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset);

  res.json({
    products,
    count: total,
    page,
    perPage,
    sort: sortParam,
    order: orderParam,
    filter: filterParam
  });
});


/**
 * @swagger
 * /api/modules/product-catalog/product/validate-sku:
 *   post:
 *     tags:
 *       - Product Catalog
 *     summary: Validate SKU code uniqueness
 *     description: Check if a SKU code is unique within the tenant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               skuCode:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SKU code is valid
 *       400:
 *         description: SKU code must be unique
 */
productRoutes.post("/validate-sku", authorized("ADMIN", "retail.product.view"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = skuValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  res.status(200).json({ message: "SKU code is valid." });
});


/**
 * @swagger
 * /api/modules/product-catalog/product/barcode-lookup/{code}:
 *   get:
 *     tags:
 *       - Product Catalog - Barcodes
 *     summary: Fast barcode lookup (for POS)
 *     description: Look up a product and variant by barcode value
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: The barcode value to look up
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product and variant info for the barcode
 *       404:
 *         description: Barcode not found
 */
productRoutes.get("/barcode-lookup/:code", authorized("ADMIN", "retail.product.view"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const code = req.params.code;

  try {
    const result = await req.tenantDb
      .select()
      .from(barcode)
      .leftJoin(product, eq(barcode.productId, product.id))
      .leftJoin(productVariant, eq(barcode.variantId, productVariant.id))
      .where(eq(barcode.barcodeValue, code))
      .limit(1)
      .then((rows) => rows[0]);

    if (!result) {
      return res.status(404).json({ error: "Barcode not found" });
    }

    res.json({
      barcode: result.barcodes,
      product: result.products,
      variant: result.product_variants,
    });
  } catch (error) {
    console.error("Error looking up barcode:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/product/add:
 *   post:
 *     tags:
 *       - Product Catalog
 *     summary: Create a new product
 *     description: Add a new product to the catalog
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 */
productRoutes.post("/add", authorized("ADMIN", "retail.product.create"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = productValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  const { skuCode, name, description, categoryId, brand, uom, baseCostPrice, sellingPrice, taxApplicable, status } = req.body;

  try {
    const newProduct = await req.tenantDb.insert(product).values({
      id: crypto.randomUUID(),
      skuCode,
      name,
      description: description || null,
      categoryId: categoryId || null,
      brand: brand || null,
      uom: uom || 'pcs',
      baseCostPrice: String(baseCostPrice),
      sellingPrice: String(sellingPrice),
      taxApplicable: taxApplicable ?? true,
      status: status || 'draft',
    })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/product/{id}:
 *   get:
 *     tags:
 *       - Product Catalog
 *     summary: Get a product by ID
 *     description: Retrieve a product with its category, variants, barcodes, images, and UoM conversions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product details with related data
 *       404:
 *         description: Product not found
 */
productRoutes.get("/:id", authorized("ADMIN", "retail.product.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const data = await req.tenantDb.query.product.findFirst({
      where: eq(product.id, idParam),
      with: {
        category: true,
        variants: true,
        barcodes: true,
        images: true,
        uomConversions: true,
        locationPrices: true,
      },
    });

    if (!data) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/product/{id}:
 *   put:
 *     tags:
 *       - Product Catalog
 *     summary: Update a product
 *     description: Update an existing product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 */
productRoutes.put("/:id", authorized("ADMIN", "retail.product.edit"), async (req, res) => {
  const idParam = req.params.id;
  const { id, skuCode, name, description, categoryId, brand, uom, baseCostPrice, sellingPrice, taxApplicable, status } = req.body;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  if (idParam !== id) {
    return res.status(400).json({ error: "Invalid product ID" });
  }

  const validator = productValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {
    const updatedProduct = await req.tenantDb.update(product).set({
      skuCode,
      name,
      description: description || null,
      categoryId: categoryId || null,
      brand: brand || null,
      uom: uom || 'pcs',
      baseCostPrice: String(baseCostPrice),
      sellingPrice: String(sellingPrice),
      taxApplicable: taxApplicable ?? true,
      status,
    }).where(
      eq(product.id, id)
    )
      .returning()
      .then((rows) => rows[0]);

    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/product/{id}:
 *   delete:
 *     tags:
 *       - Product Catalog
 *     summary: Archive a product
 *     description: Set a product's status to archived (soft delete)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product archived successfully
 *       404:
 *         description: Product not found
 */
productRoutes.delete("/:id", authorized("ADMIN", "retail.product.delete"), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const idParam = req.params.id;

  try {
    const archivedProduct = await req.tenantDb.update(product).set({
      status: 'archived',
    }).where(
      eq(product.id, idParam)
    )
      .returning()
      .then((rows) => rows[0]);

    if (!archivedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({ message: "Product archived successfully" });
  } catch (error) {
    console.error("Error archiving product:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


// ============================================================
// VARIANTS
// ============================================================

/**
 * @swagger
 * /api/modules/product-catalog/product/{id}/variants:
 *   post:
 *     tags:
 *       - Product Catalog - Variants
 *     summary: Add a variant to a product
 *     description: Create a new variant for the specified product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               variantSku:
 *                 type: string
 *               attributes:
 *                 type: object
 *               costPrice:
 *                 type: number
 *               sellingPrice:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Variant created successfully
 *       400:
 *         description: Validation error
 */
productRoutes.post("/:id/variants", authorized("ADMIN", "retail.product.create"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const productId = req.params.id;
  const body = { ...req.body, productId };

  const parsed = variantSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data', details: parsed.error.issues });
  }

  try {
    const newVariant = await req.tenantDb.insert(productVariant).values({
      id: crypto.randomUUID(),
      productId,
      variantSku: parsed.data.variantSku,
      attributes: parsed.data.attributes || null,
      costPrice: String(parsed.data.costPrice),
      sellingPrice: String(parsed.data.sellingPrice),
      status: parsed.data.status || 'active',
    })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newVariant);
  } catch (error) {
    console.error("Error creating variant:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/product/variants/{variantId}:
 *   put:
 *     tags:
 *       - Product Catalog - Variants
 *     summary: Update a variant
 *     description: Update an existing product variant
 *     parameters:
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema:
 *           type: string
 *         description: The variant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               variantSku:
 *                 type: string
 *               attributes:
 *                 type: object
 *               costPrice:
 *                 type: number
 *               sellingPrice:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Variant updated successfully
 *       404:
 *         description: Variant not found
 */
productRoutes.put("/variants/:variantId", authorized("ADMIN", "retail.product.edit"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const variantId = req.params.variantId;
  const { variantSku, attributes, costPrice, sellingPrice, status } = req.body;

  try {
    const updatedVariant = await req.tenantDb.update(productVariant).set({
      variantSku,
      attributes: attributes || null,
      costPrice: String(costPrice),
      sellingPrice: String(sellingPrice),
      status,
    }).where(
      eq(productVariant.id, variantId)
    )
      .returning()
      .then((rows) => rows[0]);

    if (!updatedVariant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.status(200).json(updatedVariant);
  } catch (error) {
    console.error("Error updating variant:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/product/variants/{variantId}:
 *   delete:
 *     tags:
 *       - Product Catalog - Variants
 *     summary: Delete a variant
 *     description: Permanently delete a product variant
 *     parameters:
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema:
 *           type: string
 *         description: The variant ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Variant deleted successfully
 *       404:
 *         description: Variant not found
 */
productRoutes.delete("/variants/:variantId", authorized("ADMIN", "retail.product.delete"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const variantId = req.params.variantId;

  try {
    const deleted = await req.tenantDb.delete(productVariant)
      .where(eq(productVariant.id, variantId))
      .returning()
      .then((rows) => rows[0]);

    if (!deleted) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.status(200).json({ message: "Variant deleted successfully" });
  } catch (error) {
    console.error("Error deleting variant:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


// ============================================================
// BARCODES
// ============================================================

/**
 * @swagger
 * /api/modules/product-catalog/product/{id}/barcodes:
 *   post:
 *     tags:
 *       - Product Catalog - Barcodes
 *     summary: Add a barcode to a product
 *     description: Create a new barcode for the specified product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               barcodeValue:
 *                 type: string
 *               barcodeType:
 *                 type: string
 *                 enum: [ean13, upca, internal]
 *               variantId:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Barcode created successfully
 *       400:
 *         description: Validation error
 */
productRoutes.post("/:id/barcodes", authorized("ADMIN", "retail.product.create"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const productId = req.params.id;
  const body = { ...req.body, productId };

  const parsed = barcodeSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data', details: parsed.error.issues });
  }

  try {
    const newBarcode = await req.tenantDb.insert(barcode).values({
      id: crypto.randomUUID(),
      barcodeValue: parsed.data.barcodeValue,
      barcodeType: parsed.data.barcodeType || 'internal',
      productId,
      variantId: parsed.data.variantId || null,
    })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newBarcode);
  } catch (error) {
    console.error("Error creating barcode:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/product/barcodes/{barcodeId}:
 *   delete:
 *     tags:
 *       - Product Catalog - Barcodes
 *     summary: Delete a barcode
 *     description: Permanently delete a barcode
 *     parameters:
 *       - in: path
 *         name: barcodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: The barcode ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Barcode deleted successfully
 *       404:
 *         description: Barcode not found
 */
productRoutes.delete("/barcodes/:barcodeId", authorized("ADMIN", "retail.product.delete"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const barcodeId = req.params.barcodeId;

  try {
    const deleted = await req.tenantDb.delete(barcode)
      .where(eq(barcode.id, barcodeId))
      .returning()
      .then((rows) => rows[0]);

    if (!deleted) {
      return res.status(404).json({ error: "Barcode not found" });
    }

    res.status(200).json({ message: "Barcode deleted successfully" });
  } catch (error) {
    console.error("Error deleting barcode:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


// ============================================================
// IMAGES
// ============================================================

/**
 * @swagger
 * /api/modules/product-catalog/product/{id}/images:
 *   post:
 *     tags:
 *       - Product Catalog - Images
 *     summary: Add an image to a product
 *     description: Add a product image URL (S3 upload integration planned)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               imageUrl:
 *                 type: string
 *               isPrimary:
 *                 type: boolean
 *               sortOrder:
 *                 type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Image added successfully
 *       400:
 *         description: Image URL is required
 */
productRoutes.post("/:id/images", authorized("ADMIN", "retail.product.edit"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const productId = req.params.id;
  const { imageUrl, isPrimary, sortOrder } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: "Image URL is required" });
  }

  try {
    const newImage = await req.tenantDb.insert(productImage).values({
      id: crypto.randomUUID(),
      productId,
      imageUrl,
      isPrimary: isPrimary ?? false,
      sortOrder: sortOrder ?? 0,
    })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newImage);
  } catch (error) {
    console.error("Error adding image:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/product/images/{imageId}:
 *   delete:
 *     tags:
 *       - Product Catalog - Images
 *     summary: Delete a product image
 *     description: Permanently delete a product image
 *     parameters:
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *         description: The image ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       404:
 *         description: Image not found
 */
productRoutes.delete("/images/:imageId", authorized("ADMIN", "retail.product.delete"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const imageId = req.params.imageId;

  try {
    const deleted = await req.tenantDb.delete(productImage)
      .where(eq(productImage.id, imageId))
      .returning()
      .then((rows) => rows[0]);

    if (!deleted) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.status(200).json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


// ============================================================
// UOM CONVERSIONS
// ============================================================

/**
 * @swagger
 * /api/modules/product-catalog/product/{id}/uom:
 *   post:
 *     tags:
 *       - Product Catalog - UoM
 *     summary: Add a UoM conversion
 *     description: Add a unit of measure conversion for a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               procurementUom:
 *                 type: string
 *               salesUom:
 *                 type: string
 *               conversionFactor:
 *                 type: number
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: UoM conversion created successfully
 *       400:
 *         description: Validation error
 */
productRoutes.post("/:id/uom", authorized("ADMIN", "retail.product.edit"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const productId = req.params.id;
  const { procurementUom, salesUom, conversionFactor } = req.body;

  if (!procurementUom || !salesUom || conversionFactor === undefined) {
    return res.status(400).json({ error: "procurementUom, salesUom, and conversionFactor are required" });
  }

  try {
    const newUom = await req.tenantDb.insert(uomConversion).values({
      id: crypto.randomUUID(),
      productId,
      procurementUom,
      salesUom,
      conversionFactor: String(conversionFactor),
    })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newUom);
  } catch (error) {
    console.error("Error creating UoM conversion:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/product/uom/{uomId}:
 *   delete:
 *     tags:
 *       - Product Catalog - UoM
 *     summary: Delete a UoM conversion
 *     description: Permanently delete a UoM conversion
 *     parameters:
 *       - in: path
 *         name: uomId
 *         required: true
 *         schema:
 *           type: string
 *         description: The UoM conversion ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: UoM conversion deleted successfully
 *       404:
 *         description: UoM conversion not found
 */
productRoutes.delete("/uom/:uomId", authorized("ADMIN", "retail.product.delete"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const uomId = req.params.uomId;

  try {
    const deleted = await req.tenantDb.delete(uomConversion)
      .where(eq(uomConversion.id, uomId))
      .returning()
      .then((rows) => rows[0]);

    if (!deleted) {
      return res.status(404).json({ error: "UoM conversion not found" });
    }

    res.status(200).json({ message: "UoM conversion deleted successfully" });
  } catch (error) {
    console.error("Error deleting UoM conversion:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


// ============================================================
// LOCATION PRICES
// ============================================================

/**
 * @swagger
 * /api/modules/product-catalog/product/{id}/location-prices:
 *   post:
 *     tags:
 *       - Product Catalog - Location Prices
 *     summary: Set location-specific price
 *     description: Create or update a location-specific price for a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               locationId:
 *                 type: string
 *               costPrice:
 *                 type: number
 *               sellingPrice:
 *                 type: number
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Location price set successfully
 *       400:
 *         description: Validation error
 */
productRoutes.post("/:id/location-prices", authorized("ADMIN", "retail.product.edit"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const productId = req.params.id;
  const { locationId, costPrice, sellingPrice } = req.body;

  if (!locationId) {
    return res.status(400).json({ error: "locationId is required" });
  }

  try {
    // Check if a price already exists for this product-location combination
    const existing = await req.tenantDb
      .select()
      .from(productLocationPrice)
      .where(
        and(
          eq(productLocationPrice.productId, productId),
          eq(productLocationPrice.locationId, locationId),
        )
      )
      .limit(1)
      .then((rows) => rows[0]);

    let result;
    if (existing) {
      // Update existing
      result = await req.tenantDb.update(productLocationPrice).set({
        costPrice: costPrice !== undefined ? String(costPrice) : existing.costPrice,
        sellingPrice: sellingPrice !== undefined ? String(sellingPrice) : existing.sellingPrice,
      }).where(
        eq(productLocationPrice.id, existing.id)
      )
        .returning()
        .then((rows) => rows[0]);
    } else {
      // Insert new
      result = await req.tenantDb.insert(productLocationPrice).values({
        id: crypto.randomUUID(),
        productId,
        locationId,
        costPrice: costPrice !== undefined ? String(costPrice) : null,
        sellingPrice: sellingPrice !== undefined ? String(sellingPrice) : null,
      })
        .returning()
        .then((rows) => rows[0]);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("Error setting location price:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/product/{id}/location-prices:
 *   get:
 *     tags:
 *       - Product Catalog - Location Prices
 *     summary: Get location prices for a product
 *     description: Retrieve all location-specific prices for a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of location prices
 */
productRoutes.get("/:id/location-prices", authorized("ADMIN", "retail.product.view"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const productId = req.params.id;

  try {
    const prices = await req.tenantDb
      .select()
      .from(productLocationPrice)
      .where(eq(productLocationPrice.productId, productId))
      .orderBy(asc(productLocationPrice.locationId));

    res.json(prices);
  } catch (error) {
    console.error("Error fetching location prices:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default productRoutes;
