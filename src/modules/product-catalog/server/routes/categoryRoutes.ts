import { product, category } from "@server/lib/db/schema/tenantSchema";
import { categorySchema, categoryNameValidator } from "@modules/product-catalog/server/schemas/productSchema";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { ZodError } from "zod";

const categoryRoutes = Router();
categoryRoutes.use(resolveTenantContext());
categoryRoutes.use(authenticated());
categoryRoutes.use(checkModuleAuthorization('product-catalog'));

// ============================================================
// CATEGORIES
// ============================================================

/**
 * @swagger
 * /api/modules/product-catalog/category:
 *   get:
 *     tags:
 *       - Product Catalog - Categories
 *     summary: Get all categories
 *     description: Retrieve a flat list of all categories with parent info
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
 *           default: 50
 *         description: The number of categories per page
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
 *         description: The sort order
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Filter by category name
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
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
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         parentId:
 *           type: string
 *         level:
 *           type: integer
 *         path:
 *           type: string
 *         sortOrder:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
categoryRoutes.get("/", authorized("ADMIN", "retail.product.view"), async (req, res) => {

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
    id: category.id,
    name: category.name,
    level: category.level,
    sortOrder: category.sortOrder,
    status: category.status,
  } as const;

  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || category.name;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 50;
  const offset = (page - 1) * perPage;

  const filterCondition = filterParam
    ? ilike(category.name, `%${filterParam}%`)
    : undefined;

  const [{ value: total }] = await req.tenantDb
    .select({ value: count() })
    .from(category)
    .where(filterCondition);

  // Use aliased self-join to include parent info
  const categories = await req.tenantDb.query.category.findMany({
    where: filterCondition,
    with: {
      parent: true,
    },
    orderBy: orderParam === 'asc' ? [asc(sortColumn)] : [desc(sortColumn)],
    limit: perPage,
    offset,
  });

  res.json({
    categories,
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
 * /api/modules/product-catalog/category/tree:
 *   get:
 *     tags:
 *       - Product Catalog - Categories
 *     summary: Get category tree
 *     description: Retrieve all categories organized as a hierarchical tree
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category hierarchy tree
 */
categoryRoutes.get("/tree", authorized("ADMIN", "retail.product.view"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const allCategories = await req.tenantDb
      .select()
      .from(category)
      .where(eq(category.status, 'active'))
      .orderBy(asc(category.sortOrder), asc(category.name));

    // Build tree structure
    const categoryMap = new Map<string, any>();
    const roots: any[] = [];

    for (const cat of allCategories) {
      categoryMap.set(cat.id, { ...cat, children: [] });
    }

    for (const cat of allCategories) {
      const node = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    res.json(roots);
  } catch (error) {
    console.error("Error fetching category tree:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/category/validate-name:
 *   post:
 *     tags:
 *       - Product Catalog - Categories
 *     summary: Validate category name uniqueness
 *     description: Check if a category name is unique within the same parent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               parentId:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category name is valid
 *       400:
 *         description: Category name must be unique within parent
 */
categoryRoutes.post("/validate-name", authorized("ADMIN", "retail.product.view"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = categoryNameValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  res.status(200).json({ message: "Category name is valid." });
});


/**
 * @swagger
 * /api/modules/product-catalog/category/add:
 *   post:
 *     tags:
 *       - Product Catalog - Categories
 *     summary: Create a new category
 *     description: Add a new category. Level and path are auto-set based on parentId.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Validation error
 */
categoryRoutes.post("/add", authorized("ADMIN", "retail.product.create"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data', details: parsed.error.issues });
  }

  const { name, parentId, sortOrder } = parsed.data;

  try {
    // Auto-set level and path based on parentId
    let level = 1;
    let path = '';

    if (parentId) {
      const parent = await req.tenantDb
        .select()
        .from(category)
        .where(eq(category.id, parentId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!parent) {
        return res.status(400).json({ error: "Parent category not found" });
      }

      level = parent.level + 1;
      path = parent.path ? `${parent.path}/${parent.id}` : parent.id;
    }

    const newCategory = await req.tenantDb.insert(category).values({
      id: crypto.randomUUID(),
      name,
      parentId: parentId || null,
      level,
      path: path || null,
      sortOrder: sortOrder ?? 0,
      status: 'active',
    })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newCategory);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/category/{id}:
 *   get:
 *     tags:
 *       - Product Catalog - Categories
 *     summary: Get a category by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category details
 *       404:
 *         description: Category not found
 */
categoryRoutes.get("/:id", authorized("ADMIN", "retail.product.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const data = await req.tenantDb
      .select()
      .from(category)
      .where(eq(category.id, idParam))
      .limit(1)
      .then((rows) => rows[0]);

    if (!data) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/category/{id}:
 *   put:
 *     tags:
 *       - Product Catalog - Categories
 *     summary: Update a category
 *     description: Update an existing category
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 */
categoryRoutes.put("/:id", authorized("ADMIN", "retail.product.edit"), async (req, res) => {
  const id = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data', details: parsed.error.issues });
  }

  const { name, parentId, sortOrder } = parsed.data;

  try {
    // Recalculate level and path if parentId changed
    let level = 1;
    let path = '';

    if (parentId) {
      const parent = await req.tenantDb
        .select()
        .from(category)
        .where(eq(category.id, parentId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!parent) {
        return res.status(400).json({ error: "Parent category not found" });
      }

      level = parent.level + 1;
      path = parent.path ? `${parent.path}/${parent.id}` : parent.id;
    }

    const updatedCategory = await req.tenantDb.update(category).set({
      name,
      parentId: parentId || null,
      level,
      path: path || null,
      sortOrder: sortOrder ?? 0,
    }).where(
      eq(category.id, id)
    )
      .returning()
      .then((rows) => rows[0]);

    if (!updatedCategory) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.status(200).json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/product-catalog/category/{id}:
 *   delete:
 *     tags:
 *       - Product Catalog - Categories
 *     summary: Deactivate a category
 *     description: Set a category to inactive (only if no products reference it)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category deactivated successfully
 *       400:
 *         description: Category has products assigned
 *       404:
 *         description: Category not found
 */
categoryRoutes.delete("/:id", authorized("ADMIN", "retail.product.delete"), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const idParam = req.params.id;

  try {
    // Check if any products reference this category
    const [{ value: productCount }] = await req.tenantDb
      .select({ value: count() })
      .from(product)
      .where(eq(product.categoryId, idParam));

    if (productCount > 0) {
      return res.status(400).json({
        error: `Cannot deactivate category: ${productCount} product(s) are assigned to it.`
      });
    }

    const deactivated = await req.tenantDb.update(category).set({
      status: 'inactive',
    }).where(
      eq(category.id, idParam)
    )
      .returning()
      .then((rows) => rows[0]);

    if (!deactivated) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.status(200).json({ message: "Category deactivated successfully" });
  } catch (error) {
    console.error("Error deactivating category:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default categoryRoutes;
