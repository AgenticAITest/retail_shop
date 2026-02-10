import { and, asc, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { Router } from "express";
import { option as optionsTable } from "src/server/lib/db/schema/tenantSchema";
import { authenticated, authorized, hasPermissions, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { validateData } from "src/server/middleware/validationMiddleware";
import { optionCodeValidationSchema, optionCodeValidator, optionSchema, optionValidator } from "src/server/schemas/optionSchema";
import { ZodError } from "zod";

const optionRoutes = Router();
optionRoutes.use(resolveTenantContext());
optionRoutes.use(authenticated());

/**
 * @swagger
 * /api/system/option:
 *   get:
 *     tags:
 *       - System - Option
 *     summary: Get all options
 *     description: Retrieve a list of all options
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
 *         description: The number of options to retrieve per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: code
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
 *         description: A filter to apply to the option names
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of options
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Option'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Option:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The option ID
 *         code:
 *           type: string
 *           description: The code of the option
 *         name:
 *           type: string
 *           description: The name of the option
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the option
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the option was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the option was last updated
 */
optionRoutes.get("/", hasPermissions('system.option.view'), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const sortParam = req.query.sort || 'code';
  const orderParam = req.query.order || 'asc';
  const filterParam = req.query.filter || '';

  // Map allowed sort keys to columns
  const sortColumns = {
    id: optionsTable.id,
    code: optionsTable.code,
    name: optionsTable.name,
    value: optionsTable.value,
    // add other columns as needed
  } as const;

  // Fallback to 'name' if sortParam is not a valid key
  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || optionsTable.name;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  // Build filter condition
  const filterCondition = filterParam
    ? or(
        ilike(optionsTable.code, `%${filterParam}%`), 
        ilike(optionsTable.name, `%${filterParam}%`),
        ilike(optionsTable.value, `%${filterParam}%`)
      )
    : undefined;

  // Get total count with filter
  const [{ value: total }] = await req.tenantDb!
    .select({ value: count() })
    .from(optionsTable)
    .where(filterCondition);

  const optionList = await req.tenantDb!
    .select()
    .from(optionsTable)
    .where(filterCondition)
    .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset);

  res.json({
    options: optionList,
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
 * /api/system/option/add:
 *   post:
 *     tags:
 *       - System - Option
 *     summary: Add a new option
 *     description: Create a new option with the provided details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OptionForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Option created successfully
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     OptionForm:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The option ID
 *         code:
 *           type: string
 *           description: The code of the option
 *         name:
 *           type: string
 *           description: The name of the option
 *         value:
 *           type: string
 *           description: The value of the option
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the option
 */
optionRoutes.post("/add", hasPermissions('system.option.create'), async (req, res) => {
  const { code, name, value, tenantId } = req.body;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database not available" });
  }

  const validator = optionValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {
    const newOption = await req.tenantDb!.insert(optionsTable).values({
      id: crypto.randomUUID(),
      code,
      name,
      value,
    })
      .returning()
      .then((rows: any) => rows[0]);

    res.status(201).json(newOption);
  } catch (error) {
    console.error("Error creating option:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/option/validate-code:
 *   post:
 *     tags:
 *       - System - Option
 *     summary: Validate option code
 *     description: Check if the option code is unique within the tenant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OptionCodeValidation'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Option code is valid
 *       400:
 *         description: Option code must be unique within the tenant
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     OptionCodeValidation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The option ID
 *         code:
 *           type: string
 *           description: The code of the option
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the option
 */
optionRoutes.post("/validate-code", hasPermissions('system.option.edit'), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database not available" });
  }

  const validator = optionCodeValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  res.status(200).json({ message: "Option code is valid." });
});

/**
 * @swagger
 * /api/system/option/{id}:
 *   get:
 *     tags:
 *       - System - Option
 *     summary: Get a option by ID
 *     description: Retrieve a specific option by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the option to retrieve
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The option details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Option'
 */
optionRoutes.get("/:id", hasPermissions('system.option.view'), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb){
    return res.status(500).json({ error: "Tenant database not available" });
  }

  try {
    const data = await req.tenantDb
      .select()
      .from(optionsTable)
      .where(eq(optionsTable.id, idParam))
      .limit(1)
      .then((rows: any) => rows[0]);

    if (!data) {
      return res.status(404).json({ error: "Option not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching option:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/option/{id}/edit:
 *   put:
 *     tags:
 *       - System - Option
 *     summary: Update a option
 *     description: Update the details of an existing option
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the option to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OptionForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Option updated successfully
 *       404:
 *         description: Option not found
 *       500:
 *         description: Internal server error
 */
optionRoutes.put("/:id/edit", hasPermissions('system.option.edit'), async (req, res) => {
  const idParam = req.params.id;
  const { id, code, name, value } = req.body;

  if (idParam !== id) {
    return res.status(400).json({ error: "Invalid option ID" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database not available" });
  }

  const validator = optionValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {
    const updatedOption = await req.tenantDb!.update(optionsTable).set({
      code,
      name,
      value
    }).where(eq(optionsTable.id, id)
    )
      .returning()
      .then((rows: any) => rows[0]);

    res.status(200).json(updatedOption);
  } catch (error) {
    console.error("Error updating option:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/option/{id}/delete:
 *   delete:
 *     tags:
 *       - System - Option
 *     summary: Delete a option
 *     description: Delete an existing option by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the option to delete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Option deleted successfully
 *       404:
 *         description: Option not found
 */
optionRoutes.delete("/:id/delete", hasPermissions('system.option.delete'), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const idParam = req.params.id;

  try {
    const deletedOption = await req.tenantDb!.delete(optionsTable).where(
      eq(optionsTable.id, idParam)
    ).returning()
      .then((rows: any) => rows[0]);

    if (!deletedOption) {
      return res.status(404).json({ error: "Option not found" });
    }

    res.status(200).json({ message: "Option deleted successfully" });
  } catch (error) {
    console.error("Error deleting option:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default optionRoutes;