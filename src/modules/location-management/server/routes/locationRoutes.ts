import { location } from "@server/lib/db/schema/tenantSchema";
import { locationCodeValidator, locationValidator } from "@modules/location-management/server/schemas/locationSchema";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { resolveLocationScope } from "@server/middleware/locationScopeMiddleware";
import { ZodError } from "zod";

const locationRoutes = Router();
locationRoutes.use(resolveTenantContext());
locationRoutes.use(authenticated());
locationRoutes.use(resolveLocationScope());
locationRoutes.use(checkModuleAuthorization('location-management'));

/**
 * @swagger
 * /api/modules/location-management/location:
 *   get:
 *     tags:
 *       - Location Management
 *     summary: Get all locations
 *     description: Retrieve a list of all locations with pagination, sorting, and filtering
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
 *         description: The number of locations to retrieve per page
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
 *         description: A filter to apply to location name or code
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of locations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 locations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Location'
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
 *     Location:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The location ID
 *         code:
 *           type: string
 *           description: Unique location code
 *         name:
 *           type: string
 *           description: The name of the location
 *         type:
 *           type: string
 *           enum: [shop, warehouse, distribution_center]
 *           description: The type of location
 *         parentId:
 *           type: string
 *           description: Parent location ID for hierarchy
 *         address:
 *           type: string
 *           description: Full address
 *         city:
 *           type: string
 *           description: City name
 *         province:
 *           type: string
 *           description: Province name
 *         phone:
 *           type: string
 *           description: Contact phone number
 *         timezone:
 *           type: string
 *           description: Timezone identifier
 *         syncConfig:
 *           type: object
 *           description: Sync configuration (for shop type)
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Location status
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
locationRoutes.get("/", authorized("ADMIN", "retail.location.view"), async (req, res) => {

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
    id: location.id,
    code: location.code,
    name: location.name,
    type: location.type,
    city: location.city,
    status: location.status,
  } as const;

  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || location.name;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  const locationScopeCondition = req.locationScope ? inArray(location.id, req.locationScope) : undefined;
  const filterCondition = filterParam
    ? and(
        or(
          ilike(location.name, `%${filterParam}%`),
          ilike(location.code, `%${filterParam}%`),
        ),
        locationScopeCondition,
      )
    : locationScopeCondition;

  const [{ value: total }] = await req.tenantDb
    .select({ value: count() })
    .from(location)
    .where(filterCondition);

  const locations = await req.tenantDb
    .select()
    .from(location)
    .where(filterCondition)
    .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset);

  res.json({
    locations,
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
 * /api/modules/location-management/location/hierarchy:
 *   get:
 *     tags:
 *       - Location Management
 *     summary: Get location hierarchy tree
 *     description: Retrieve all locations organized as a parent-child tree
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Location hierarchy tree
 */
