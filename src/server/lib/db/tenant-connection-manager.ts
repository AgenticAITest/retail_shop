import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "dotenv/config";
import * as sharedSchema from "./schema/sharedSchema";
import * as tenantSchema from "./schema/tenantSchema";

// Load environment configuration
//config({ path: '.env' });

class TenantConnectionManager {
    private config: {
        databaseUrl: string;
        schemaPrefix: string;
        sharedSchema: string;
        maxConnections: number;
        idleTimeout: number;
        enableQueryLogging: boolean;
    };
    private connections: Map<string, postgres.Sql<{}>>;
    private drizzleInstances: Map<
        string,
        PostgresJsDatabase<typeof tenantSchema> & { $client: postgres.Sql<{}> }
    >;
    private logger: any;
    private sharedConnection: postgres.Sql<{}> | null;
    private sharedDrizzle:
        | (PostgresJsDatabase<typeof sharedSchema> & {
              $client: postgres.Sql<{}>;
          })
        | null;

    constructor() {
        this.config = {
            databaseUrl:
                process.env.DATABASE_URL ||
                "postgresql://user:password@localhost:5432/react_admin_multitenancy",
            schemaPrefix: process.env.TENANT_SCHEMA_PREFIX || "tenant_",
            sharedSchema: process.env.SHARED_SCHEMA || "public",
            maxConnections: process.env.MAX_CONNECTIONS
                ? parseInt(process.env.MAX_CONNECTIONS, 10)
                : 10,
            idleTimeout: process.env.IDLE_TIMEOUT
                ? parseInt(process.env.IDLE_TIMEOUT, 10)
                : 30000,
            enableQueryLogging:
                process.env.ENABLE_QUERY_LOGGING === "true" || false,
        };

        this.connections = new Map(); // tenant -> connection
        this.drizzleInstances = new Map(); // tenant -> drizzle instance
        this.logger = this.createLogger();

        // Shared schema connection (for tenant management)
        this.sharedConnection = null;
        this.sharedDrizzle = null;
    }

    createLogger() {
        const logLevel = process.env.CONNECTION_LOG_LEVEL || "info";
        return {
            debug: (msg: string) =>
                logLevel === "debug" && console.log(`[DEBUG] ${msg}`),
            info: (msg: string) => console.log(`\x1b[32m[INFO]\x1b[0m ${msg}`),
            warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
            error: (msg: string) =>
                console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
        };
    }

    /**
     * Initialize the shared schema connection
     */
    async initializeSharedConnection(): Promise<
        PostgresJsDatabase<typeof sharedSchema> & { $client: postgres.Sql<{}> }
    > {
        if (this.sharedConnection && this.sharedDrizzle)
            return this.sharedDrizzle;

        const connectionString = this.config.databaseUrl;

        this.sharedConnection = postgres(connectionString, {
            max: 5, // Smaller pool for shared schema
            idle_timeout: this.config.idleTimeout,
            onnotice: () => {}, // Suppress notices
        });

        this.sharedDrizzle = drizzle(this.sharedConnection, {
            schema: { ...sharedSchema },
            logger: this.config.enableQueryLogging,
        });

        this.logger.debug("Shared schema connection initialized");
        return this.sharedDrizzle;
    }

    /**
     * Get tenant schema name
     */
    getTenantSchemaName(tenantCode: string): string {
        return `${this.config.schemaPrefix}${tenantCode}`;
    }

