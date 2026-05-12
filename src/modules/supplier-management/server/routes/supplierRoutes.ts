import { supplier, supplierContact, supplierProduct, product } from "@server/lib/db/schema/tenantSchema";
import { supplierSchema, supplierContactSchema, supplierProductSchema, supplierCodeValidator, supplierValidator } from "@modules/supplier-management/server/schemas/supplierSchema";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { ZodError } from "zod";

const supplierRoutes = Router();
supplierRoutes.use(resolveTenantContext());
supplierRoutes.use(authenticated());
supplierRoutes.use(checkModuleAuthorization('supplier-management'));

// ============================================================
// SUPPLIER CRUD
// ============================================================

/**
 * @swagger
 * components:
 *   schemas:
 *     Supplier:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         code:
 *           type: string
 *         name:
 *           type: string
 *         npwp:
 *           type: string
 *         address:
 *           type: string
 *         paymentTerms:
 *           type: string
 *         leadTimeDays:
 *           type: integer
 *         bankDetails:
 *           type: object
 *           properties:
 *             bankName:
 *               type: string
 *             accountNumber:
 *               type: string
 *             accountHolder:
 *               type: string
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     SupplierContact:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         supplierId:
 *           type: string
 *         name:
 *           type: string
 *         role:
 *           type: string
 *           enum: [sales, ar, logistics, general]
 *         phone:
 *           type: string
 *         email:
 *           type: string
 *         isPrimary:
 *           type: boolean
 *     SupplierProduct:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         supplierId:
 *           type: string
 *         productId:
 *           type: string
 *         supplierPrice:
 *           type: number
 *         minOrderQty:
 *           type: integer
 *         supplierSku:
 *           type: string
 *     SupplierForm:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *         name:
 *           type: string
 *         npwp:
 *           type: string
 *         address:
 *           type: string
 *         paymentTerms:
 *           type: string
 *         leadTimeDays:
 *           type: integer
 *         bankDetails:
 *           type: object
 *         status:
 *           type: string
 *           enum: [active, inactive]
 */

/**
 * @swagger
 * /api/modules/supplier-management/supplier:
 *   get:
 *     tags:
 *       - Supplier Management
 *     summary: Get all suppliers
 *     description: Retrieve a list of all suppliers with pagination, sorting, and filtering. Includes contact count.
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
 *         description: The number of suppliers to retrieve per page
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
 *         description: A filter to apply to supplier name or code
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of suppliers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suppliers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Supplier'
 *                 count:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 */
