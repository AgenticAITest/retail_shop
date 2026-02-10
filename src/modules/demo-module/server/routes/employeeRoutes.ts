import { department, employee, employeeBio, employeeSkill } from "@modules/demo-module/server/lib/db/schemas/demoModule";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, hasPermissions, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { validateData } from "src/server/middleware/validationMiddleware";
import { employeeNoValidator, employeeValidator } from "../schemas/employeeSchema";
import { ZodError } from "zod";

const employeeRoutes = Router();
employeeRoutes.use(resolveTenantContext());
employeeRoutes.use(authenticated());
employeeRoutes.use(checkModuleAuthorization('demo-module'));

/**
 * @swagger
 * /api/modules/demo-module/employee:
 *   get:
 *     tags:
 *       - Demo - Employee
 *     summary: Get all employees
 *     description: Retrieve a list of all employees
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
 *         description: The number of employees to retrieve per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: empNo
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
 *         description: A filter to apply to the employee number or name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: A filter to apply to the employee status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of employees
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Employee'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Employee:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The department ID
 *         empNo:
 *           type: string
 *           description: The employee number
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the employee
 *         status:
 *           type: string
 *           description: The status of the user (e.g., active, inactive)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the employee was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the employee was last updated
 *         bio:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               description: The employee bio ID
 *             name:
 *               type: string
 *               description: The name of the employee
 *             birthPlace:
 *               type: string
 *               description: The birth place of the employee
 *             birthDate:
 *               type: string
 *               format: date
 *               description: The birth date of the employee
 *             address:
 *               type: string
 *               description: The address of the employee
 *             gender:
 *               type: string
 *               description: The gender of the employee (e.g., male, female)
 *         department:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               description: The department ID
 *             name:
 *               type: string
 *               description: The name of the department
 *             group:
 *               type: string
 *               description: The group of the department
 *         skills:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The skill ID
 *               name:
 *                 type: string
 *                 description: The name of the skill
 *               rating:
 *                 type: integer
 *                 description: The rating of the skill
 */