locationRoutes.get("/hierarchy", authorized("ADMIN", "retail.location.view"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const allLocations = await req.tenantDb
      .select()
      .from(location)
      .orderBy(asc(location.name));

    // Build tree structure
    const locationMap = new Map<string, any>();
    const roots: any[] = [];

    for (const loc of allLocations) {
      locationMap.set(loc.id, { ...loc, children: [] });
    }

    for (const loc of allLocations) {
      const node = locationMap.get(loc.id);
      if (loc.parentId && locationMap.has(loc.parentId)) {
        locationMap.get(loc.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    res.json(roots);
  } catch (error) {
    console.error("Error fetching location hierarchy:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/location-management/location/validate-code:
 *   post:
 *     tags:
 *       - Location Management
 *     summary: Validate location code uniqueness
 *     description: Check if the location code is unique within the tenant
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
 *         description: Location code is valid
 *       400:
 *         description: Location code must be unique
 */
locationRoutes.post("/validate-code", authorized("ADMIN", "retail.location.view"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = locationCodeValidator(req.tenantDb);
  try {
    await validator.parseAsync(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Unhandled error:', error);
    return res.status(500).json({ message: 'Validation error' });
  }

  return res.status(200).json({ message: "Location code is valid." });
});


/**
 * @swagger
 * /api/modules/location-management/location/add:
 *   post:
 *     tags:
 *       - Location Management
 *     summary: Add a new location
 *     description: Create a new location with the provided details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LocationForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Location created successfully
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     LocationForm:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *           description: Unique location code
 *         name:
 *           type: string
 *           description: Location name
 *         type:
 *           type: string
 *           enum: [shop, warehouse, distribution_center]
 *         parentId:
 *           type: string
 *         address:
 *           type: string
 *         city:
 *           type: string
 *         province:
 *           type: string
 *         phone:
 *           type: string
 *         timezone:
 *           type: string
 *         syncConfig:
 *           type: object
 *         status:
 *           type: string
 *           enum: [active, inactive]
 */
locationRoutes.post("/add", authorized("ADMIN", "retail.location.create"), async (req, res) => {
  const { code, name, type, parentId, address, city, province, phone, timezone, syncConfig, status } = req.body;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = locationValidator(req.tenantDb);
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
    const newLocation = await req.tenantDb.insert(location).values({
      id: crypto.randomUUID(),
      code,
      name,
      type,
      parentId: parentId || null,
      address: address || null,
      city: city || null,
      province: province || null,
      phone: phone || null,
      timezone: timezone || 'Asia/Jakarta',
      syncConfig: type === 'shop' ? syncConfig : null,
      status: status || 'active',
    })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newLocation);
  } catch (error) {
    console.error("Error creating location:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/location-management/location/{id}:
 *   get:
 *     tags:
 *       - Location Management
 *     summary: Get a location by ID
 *     description: Retrieve a specific location by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the location to retrieve
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The location details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 */
locationRoutes.get("/:id", authorized("ADMIN", "retail.location.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const data = await req.tenantDb
      .select()
      .from(location)
      .where(eq(location.id, idParam))
      .limit(1)
      .then((rows) => rows[0]);

    if (!data) {
      return res.status(404).json({ error: "Location not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching location:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/location-management/location/{id}:
 *   put:
 *     tags:
 *       - Location Management
 *     summary: Update a location
 *     description: Update the details of an existing location
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the location to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LocationForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Location updated successfully
 *       404:
 *         description: Location not found
 */
locationRoutes.put("/:id", authorized("ADMIN", "retail.location.edit"), async (req, res) => {
  const idParam = req.params.id;
  const { id, code, name, type, parentId, address, city, province, phone, timezone, syncConfig, status } = req.body;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  if (idParam !== id) {
    return res.status(400).json({ error: "Invalid location ID" });
  }

  const validator = locationValidator(req.tenantDb);
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
    const updatedLocation = await req.tenantDb.update(location).set({
      code,
      name,
      type,
      parentId: parentId || null,
      address: address || null,
      city: city || null,
      province: province || null,
      phone: phone || null,
      timezone: timezone || 'Asia/Jakarta',
      syncConfig: type === 'shop' ? syncConfig : null,
      status,
    }).where(
      eq(location.id, id)
    )
      .returning()
      .then((rows) => rows[0]);

    res.status(200).json(updatedLocation);
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/location-management/location/{id}:
 *   delete:
 *     tags:
 *       - Location Management
 *     summary: Soft-delete a location
 *     description: Set a location's status to inactive (soft delete)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the location to delete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Location deleted successfully
 *       404:
 *         description: Location not found
 */
locationRoutes.delete("/:id", authorized("ADMIN", "retail.location.delete"), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const idParam = req.params.id;

  try {
    const deletedLocation = await req.tenantDb.update(location).set({
      status: 'inactive',
    }).where(
      eq(location.id, idParam)
    )
      .returning()
      .then((rows) => rows[0]);

    if (!deletedLocation) {
      return res.status(404).json({ error: "Location not found" });
    }

    res.status(200).json({ message: "Location deleted successfully" });
  } catch (error) {
    console.error("Error deleting location:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default locationRoutes;
