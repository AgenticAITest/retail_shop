import { document } from "@modules/demo-module/server/lib/db/schemas/demoModule";
import { documentCodeValidator, documentValidator } from "@modules/demo-module/server/schemas/documentSchema";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { format } from "date-fns";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { Router } from "express";
import fileUpload from "express-fileupload";
import { format as csvFormat, parse as csvParse } from 'fast-csv';
import { ZodError } from "node_modules/zod/v4/classic/external.cjs";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";

const documentRoutes = Router();

documentRoutes.use(resolveTenantContext());
documentRoutes.use(authenticated());
documentRoutes.use(checkModuleAuthorization('demo-module'));


/**
 * @swagger
 * /api/modules/demo-module/document:
 *   get:
 *     tags:
 *       - Demo - Document
 *     summary: Get all documents
 *     description: Retrieve a list of all documents
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
 *         description: The number of documents to retrieve per page
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
 *         description: A filter to apply to the document names
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Document'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The document ID
 *         name:
 *           type: string
 *           description: The name of the document
 *         code:
 *           type: string
 *           description: The code of the document
 *         releaseDate:
 *           type: string
 *           format: date
 *           description: The date when the document was released
 *         pages:
 *           type: integer
 *           description: The number of pages in the document
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the document
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the document was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the document was last updated
 */