employeeRoutes.get("/", authorized("ADMIN", "demo-module.employee.view"), async (req, res) => {

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
  const filterStatus = req.query.status as string | undefined;
  const filterStatusTyped = filterStatus === "active" || filterStatus === "inactive"
    ? filterStatus : undefined;

  // Map allowed sort keys to columns
  const sortColumns = {
    id: employee.id,
    empNo: employee.empNo,
    name: employeeBio.name,
    birthday: employeeBio.birthDate,
    gender: employeeBio.gender,
    department: department.name,
    status: employee.status,
    // add other columns as needed
  } as const;

  // Fallback to 'empNo' if sortParam is not a valid key
  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || employee.empNo;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  // Build filter condition
  const filterCondition = and(
    filterParam
      ? or(
        sql`lower(${employee.empNo}) like ${`%${filterParam.toString().toLowerCase()}%`}`,
        sql`exists (select 1 from demo_employee_bio where demo_employee_bio.employee_id = ${employee.id} and lower(demo_employee_bio.name) like ${`%${filterParam.toString().toLowerCase()}%`})`
      )
      : undefined,

    filterStatusTyped
      ? eq(employee.status, filterStatusTyped)
      : undefined
  )

  // Get total count with filter
  const [{ value: total }] = await req.tenantDb
    .select({ value: count() })
    .from(employee)
    .leftJoin(employeeBio, eq(employee.id, employeeBio.employeeId))
    .where(filterCondition);

  // const employees = await db
  //   .select()
  //   .from(employee)
  //   .where(filterCondition)
  //   .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
  //   .limit(perPage)
  //   .offset(offset);

  const orderByClause = orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn);
  const employees = await req.tenantDb.query.employee.findMany({
    with: {
      bio: {
        columns: {
          id: true,
          name: true,
          birthPlace: true,
          birthDate: true,
          address: true,
          gender: true,
        }
      },
      department: {
        columns: {
          id: true,
          name: true,
          group: true,
        }
      },
      skills: {
        columns: {
          id: true,
          name: true,
          rating: true,
        }
      },
    },
    where: filterCondition,
    orderBy: [orderByClause],
    limit: perPage,
    offset: offset,
  });

  // console.log(employeesQuery.toSQL());
  // const employees = await employeesQuery;
  // console.log(JSON.stringify(employees));

  res.json({
    employees: employees,
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
 * /api/modules/demo-module/employee/ref-departments:
 *   get:
 *     tags:
 *       - Demo - Employee
 *     summary: Get reference departments
 *     description: Fetch a list of reference departments for employee management
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: name
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           default: asc
 *         description: Sort order (asc or desc)
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           default: ''
 *         description: Query string for filtering
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of reference departments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 options:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                         description: The department ID
 *                       label:
 *                         type: string
 *                         description: The name of the department
 *                 count:
 *                   type: integer
 *                   description: Total number of items
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                 perPage:
 *                   type: integer
 *                   description: Number of items per page
 *                 sort:
 *                   type: string
 *                   description: Field sorted by
 *                 order:
 *                   type: string
 *                   description: Sort order
 *                 filter:
 *                   type: string
 *                   description: Query string for filtering
 *                 hasMore:
 *                   type: boolean
 *                   description: Whether there are more pages
 *       401:
 *         description: Unauthorized
 */
employeeRoutes.get("/ref-departments", authorized("ADMIN", "demo-module.employee.view"), async (req, res) => {
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
  const filterParam = req.query.q || '';

  // Fallback to 'empNo' if sortParam is not a valid key
  const sortColumn = department.name;
  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  // Build filter condition
  const filterCondition = filterParam
    ? and(
      or(
        ilike(department.name, `%${filterParam}%`),
      )
    )
    : undefined;

  // Get total count with filter
  const [{ value: total }] = await req.tenantDb
    .select({ value: count() })
    .from(department)
    .where(filterCondition);

  const departments = await req.tenantDb
    .select()
    .from(department)
    .where(filterCondition)
    .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset);

  // check data employees has next page
  const hasMore = total > page * perPage;

  //  convert departments data to options
  const options = departments.map((item) => ({
    value: item.id.toString(),
    label: item.name,
  }));

  res.json({
    options: options,
    count: total,
    page,
    perPage,
    sort: sortParam,
    order: orderParam,
    filter: filterParam,
    hasMore,
  });
});


/**
 * @swagger
 * /api/modules/demo-module/employee/add:
 *   post:
 *     tags:
 *       - Demo - Employee
 *     summary: Add a new employee
 *     description: Create a new employee with the provided details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Employee created successfully
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     EmployeeForm:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The department ID
 *         empNo:
 *           type: string
 *           description: The employee number
 *         email:
 *           type: string
 *           description: The email of the employee
 *         status:
 *           type: string
 *           description: The status of the employee (e.g., active, inactive)
 *         departmentId:
 *           type: string
 *           description: The department ID associated with the employee
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the employee
 *         name:
 *           type: string
 *           description: The name of the employee
 *         birthPlace:
 *           type: string
 *           description: The birth place of the employee
 *         birthDate:
 *           type: string
 *           format: date
 *           description: The birth date of the employee
 *         address:
 *           type: string
 *           description: The address of the employee
 *         gender:
 *           type: string
 *           description: The gender of the employee (e.g., male, female)
 *         skills:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The ID of the skill
 *               name:
 *                 type: string
 *                 description: The name of the skill
 *               rating:
 *                 type: number
 *                 description: The rating of the skill
 * 
 */
employeeRoutes.post("/add", authorized("ADMIN", "demo-module.employee.create"), async (req, res) => {
  const { empNo, email, status, departmentId, name, birthPlace, birthDate, address, gender, skills, tenantId } = req.body;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = employeeValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {
    const newEmpId = crypto.randomUUID();
    // let newEmployee;
    await req.tenantDb.transaction(async (tx) => {
      // newEmployee = await tx.insert(employee)
      // insert new employee
      await tx.insert(employee)
        .values({ id: newEmpId, empNo: empNo, email, status: 'active', departmentId: departmentId })
        .returning().then((rows) => rows[0]);

      // insert new employee bio
      await tx.insert(employeeBio)
        .values({ id: newEmpId, name, birthPlace, birthDate, address, gender, employeeId: newEmpId })
        .returning().then((rows) => rows[0]);

      // insert new employee skills
      if (skills?.length) {
        skills.forEach(async (skill: { name: any; rating: any; }) => {
          await tx.insert(employeeSkill)
            .values({ id: crypto.randomUUID(), name: skill.name, rating: skill.rating, employeeId: newEmpId })
            .returning().then((rows) => rows[0]);
        });
      }
    });

    const data = await req.tenantDb.query.employee.findFirst({
      where: eq(employee.id, newEmpId),
      with: {
        bio: {
          columns: {
            id: true,
            name: true,
            birthPlace: true,
            birthDate: true,
            address: true,
            gender: true,
          }
        },
        department: {
          columns: {
            id: true,
            name: true,
            group: true,
          }
        },
        skills: {
          columns: {
            id: true,
            name: true,
            rating: true,
          }
        },
      },
    });

    res.status(201).json(data);
  } catch (error) {
    console.error("Error creating employee:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/demo-module/employee/validate-name:
 *   post:
 *     tags:
 *       - Demo - Employee
 *     summary: Validate employee name
 *     description: Check if the employee name is unique within the tenant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeCodeValidation'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee name is valid
 *       400:
 *         description: Employee name must be unique within the tenant
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     EmployeeCodeValidation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The employee ID
 *         empNo:
 *           type: string
 *           description: The employee number to validate
 */
employeeRoutes.post("/validate-no", authorized("ADMIN", "demo-module.employee.view"), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const validator = employeeNoValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  res.status(200).json({ message: "Employee name is valid." });
});


/**
 * @swagger
 * /api/modules/demo-module/employee/{id}:
 *   get:
 *     tags:
 *       - Demo - Employee
 *     summary: Get a employee by ID
 *     description: Retrieve a specific employee by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the employee to retrieve
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The employee details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 */
employeeRoutes.get("/:id", authorized("ADMIN", "demo-module.employee.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const data = await req.tenantDb.query.employee.findFirst({
      where: eq(employee.id, idParam),
      with: {
        bio: {
          columns: {
            id: true,
            name: true,
            birthPlace: true,
            birthDate: true,
            address: true,
            gender: true,
          }
        },
        department: {
          columns: {
            id: true,
            name: true,
            group: true,
          }
        },
        skills: {
          columns: {
            id: true,
            name: true,
            rating: true,
          }
        },
      },
    });

    if (!data) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/modules/demo-module/employee/{id}/edit:
 *   put:
 *     tags:
 *       - Demo - Employee
 *     summary: Update a employee
 *     description: Update the details of an existing employee
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the employee to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee updated successfully
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 */
employeeRoutes.put("/:id/edit", authorized("ADMIN", "demo-module.employee.edit"), async (req, res) => {
  const idParam = req.params.id;
  const { id, empNo, email, status, departmentId, name, birthPlace, birthDate, address, gender, skills, tenantId } = req.body;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  if (idParam !== id) {
    return res.status(400).json({ error: "Invalid employee ID" });
  }

  const validator = employeeValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {
    await req.tenantDb.transaction(async (tx) => {
      // update employee
      await tx.update(employee).set({
        empNo,
        email,
        status,
        departmentId,
      }).where(and(
        eq(employee.id, id)
      )
      );

      // update employee bio
      await tx.update(employeeBio).set({
        name,
        birthPlace,
        birthDate,
        address,
        gender,
      }).where(and(
        eq(employeeBio.employeeId, id)
      )
      );

      // remove all old skills, and create all new skills
      await tx.delete(employeeSkill).where(and(
        eq(employeeSkill.employeeId, id)
      ));

      // insert new employee skills
      if (skills?.length) {
        skills.forEach(async (skill: { name: any; rating: any; }) => {
          await tx.insert(employeeSkill)
            .values({ id: crypto.randomUUID(), name: skill.name, rating: skill.rating, employeeId: id })
            .returning().then((rows) => rows[0]);
        });
      }

      // update employee skills
      /*
        skills.forEach(async (skill: { id: any, name: any; rating: any; }) => {
          // compare new skills with old skills, if exist update it, if not exist create new one, and old skill not found in new skill, remove it
          let oldSkills = await tx.query.employeeSkill.findMany({
            where: and(
              eq(employeeSkill.employeeId, id),
              eq(employeeSkill.tenantId, tenantId)
            )
          });

          skills.forEach(async (skill: { id: any, name: any; rating: any; }) => {
            let oldSkill = oldSkills.find((oldSkill: { id: any; }) => oldSkill.id === skill.id);
            if (oldSkill) {
              await tx.update(employeeSkill).set({
                name: skill.name,
                rating: skill.rating,
              }).where(and(
                eq(employeeSkill.id, oldSkill.id),
                eq(employeeSkill.tenantId, tenantId)
              )
              );

              // remove old skill from oldSkills
              oldSkills = oldSkills.filter((oldSkill: { id: any; }) => oldSkill.id !== skill.id);
            } else {
              // insert new employee skills
              await tx.insert(employeeSkill)
                .values({ id: crypto.randomUUID(), name: skill.name, rating: skill.rating, employeeId: id, tenantId: tenantId })
                .returning().then((rows) => rows[0]);
            }
          });

          // delete old skills
          oldSkills.forEach(async (oldSkill: { id: any; }) => {
            await tx.delete(employeeSkill).where(and(
              eq(employeeSkill.id, oldSkill.id),
              eq(employeeSkill.tenantId, tenantId)
            )
            );
          });
        });
      */

    });

    let updatedEmployee = await req.tenantDb.query.employee.findFirst({
      where: eq(employee.id, id),
      with: {
        bio: {
          columns: {
            id: true,
            name: true,
            birthPlace: true,
            birthDate: true,
            address: true,
            gender: true,
          }
        },
        department: {
          columns: {
            id: true,
            name: true,
            group: true,
          }
        },
        skills: {
          columns: {
            id: true,
            name: true,
            rating: true,
          }
        },
      },
    });

    res.status(200).json(updatedEmployee);
  } catch (error) {
    console.error("Error updating employee:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/modules/demo-module/employee/{id}/delete:
 *   delete:
 *     tags:
 *       - Demo - Employee
 *     summary: Delete a employee
 *     description: Delete an existing employee by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the employee to delete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee deleted successfully
 *       404:
 *         description: Employee not found
 */
employeeRoutes.delete("/:id/delete", authorized("ADMIN", "demo-module.employee.delete"), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const idParam = req.params.id;

  try {
    const deletedEmployee = await req.tenantDb.delete(employee).where(and(
      eq(employee.id, idParam)
    )).returning()
      .then((rows) => rows[0]);

    if (!deletedEmployee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default employeeRoutes;