supplierRoutes.get("/", authorized("ADMIN", "retail.supplier.view"), async (req, res) => {

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

  const sortColumns = {
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    status: supplier.status,
    createdAt: supplier.createdAt,
  } as const;

  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || supplier.name;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  const filterCondition = filterParam
    ? and(
        or(
          ilike(supplier.name, `%${filterParam}%`),
          ilike(supplier.code, `%${filterParam}%`),
        )
      )
    : undefined;

  const [{ value: total }] = await req.tenantDb
    .select({ value: count() })
    .from(supplier)
    .where(filterCondition);

  const suppliers = await req.tenantDb
    .select({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      npwp: supplier.npwp,
      address: supplier.address,
      paymentTerms: supplier.paymentTerms,
      leadTimeDays: supplier.leadTimeDays,
      bankDetails: supplier.bankDetails,
      status: supplier.status,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      contactCount: sql<number>`(SELECT COUNT(*) FROM supplier_contacts WHERE supplier_id = ${supplier.id})`.as('contact_count'),
    })
    .from(supplier)
    .where(filterCondition)
    .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset);

  res.json({
    suppliers,
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
 * /api/modules/supplier-management/supplier/validate-code:
 *   post:
 *     tags:
 *       - Supplier Management
 *     summary: Validate supplier code uniqueness
 *     description: Check if the supplier code is unique within the tenant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               code:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supplier code is valid
 *       400:
 *         description: Supplier code must be unique
 */
supplierRoutes.post("/validate-code", authorized("ADMIN", "retail.supplier.view"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = supplierCodeValidator(req.tenantDb);
  try {
    await validator.parseAsync(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Unhandled error:', error);
    return res.status(500).json({ message: 'Validation error' });
  }

  return res.status(200).json({ message: "Supplier code is valid." });
});


/**
 * @swagger
 * /api/modules/supplier-management/supplier/add:
 *   post:
 *     tags:
 *       - Supplier Management
 *     summary: Add a new supplier
 *     description: Create a new supplier with the provided details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Supplier created successfully
 *       400:
 *         description: Validation error
 */
supplierRoutes.post("/add", authorized("ADMIN", "retail.supplier.create"), async (req, res) => {
  const { code, name, npwp, address, paymentTerms, leadTimeDays, bankDetails, status } = req.body;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = supplierValidator(req.tenantDb);
  try {
    await validator.parseAsync(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Unhandled error:', error);
    return res.status(500).json({ message: 'Validation error' });
  }

  try {
    const newSupplier = await req.tenantDb.insert(supplier).values({
      id: crypto.randomUUID(),
      code,
      name,
      npwp: npwp || null,
      address: address || null,
      paymentTerms: paymentTerms || null,
      leadTimeDays: leadTimeDays || null,
      bankDetails: bankDetails || null,
      status: status || 'active',
    })
      .returning()
      .then((rows) => rows[0]);

    return res.status(201).json(newSupplier);
  } catch (error) {
    console.error("Error creating supplier:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/supplier-management/supplier/{id}:
 *   get:
 *     tags:
 *       - Supplier Management
 *     summary: Get a supplier by ID
 *     description: Retrieve a specific supplier with its contacts and products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the supplier to retrieve
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The supplier details with contacts and products
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Supplier'
 *       404:
 *         description: Supplier not found
 */
supplierRoutes.get("/:id", authorized("ADMIN", "retail.supplier.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const data = await req.tenantDb.query.supplier.findFirst({
      where: eq(supplier.id, idParam),
      with: {
        contacts: true,
        products: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!data) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching supplier:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/supplier-management/supplier/{id}:
 *   put:
 *     tags:
 *       - Supplier Management
 *     summary: Update a supplier
 *     description: Update the details of an existing supplier
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the supplier to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supplier updated successfully
 *       404:
 *         description: Supplier not found
 */
supplierRoutes.put("/:id", authorized("ADMIN", "retail.supplier.edit"), async (req, res) => {
  const idParam = req.params.id;
  const { code, name, npwp, address, paymentTerms, leadTimeDays, bankDetails, status } = req.body;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = supplierValidator(req.tenantDb);
  try {
    await validator.parseAsync({ ...req.body, id: idParam });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Unhandled error:', error);
    return res.status(500).json({ message: 'Validation error' });
  }

  try {
    const updatedSupplier = await req.tenantDb.update(supplier).set({
      code,
      name,
      npwp: npwp || null,
      address: address || null,
      paymentTerms: paymentTerms || null,
      leadTimeDays: leadTimeDays || null,
      bankDetails: bankDetails || null,
      status,
    }).where(
      eq(supplier.id, idParam)
    )
      .returning()
      .then((rows) => rows[0]);

    if (!updatedSupplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    return res.status(200).json(updatedSupplier);
  } catch (error) {
    console.error("Error updating supplier:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/supplier-management/supplier/{id}:
 *   delete:
 *     tags:
 *       - Supplier Management
 *     summary: Soft-delete a supplier
 *     description: Set a supplier's status to inactive (soft delete)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the supplier to delete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supplier deleted successfully
 *       404:
 *         description: Supplier not found
 */
supplierRoutes.delete("/:id", authorized("ADMIN", "retail.supplier.delete"), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const idParam = req.params.id;

  try {
    const deletedSupplier = await req.tenantDb.update(supplier).set({
      status: 'inactive',
    }).where(
      eq(supplier.id, idParam)
    )
      .returning()
      .then((rows) => rows[0]);

    if (!deletedSupplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    res.status(200).json({ message: "Supplier deleted successfully" });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


// ============================================================
// SUPPLIER CONTACTS
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-management/supplier/{id}/contacts:
 *   get:
 *     tags:
 *       - Supplier Management - Contacts
 *     summary: List contacts for a supplier
 *     description: Retrieve all contacts for a specific supplier
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The supplier ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of supplier contacts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contacts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SupplierContact'
 */
supplierRoutes.get("/:id/contacts", authorized("ADMIN", "retail.supplier.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const contacts = await req.tenantDb
      .select()
      .from(supplierContact)
      .where(eq(supplierContact.supplierId, idParam))
      .orderBy(asc(supplierContact.name));

    res.json({ contacts });
  } catch (error) {
    console.error("Error fetching supplier contacts:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/supplier-management/supplier/{id}/contacts:
 *   post:
 *     tags:
 *       - Supplier Management - Contacts
 *     summary: Add a contact to a supplier
 *     description: Create a new contact for a specific supplier
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The supplier ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierContact'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Contact created successfully
 *       400:
 *         description: Validation error
 */
supplierRoutes.post("/:id/contacts", authorized("ADMIN", "retail.supplier.create"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = supplierContactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data', details: parsed.error.issues });
  }

  try {
    const newContact = await req.tenantDb.insert(supplierContact).values({
      id: crypto.randomUUID(),
      supplierId: idParam,
      name: parsed.data.name,
      role: parsed.data.role,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      isPrimary: parsed.data.isPrimary ?? false,
    })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newContact);
  } catch (error) {
    console.error("Error creating supplier contact:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/supplier-management/supplier/contacts/{contactId}:
 *   put:
 *     tags:
 *       - Supplier Management - Contacts
 *     summary: Update a supplier contact
 *     description: Update the details of an existing supplier contact
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: The contact ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierContact'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contact updated successfully
 *       404:
 *         description: Contact not found
 */
supplierRoutes.put("/contacts/:contactId", authorized("ADMIN", "retail.supplier.edit"), async (req, res) => {
  const contactId = req.params.contactId;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = supplierContactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data', details: parsed.error.issues });
  }

  try {
    const updatedContact = await req.tenantDb.update(supplierContact).set({
      name: parsed.data.name,
      role: parsed.data.role,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      isPrimary: parsed.data.isPrimary ?? false,
    }).where(
      eq(supplierContact.id, contactId)
    )
      .returning()
      .then((rows) => rows[0]);

    if (!updatedContact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.status(200).json(updatedContact);
  } catch (error) {
    console.error("Error updating supplier contact:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/supplier-management/supplier/contacts/{contactId}:
 *   delete:
 *     tags:
 *       - Supplier Management - Contacts
 *     summary: Delete a supplier contact
 *     description: Permanently delete a supplier contact
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: The contact ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 *       404:
 *         description: Contact not found
 */
supplierRoutes.delete("/contacts/:contactId", authorized("ADMIN", "retail.supplier.delete"), async (req, res) => {
  const contactId = req.params.contactId;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const deleted = await req.tenantDb.delete(supplierContact)
      .where(eq(supplierContact.id, contactId))
      .returning()
      .then((rows) => rows[0]);

    if (!deleted) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.status(200).json({ message: "Contact deleted successfully" });
  } catch (error) {
    console.error("Error deleting supplier contact:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


// ============================================================
// SUPPLIER PRODUCTS
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-management/supplier/{id}/products:
 *   get:
 *     tags:
 *       - Supplier Management - Products
 *     summary: List linked products for a supplier
 *     description: Retrieve all products linked to a specific supplier with pricing info. Joins product table for name/sku.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The supplier ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of supplier products with product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SupplierProduct'
 */
supplierRoutes.get("/:id/products", authorized("ADMIN", "retail.supplier.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const products = await req.tenantDb
      .select({
        id: supplierProduct.id,
        supplierId: supplierProduct.supplierId,
        productId: supplierProduct.productId,
        supplierPrice: supplierProduct.supplierPrice,
        minOrderQty: supplierProduct.minOrderQty,
        supplierSku: supplierProduct.supplierSku,
        createdAt: supplierProduct.createdAt,
        updatedAt: supplierProduct.updatedAt,
        productName: product.name,
        productSkuCode: product.skuCode,
      })
      .from(supplierProduct)
      .innerJoin(product, eq(supplierProduct.productId, product.id))
      .where(eq(supplierProduct.supplierId, idParam))
      .orderBy(asc(product.name));

    res.json({ products });
  } catch (error) {
    console.error("Error fetching supplier products:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/supplier-management/supplier/{id}/products:
 *   post:
 *     tags:
 *       - Supplier Management - Products
 *     summary: Link a product to a supplier
 *     description: Link a product with pricing and MOQ to a specific supplier
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The supplier ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierProduct'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Product linked successfully
 *       400:
 *         description: Validation error
 */
supplierRoutes.post("/:id/products", authorized("ADMIN", "retail.supplier.create"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = supplierProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data', details: parsed.error.issues });
  }

  try {
    const newSupplierProduct = await req.tenantDb.insert(supplierProduct).values({
      id: crypto.randomUUID(),
      supplierId: idParam,
      productId: parsed.data.productId,
      supplierPrice: String(parsed.data.supplierPrice),
      minOrderQty: parsed.data.minOrderQty ?? 1,
      supplierSku: parsed.data.supplierSku || null,
    })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newSupplierProduct);
  } catch (error) {
    console.error("Error linking supplier product:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/supplier-management/supplier/supplier-products/{spId}:
 *   put:
 *     tags:
 *       - Supplier Management - Products
 *     summary: Update supplier-product pricing
 *     description: Update the pricing and MOQ for a supplier-product link
 *     parameters:
 *       - in: path
 *         name: spId
 *         required: true
 *         schema:
 *           type: string
 *         description: The supplier-product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierProduct'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supplier product updated successfully
 *       404:
 *         description: Supplier product not found
 */
supplierRoutes.put("/supplier-products/:spId", authorized("ADMIN", "retail.supplier.edit"), async (req, res) => {
  const spId = req.params.spId;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = supplierProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data', details: parsed.error.issues });
  }

  try {
    const updated = await req.tenantDb.update(supplierProduct).set({
      supplierPrice: String(parsed.data.supplierPrice),
      minOrderQty: parsed.data.minOrderQty ?? 1,
      supplierSku: parsed.data.supplierSku || null,
    }).where(
      eq(supplierProduct.id, spId)
    )
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      return res.status(404).json({ error: "Supplier product not found" });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating supplier product:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/supplier-management/supplier/supplier-products/{spId}:
 *   delete:
 *     tags:
 *       - Supplier Management - Products
 *     summary: Unlink a product from a supplier
 *     description: Remove the link between a supplier and a product
 *     parameters:
 *       - in: path
 *         name: spId
 *         required: true
 *         schema:
 *           type: string
 *         description: The supplier-product ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product unlinked successfully
 *       404:
 *         description: Supplier product not found
 */
supplierRoutes.delete("/supplier-products/:spId", authorized("ADMIN", "retail.supplier.delete"), async (req, res) => {
  const spId = req.params.spId;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const deleted = await req.tenantDb.delete(supplierProduct)
      .where(eq(supplierProduct.id, spId))
      .returning()
      .then((rows) => rows[0]);

    if (!deleted) {
      return res.status(404).json({ error: "Supplier product not found" });
    }

    res.status(200).json({ message: "Product unlinked successfully" });
  } catch (error) {
    console.error("Error unlinking supplier product:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default supplierRoutes;