documentRoutes.get("/",  authorized("ADMIN", "demo-module.document.view"), async (req, res) => {

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

  // Map allowed sort keys to columns
  const sortColumns = {
    id: document.id,
    name: document.name,
    code: document.code,
    releaseDate: document.releaseDate,
    pages: document.pages,
    // add other columns as needed
  } as const;

  // Fallback to 'name' if sortParam is not a valid key
  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || document.name;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  // Build filter condition
  const filterCondition = filterParam
    ? and(
      or(
        ilike(document.name, `%${filterParam}%`),
        ilike(document.code, `%${filterParam}%`),
      )
    )
    : undefined;

  // Get total count with filter
  const [{ value: total }] = await req.tenantDb
    .select({ value: count() })
    .from(document)
    .where(filterCondition);

  const documents = await req.tenantDb
    .select()
    .from(document)
    .where(filterCondition)
    .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset);

  res.json({
    documents,
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
 * /api/modules/demo-module/document/add:
 *   post:
 *     tags:
 *       - Demo - Document
 *     summary: Add a new document
 *     description: Create a new document with the provided details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Document created successfully
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     DocumentForm:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The document ID
 *         name:
 *           type: string
 *           description: The name of the document
 *         code:
 *           type: string
 *           description: The code of the document
 *         releaseDate:
 *           type: string
 *           format: date
 *           description: The date when the document was released
 *         pages:
 *           type: integer
 *           description: The number of pages in the document
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the document
 */
documentRoutes.post("/add", authorized("ADMIN", "demo-module.document.create"), async (req, res) => {
  const { name, code, releaseDate, pages, tenantId } = req.body;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = documentValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {
    const newDocument = await req.tenantDb.insert(document).values({
      id: crypto.randomUUID(),
      name,
      code,
      releaseDate: format(releaseDate, 'yyyy-MM-dd'),
      pages
    })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newDocument);
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/demo-module/document/edit:
 *   put:
 *     tags:
 *       - Demo - Document
 *     summary: Bulk edit document
 *     description: Edit multiple documents with the provided IDs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EditDocumentForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Documents updated successfully
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     EditDocumentForm:
 *       type: object
 *       properties:
 *         ids:
 *           type: array
 *           items:
 *             type: string
 *             description: The IDs of the documents to edit
 *         releaseDate:
 *           type: string
 *           format: date
 *           description: The new release date for the documents
 *         pages:
 *           type: integer
 *           description: The new number of pages for the documents
 */
documentRoutes.put("/edit", authorized("ADMIN", "demo-module.document.edit"), async (req, res) => {
  const { ids, pages, releaseDate } = req.body;

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }
  
  const tenantId = req.user.tenantId;

  try {
    await req.tenantDb.transaction(async (tx) => {
      if (ids?.length) {
        ids.forEach(async (id: string) => {

          // Build update object only with provided fields
          const updateObj: Record<string, any> = {};
          if (releaseDate !== undefined) {
            updateObj.releaseDate = format(new Date(releaseDate), 'yyyy-MM-dd');
          }
          if (pages !== undefined) {
            updateObj.pages = pages;
          }

          if (Object.keys(updateObj).length === 0) {
            // Nothing to update, skip
            return;
          }

          const updatedDocument = await tx.update(document).set(updateObj)
            .where(and(
              eq(document.id, id)
            )).returning()
            .then((rows) => rows[0]);

          if (!updatedDocument) {
            throw new Error(`Document with id ${id} not found`);
          }
        });
      }

      res.status(200).json({ message: "Bulk document updated successfully" });
    });
  } catch (error) {
    console.error("Error bulk updating document:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/demo-module/document/delete:
 *   delete:
 *     tags:
 *       - Demo - Document
 *     summary: Bulk delete document
 *     description: Delete multiple documents with the provided IDs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeleteDocumentForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Documents deleted successfully
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     DeleteDocumentForm:
 *       type: object
 *       properties:
 *         ids:
 *           type: array
 *           items:
 *             type: string
 *             description: The IDs of the documents to delete
 * 
 */
documentRoutes.delete("/delete", authorized("ADMIN", "demo-module.document.delete"), async (req, res) => {
  const { ids } = req.body;

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const tenantId = req.user.tenantId;

  try {
    await req.tenantDb.transaction(async (tx) => {
      if (ids?.length) {
        ids.forEach(async (id: string) => {
          const deletedDocument = await tx.delete(document).where(and(
            eq(document.id, id)
          )).returning()
            .then((rows) => rows[0]);

          if (!deletedDocument) {
            throw new Error(`Document with id ${id} not found`);
          }
        });
      }

      res.status(200).json({ message: "Bulk document deleted successfully" });
    });
  } catch (error) {
    console.error("Error bulk deleting document:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


//export documents to csv
/**
 * @swagger
 * /api/modules/demo-module/document/export:
 *   get:
 *     tags:
 *       - Demo - Document
 *     summary: Export documents to CSV
 *     description: Export all documents to a CSV file for download
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file containing the exported documents
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
documentRoutes.get("/export", authorized("ADMIN", "demo-module.document.export"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const documents = await req.tenantDb.select().from(document)
    .then((rows) => rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      releaseDate: row.releaseDate,
      pages: row.pages,
    })));

  // Set response headers for CSV download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="data.csv"');

  // Create a writable stream for fast-csv
  const csvStream = csvFormat({ headers: true });

  // Pipe the data to the CSV stream and then to the response
  csvStream.pipe(res);

  // Write each row of data
  documents.forEach(row => csvStream.write(row));

  // End the CSV stream
  csvStream.end();

});


// import documents from csv file
/**
 * @swagger
 * /api/modules/demo-module/document/import:
 *   post:
 *     tags:
 *       - Demo - Document
 *     summary: Import documents from CSV
 *     description: Import documents by uploading a CSV file
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The CSV file to upload
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Documents imported successfully
 */
documentRoutes.post("/import", authorized("ADMIN", "demo-module.document.import"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }


  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  console.log(req.files);

  interface DocumentRow {
    code: string;
    name: string;
    releaseDate: string;
    pages: string;
  }

  try {

    const file = req.files?.file as fileUpload.UploadedFile;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    if (file.mimetype !== 'text/csv' && !file.name.endsWith('.csv')) {
      return res.status(400).json({ error: "Invalid file type. Only CSV files are allowed." });
    }

    console.log(file);

    // Parse CSV read from file.data buffer 
    const parseCSV = (file: fileUpload.UploadedFile): Promise<DocumentRow[]> => {
      return new Promise((resolve, reject) => {
        const results: DocumentRow[] = [];
        const stream = csvParse({ headers: true })
          .on('data', (data) => {
            results.push(data);
          })
          .on('end', () => {
            resolve(results);
          })
          .on('error', (error) => {
            reject(error);
          });

        // Write the buffer data to the stream
        stream.write(file.data);
        stream.end();
      });
    };

    const documents = await parseCSV(file);
    // console.log(documents);

    // Validate and insert documents into the database
    await req.tenantDb.transaction(async (tx) => {
      for (const documentData of documents) {
        const { code, name, releaseDate, pages } = documentData;

        const data = await tx
          .select()
          .from(document)
          .where(and(
            eq(document.code, code)
          ))
          .limit(1)
          .then((rows) => rows[0]);

        if (data) {
          console.warn(`Document with code ${code} already exists. Continue to updating record.`);

          //update existing record
          await tx.update(document).set({
            name,
            releaseDate: format(new Date(releaseDate), 'yyyy-MM-dd'),
            pages: pages ? Number(pages) : undefined,
          }).where(and(
            eq(document.code, code)
          ));

        } else {
          // create new record
          await tx.insert(document).values({
            id: crypto.randomUUID(),
            code,
            name,
            releaseDate: format(releaseDate, 'yyyy-MM-dd'),
            pages: pages ? Number(pages) : undefined
          });
        }
      }
    });

    res.status(201).json({ message: "Documents imported successfully." });
  } catch (error) {
    console.error("Error importing documents:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/demo-module/document/{id}:
 *   get:
 *     tags:
 *       - Demo - Document
 *     summary: Get a document by ID
 *     description: Retrieve a specific document by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the document to retrieve
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The document details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 */
documentRoutes.get("/:id", authorized("ADMIN", "demo-module.document.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const data = await req.tenantDb
      .select()
      .from(document)
      .where(eq(document.id, idParam))
      .limit(1)
      .then((rows) => rows[0]);

    if (!data) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/demo-module/document/{id}/edit:
 *   put:
 *     tags:
 *       - Demo - Document
 *     summary: Update a document
 *     description: Update the details of an existing document
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the document to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Document updated successfully
 *       404:
 *         description: Document not found
 *       500:
 *         description: Internal server error
 */
documentRoutes.put("/:id/edit", authorized("ADMIN", "demo-module.document.edit"), async (req, res) => {
  const idParam = req.params.id;
  const { id, name, code, releaseDate, pages, tenantId } = req.body;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  if (idParam !== id) {
    return res.status(400).json({ error: "Invalid document ID" });
  }

  const validator = documentValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {
    const updatedDocument = await req.tenantDb.update(document).set({
      name,
      code,
      releaseDate: format(releaseDate, 'yyyy-MM-dd'),
      pages,
    }).where(and(
      eq(document.id, id)
    )
    )
      .returning()
      .then((rows) => rows[0]);

    res.status(200).json(updatedDocument);
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/modules/demo-module/document/{id}/delete:
 *   delete:
 *     tags:
 *       - Demo - Document
 *     summary: Delete a document
 *     description: Delete an existing document by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the document to delete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       404:
 *         description: Document not found
 */
documentRoutes.delete("/:id/delete", authorized("ADMIN", "demo-module.document.delete"), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const idParam = req.params.id;

  try {
    const deletedDocument = await req.tenantDb.delete(document).where(and(
      eq(document.id, idParam)
    )).returning()
      .then((rows) => rows[0]);

    if (!deletedDocument) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.status(200).json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/modules/demo-module/document/validate-code:
 *   post:
 *     tags:
 *       - Demo - Document
 *     summary: Validate document code
 *     description: Check if the document code is unique within the tenant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentCodeValidation'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Document code is valid
 *       400:
 *         description: Document code must be unique within the tenant
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     DocumentCodeValidation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The document ID
 *         code:
 *           type: string
 *           description: The code of the document
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the document
 */
documentRoutes.post("/validate-code", authorized("ADMIN", "demo-module.document.view"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = documentCodeValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  res.status(200).json({ message: "Document code is valid." });
});

export default documentRoutes;