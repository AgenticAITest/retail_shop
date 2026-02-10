import { Request, Response, NextFunction } from 'express';
import { apiKey as apiKeyTable, partner, type ApiKey } from '../lib/db/schemas/integration';
import { eq, and } from 'drizzle-orm';
import { getSharedDb, getTenantDb } from '@server/lib/db/tenant-connection-manager';
import * as sharedSchema from "@server/lib/db/schema/sharedSchema";
import * as tenantSchema from "@server/lib/db/schema/tenantSchema";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Extend Request interface to include partner info
declare global {
  namespace Express {
    interface Request {
      partner?: {
        id: string;
        code: string;
        name: string;
        picName: string;
        picEmail: string;
        description?: string;
        status: string;
        tenantId: string;
        createdAt: string;
        updatedAt: string;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using inbound API keys
 * Validates the API key and attaches partner info to the request
 */
export async function apiKeyMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    // Extract API key from header
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || typeof apiKey !== 'string') {
      res.status(401).json({ 
        success: false, 
        message: 'API key required in x-api-key header' 
      });
      return;
    }

    // Find the API key record in all tenants apiKey tables
    const sharedDb = await getSharedDb();
    const tenants = await sharedDb
      .select()
      .from(sharedSchema.tenant);

    // iterate through tenants to find the api key
    let db: PostgresJsDatabase<typeof tenantSchema> & { $client: postgres.Sql<{}> } | null = null;
    let keyRecords : ApiKey[] = [];
    let tenant : sharedSchema.Tenant | null = null;
    for (const t of tenants) {
      tenant = t;
      const tenantDb = await getTenantDb(tenant.code, tenantSchema);
      keyRecords = await tenantDb
        .select()
        .from(apiKeyTable)
        .where(eq(apiKeyTable.apiKey, apiKey))  
        .limit(1);

      if (keyRecords.length) {
        db = tenantDb;
        break;
      }
    }

    if (!db || !tenant) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid API key' 
      });
      return;
    }

    if (!keyRecords.length) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid API key' 
      });
      return;
    }

    const keyRecord = keyRecords[0];

    // Check if API key is active
    if (keyRecord.status !== 'active') {
      res.status(401).json({ 
        success: false, 
        message: 'API key is inactive' 
      });
      return;
    }

    // Get associated partner info
    const partnerRecords = await db
      .select()
      .from(partner)
      .where(eq(partner.id, keyRecord.partnerId))
      .limit(1);

    if (!partnerRecords.length) {
      res.status(401).json({ 
        success: false, 
        message: 'Partner not found or access denied' 
      });
      return;
    }

    const partnerRecord = partnerRecords[0];

    // Check if partner is active
    if (partnerRecord.status !== 'active') {
      res.status(401).json({ 
        success: false, 
        message: 'Partner account is inactive' 
      });
      return;
    }

    // Attach partner info to request for use in route handlers
    req.partner = {
      id: partnerRecord.id,
      code: partnerRecord.code,
      name: partnerRecord.name,
      picName: partnerRecord.picName,
      picEmail: partnerRecord.picEmail,
      description: partnerRecord.description || undefined,
      status: partnerRecord.status,
      tenantId: tenant.id,
      createdAt: partnerRecord.createdAt.toISOString(),
      updatedAt: partnerRecord.updatedAt.toISOString(),
    };

    req.tenantCode = tenant.code;
    req.tenantDb = db;
    req.tenantInfo = {
      id: tenant.id,
      code: tenant.code,
      name: tenant.name
    };

    next();
  } catch (error) {
    console.error('Error in integrationApiKeyMiddleware:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error during authentication' 
    });
  }
}