    /**
     * Create or get connection for a specific tenant
     */
    async getTenantConnection(tenantCode: string): Promise<any> {
        // Check if connection already exists
        if (this.connections.has(tenantCode)) {
            return this.connections.get(tenantCode);
        }

        // Validate tenant exists
        if (!(await this.validateTenantExists(tenantCode))) {
            throw new Error(`Tenant '${tenantCode}' does not exist`);
        }

        const schemaName = this.getTenantSchemaName(tenantCode);
        const connectionString = this.config.databaseUrl;

        // Create a dedicated connection pool for this tenant with search_path in connection string
        // Use connection parameters to set search_path that applies to all connections in the pool
        const connectionWithParams = `${connectionString}${connectionString.includes('?') ? '&' : '?'}options=-c%20search_path%3D${schemaName}%2C${this.config.sharedSchema}`;
        
        const connection = postgres(connectionWithParams, {
            max: this.config.maxConnections,
            idle_timeout: this.config.idleTimeout,
            onnotice: () => {}, // Suppress notices
            transform: {
                undefined: null,
            },
        });

        // Test connection
        try {
            await connection`SELECT 1`;
            this.logger.debug(
                `Connection created for tenant: ${tenantCode} (schema: ${schemaName})`,
            );
        } catch (error) {
            await connection.end();
            throw new Error(
                `Failed to create connection for tenant ${tenantCode}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        this.connections.set(tenantCode, connection);
        return connection;
    }

    /**
     * Get Drizzle instance for a specific tenant
     */
    async getTenantDrizzle(
        tenantCode: string,
        schema: typeof tenantSchema,
    ): Promise<PostgresJsDatabase<typeof tenantSchema> & { $client: any }> {

        // Check if Drizzle instance already exists
        if (this.drizzleInstances.has(tenantCode)) {
            const instance = this.drizzleInstances.get(tenantCode);
            if (instance) {
                return instance;
            }
        }

        const connection = await this.getTenantConnection(tenantCode);
        const schemaName = this.getTenantSchemaName(tenantCode);

        // search_path is automatically set by the connection callback for every pooled connection
        const drizzleInstance = drizzle(connection, {
            schema,
            logger: this.config.enableQueryLogging,
        });

        this.drizzleInstances.set(tenantCode, drizzleInstance);
        this.logger.debug(`Drizzle instance created for tenant: ${tenantCode} with search_path: ${schemaName}, ${this.config.sharedSchema}`);

        return drizzleInstance;
    }

    /**
     * Validate that a tenant exists in the shared schema
     */
    async validateTenantExists(tenantCode: string): Promise<boolean> {
        const sharedDb = await this.initializeSharedConnection();
        if (!this.sharedConnection) {
            throw new Error("Shared connection is not initialized");
        }
        try {
            const result = await this.sharedConnection`
                SELECT EXISTS(
                    SELECT 1 FROM sys_tenant 
                    WHERE code = ${tenantCode}
                ) as exists
            `;

            return result[0].exists;
        } catch (error) {
            this.logger.error(
                `Failed to validate tenant ${tenantCode}: ${error instanceof Error ? error.message : String(error)}`,
            );
            return false;
        }
    }

    /**
     * Get list of all available tenants
     */
    async getAvailableTenants(): Promise<any[]> {
        const sharedDb = await this.initializeSharedConnection();
        if (!this.sharedConnection) {
            throw new Error("Shared connection is not initialized");
        }
        try {
            const tenants = await this.sharedConnection`
                SELECT id, code, name, description 
                FROM sys_tenant 
                ORDER BY code
            `;

            return tenants;
        } catch (error) {
            this.logger.error(
                `Failed to get available tenants: ${error instanceof Error ? error.message : String(error)}`,
            );
            return [];
        }
    }

    /**
     * Execute a query in a specific tenant context
     */
    async executeInTenantContext(
        tenantCode: string,
        queryFn: Function,
    ): Promise<any> {
        const connection = await this.getTenantConnection(tenantCode);

        try {
            return await queryFn(connection);
        } catch (error) {
            this.logger.error(
                `Query execution failed for tenant ${tenantCode}: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    /**
     * Execute a Drizzle operation in a specific tenant context
     */
    async executeWithTenantDrizzle(
        tenantCode: string,
        schema: any,
        operationFn: Function,
    ): Promise<any> {
        const drizzleDb = await this.getTenantDrizzle(tenantCode, schema);

        try {
            return await operationFn(drizzleDb);
        } catch (error) {
            this.logger.error(
                `Drizzle operation failed for tenant ${tenantCode}: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    /**
     * Close connection for a specific tenant
     */
    async closeTenantConnection(tenantCode: string): Promise<void> {
        const connection = this.connections.get(tenantCode);
        if (connection) {
            await connection.end();
            this.connections.delete(tenantCode);
            this.drizzleInstances.delete(tenantCode);
            this.logger.debug(`Connection closed for tenant: ${tenantCode}`);
        }
    }

    /**
     * Close all connections
     */
    async closeAllConnections(): Promise<void> {
        // Close tenant connections
        const closePromises = Array.from(this.connections.keys()).map(
            (tenantCode) => this.closeTenantConnection(tenantCode),
        );

        // Close shared connection
        if (this.sharedConnection) {
            closePromises.push(this.sharedConnection.end());
            this.sharedConnection = null;
            this.sharedDrizzle = null;
        }

        await Promise.all(closePromises);
        this.logger.info("All database connections closed");
    }

    /**
     * Get connection statistics
     */
    getConnectionStats() {
        return {
            totalTenantConnections: this.connections.size,
            activeTenants: Array.from(this.connections.keys()),
            sharedConnectionActive: !!this.sharedConnection,
            drizzleInstances: this.drizzleInstances.size,
        };
    }

    /**
     * Health check for all connections
     */
    async healthCheck(): Promise<any> {
        const results: any = {
            shared: { healthy: false, error: null },
            tenants: {},
        };

        // Check shared connection
        if (!this.sharedConnection) {
            results.shared.error = "Shared connection is not initialized";
            return results;
        }

        try {
            await this.initializeSharedConnection();
            await this.sharedConnection`SELECT 1`;
            results.shared.healthy = true;
        } catch (error) {
            results.shared.error =
                error instanceof Error ? error.message : String(error);
        }

        // Check tenant connections
        for (const [tenantCode, connection] of this.connections) {
            try {
                await connection`SELECT 1`;
                results.tenants[tenantCode] = { healthy: true, error: null };
            } catch (error) {
                results.tenants[tenantCode] = {
                    healthy: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        }

        return results;
    }

    /**
     * Create a tenant context resolver middleware factory
     */
    createTenantContextMiddleware() {
        return (req: any, res: any, next: any) => {
            // Extract tenant from subdomain
            const host = req.get("host") || "";
            const subdomain = host.split(".")[0];

            // Extract tenant from header (fallback)
            const headerTenant = req.get("x-tenant-code");

            // Extract tenant from JWT token (if available)
            let tokenTenant = null;
            if (req.user && req.user.activeTenantCode) {
                tokenTenant = req.user.activeTenantCode;
            }

            // Determine tenant code (priority: header > token > subdomain)
            const tenantCode = headerTenant || tokenTenant || subdomain;

            if (!tenantCode) {
                return res.status(400).json({
                    error: "Tenant context required",
                    message:
                        "Please provide tenant via subdomain, X-Tenant-Code header, or authentication token",
                });
            }

            // Attach tenant context to request
            req.tenantContext = {
                code: tenantCode,
                schemaName: this.getTenantSchemaName(tenantCode),
            };

            // Attach connection getter to request
            req.getTenantDb = async (schema = {}) => {
                return this.getTenantDrizzle(tenantCode, tenantSchema);
            };

            // Attach shared DB getter to request
            req.getSharedDb = async () => {
                return this.initializeSharedConnection();
            };

            this.logger.debug(`Tenant context resolved: ${tenantCode}`);
            next();
        };
    }

    /**
     * Create tenant schema and initialize tables
     */
    async createTenantSchema(tenantCode: string) {
        try {
            if (!this.sharedDrizzle) {
                await this.initializeSharedConnection();
            }
            if (!this.sharedDrizzle) {
                throw new Error("Shared Drizzle instance is not initialized");
            }

            const newTenantSchemaName = this.getTenantSchemaName(tenantCode);
            this.logger.info(`Creating schema: ${newTenantSchemaName}`);

            // Create the schema first
            await this.sharedDrizzle.execute(
                `CREATE SCHEMA IF NOT EXISTS "${newTenantSchemaName}"`,
            );

            const tenantDb = await this.getTenantDrizzle(
                tenantCode,
                tenantSchema,
            );

            // Create tables in the new tenant schema
            const createTablesSQL = `
            CREATE TABLE IF NOT EXISTS "sys_permission" (
                "id" uuid PRIMARY KEY NOT NULL,
                "code" varchar(255) NOT NULL,
                "name" varchar(255) NOT NULL,
                "description" varchar(255),
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL,
                CONSTRAINT "sys_permission_code_unique" UNIQUE("code")
            );

            CREATE TABLE IF NOT EXISTS "sys_role" (
                "id" uuid PRIMARY KEY NOT NULL,
                "code" varchar(255) NOT NULL,
                "name" varchar(255) NOT NULL,
                "description" varchar(255),
                "is_system" boolean NOT NULL,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL,
                CONSTRAINT "sys_role_code_unique" UNIQUE("code")
            );

            CREATE TABLE IF NOT EXISTS "sys_role_permission" (
                "role_id" uuid NOT NULL,
                "permission_id" uuid NOT NULL,
                CONSTRAINT "sys_role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
            );

            CREATE TABLE IF NOT EXISTS "sys_user" (
                "id" uuid PRIMARY KEY NOT NULL,
                "username" varchar(255) NOT NULL,
                "password_hash" varchar(255) NOT NULL,
                "fullname" varchar(255) NOT NULL,
                "status" varchar(255) NOT NULL,
                "email" varchar(255),
                "avatar" varchar(255),
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL,
                CONSTRAINT "sys_user_username_unique" UNIQUE("username")
            );

            CREATE TABLE IF NOT EXISTS "sys_user_role" (
                "user_id" uuid NOT NULL,
                "role_id" uuid NOT NULL,
                CONSTRAINT "sys_user_role_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
            );

            CREATE TABLE IF NOT EXISTS "sys_option" (
                "id" uuid PRIMARY KEY NOT NULL,
                "code" varchar(255) NOT NULL,
                "name" varchar(255) NOT NULL,
                "value" varchar(255) NOT NULL,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL,
                CONSTRAINT "sys_option_code_unique" UNIQUE("code")
            );

            CREATE TABLE IF NOT EXISTS "sys_module_auth" (
                "id" uuid PRIMARY KEY NOT NULL,
                "module_id" varchar(255) NOT NULL,
                "module_name" varchar(255) NOT NULL,
                "is_enabled" boolean DEFAULT false NOT NULL,
                "enabled_at" timestamp,
                "enabled_by" varchar(255),
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            );
        `;

            // Execute table creation
            await tenantDb.execute(createTablesSQL);

            // Add foreign key constraints (using the tenant schema name)
            const addConstraintsSQL = `
            ALTER TABLE "sys_role_permission" 
            ADD CONSTRAINT "sys_role_permission_role_id_sys_role_id_fk" 
            FOREIGN KEY ("role_id") REFERENCES "${newTenantSchemaName}"."sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

            ALTER TABLE "sys_role_permission" 
            ADD CONSTRAINT "sys_role_permission_permission_id_sys_permission_id_fk" 
            FOREIGN KEY ("permission_id") REFERENCES "${newTenantSchemaName}"."sys_permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

            ALTER TABLE "sys_user_role" 
            ADD CONSTRAINT "sys_user_role_user_id_sys_user_id_fk" 
            FOREIGN KEY ("user_id") REFERENCES "${newTenantSchemaName}"."sys_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

            ALTER TABLE "sys_user_role" 
            ADD CONSTRAINT "sys_user_role_role_id_sys_role_id_fk" 
            FOREIGN KEY ("role_id") REFERENCES "${newTenantSchemaName}"."sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        `;

            // Execute constraint creation
            await tenantDb.execute(addConstraintsSQL);

            this.logger.info(
                `Created tables in tenant schema: ${newTenantSchemaName}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to create tenant schema ${tenantCode}: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    /**
     * Delete tenant schema
     */
    async deleteTenantSchema(tenantCode: string) {
        try {
            if (!this.sharedDrizzle) {
                await this.initializeSharedConnection();
            }
            if (!this.sharedDrizzle) {
                throw new Error("Shared Drizzle instance is not initialized");
            }

            // backup data using pg_dump from shell exec before dropping
            await this.backupTenantData(tenantCode);

            // close tenant connection if exists
            this.logger.info(
                `Closing connection for tenant before deleting schema: ${tenantCode}`,
            );
            await this.closeTenantConnection(tenantCode);

            const tenantSchemaName = this.getTenantSchemaName(tenantCode);
            this.logger.info(`Dropping schema: ${tenantSchemaName}`);

            // Drop the schema and all its objects
            await this.sharedDrizzle.execute(
                `DROP SCHEMA IF EXISTS "${tenantSchemaName}" CASCADE`,
            );

            this.logger.info(`Dropped tenant schema: ${tenantSchemaName}`);
        } catch (error) {
            this.logger.error(
                `Failed to delete tenant schema ${tenantCode}: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    /**
     * Backup tenant data using pg_dump
     */
    async backupTenantData(tenantCode: string) {
        const { exec } = await import("child_process");
        const fs = await import("fs");
        const path = await import("path");
        const util = await import("util");
        const execPromise = util.promisify(exec);

        const tenantSchemaName = this.getTenantSchemaName(tenantCode);
        const backupDir = path.resolve(__dirname, "../../../backups");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupFile = path.join(
            backupDir,
            `backup_${tenantSchemaName}_${timestamp}.sql`,
        );

        const databaseUrl = new URL(this.config.databaseUrl);
        const host = databaseUrl.hostname;
        const port = databaseUrl.port || "5432";
        const user = databaseUrl.username;
        const password = databaseUrl.password;
        const database = databaseUrl.pathname.slice(1); // remove leading '/'

        const command = `pg_dump --host=${host} --port=${port} --username=${user} --schema=${tenantSchemaName} --no-password --format=plain --file=${backupFile} ${database}`;

        this.logger.info(
            `Backing up tenant data for schema ${tenantSchemaName} to file ${backupFile}`,
        );

        try {
            // Set PGPASSWORD environment variable for authentication
            const env = { ...process.env, PGPASSWORD: password };

            await execPromise(command, { env });

            this.logger.info(
                `Backup completed for tenant schema ${tenantSchemaName}`,
            );
        } catch (error) {
            this.logger.error(
                `Backup failed for tenant schema ${tenantSchemaName}: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }
}

// Singleton instance
let connectionManagerInstance: TenantConnectionManager | null = null;

/**
 * Get singleton connection manager instance
 */
export function getConnectionManager(): TenantConnectionManager {
    if (!connectionManagerInstance) {
        connectionManagerInstance = new TenantConnectionManager();
    }
    return connectionManagerInstance;
}

/**
 * Create tenant context middleware
 */
export function createTenantMiddleware() {
    const manager = getConnectionManager();
    return manager.createTenantContextMiddleware();
}

/**
 * Utility function to execute operations in tenant context
 */
export async function withTenantContext(
    tenantCode: string,
    schema: any,
    operationFn: Function,
): Promise<any> {
    const manager = getConnectionManager();
    return manager.executeWithTenantDrizzle(tenantCode, schema, operationFn);
}

/**
 * Utility function to get tenant connection
 */
export async function getTenantDb(
    tenantCode: string,
    schema: any = {},
): Promise<
    PostgresJsDatabase<typeof tenantSchema> & { $client: postgres.Sql<{}> }
> {
    const manager = getConnectionManager();
    return manager.getTenantDrizzle(tenantCode, schema);
}

/**
 * Utility function to get shared connection
 */
export async function getSharedDb(): Promise<
    PostgresJsDatabase<typeof sharedSchema> & { $client: postgres.Sql<{}> }
> {
    const manager = getConnectionManager();
    return manager.initializeSharedConnection();
}

/**
 * Create a new tenant schema
 */
export async function createTenantSchema(tenantCode: string) {
    const manager = getConnectionManager();
    await manager.createTenantSchema(tenantCode);
}

/**
 * Delete a tenant schema
 */
export async function deleteTenantSchema(tenantCode: string) {
    const manager = getConnectionManager();
    await manager.deleteTenantSchema(tenantCode);
}

// Graceful shutdown handling
process.on("SIGINT", async () => {
    if (connectionManagerInstance) {
        console.log("\nShutting down database connections...");
        await connectionManagerInstance.closeAllConnections();
        process.exit(0);
    }
});

process.on("SIGTERM", async () => {
    if (connectionManagerInstance) {
        await connectionManagerInstance.closeAllConnections();
    }
});

export default TenantConnectionManager;
