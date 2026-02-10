import axios from 'axios';
import { eq, and } from 'drizzle-orm';
import * as tenantSchema  from '@server/lib/db/schema/tenantSchema';
import { webhook, event as webhookEvent } from '../db/schemas/integration';
import { getTenantDb } from '@server/lib/db/tenant-connection-manager';
import { decodeBase64 } from 'bcryptjs';

export interface WebhookPayload {
  eventType: string;
  timestamp: string;
  tenantCode: string;
  data: any;
}

/**
 * Dispatch webhooks for a specific event type and tenant
 * @param eventType - The type of event that occurred (e.g., 'user.created', 'order.completed')
 * @param tenantCode - The tenant ID for multitenancy
 * @param payload - The event data to send to webhooks
 */
export async function dispatchWebhooks(eventType: string, tenantCode: string, payload: any): Promise<void> {
  try {
    console.log(`[WEBHOOK DISPATCHER] Dispatching webhooks for event: ${eventType} in tenant: ${tenantCode}`);
    console.log(`[WEBHOOK PAYLOAD] Event data:`, JSON.stringify(payload, null, 2));

    const tenantDb = await getTenantDb(tenantCode, tenantSchema);
    if (!tenantDb) {
      throw new Error(`Tenant database connection not found for tenant ID: ${tenantCode}`);
    }
    
    // Find all active webhooks for this event type and tenant
    const activeWebhooks = await tenantDb
      .select()
      .from(webhook)
      .where(
        and(
          eq(webhook.eventType, eventType),
          eq(webhook.isActive, true)
        )
      );

    if (activeWebhooks.length === 0) {
      console.log(`[WEBHOOK DISPATCHER] No active webhooks found for event ${eventType} in tenant ${tenantCode}`);
      return;
    }

    console.log(`[WEBHOOK DISPATCHER] Found ${activeWebhooks.length} active webhooks for event ${eventType}:`);
    activeWebhooks.forEach((wh, index) => {
      console.log(`   ${index + 1}. ${wh.url} (ID: ${wh.id})`);
    });

    // Prepare the webhook payload
    const webhookPayload: WebhookPayload = {
      eventType,
      timestamp: new Date().toISOString(),
      tenantCode: tenantCode,
      data: payload,
    };

    // Dispatch to each webhook endpoint
    console.log(`📡 [WEBHOOK DELIVERY] Starting delivery to ${activeWebhooks.length} endpoints...`);
    
    const dispatchPromises = activeWebhooks.map(async (webhookConfig, index) => {
      const webhookNumber = index + 1;
      console.log(`🔄 [WEBHOOK ${webhookNumber}] Delivering to: ${webhookConfig.url}`);
      
      try {
        const startTime = Date.now();
        const response = await axios.post(webhookConfig.url, webhookPayload, {
          timeout: 5000, // 5 second timeout
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Integration-Webhook-Dispatcher/1.0',
          },
        });

        const duration = Date.now() - startTime;
        console.log(`✅ [WEBHOOK ${webhookNumber}] SUCCESS - ${webhookConfig.url}`);
        console.log(`   Response: ${response.status} ${response.statusText} (${duration}ms)`);
        console.log(`   Webhook ID: ${webhookConfig.id}`);
        
        // TODO: Log successful delivery to database for monitoring
        return {
          webhookId: webhookConfig.id,
          url: webhookConfig.url,
          status: 'success',
          responseStatus: response.status,
          duration,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const duration = Date.now() - Date.now();
        console.error(`[WEBHOOK ${webhookNumber}] FAILED - ${webhookConfig.url}`);
        
        if (axios.isAxiosError(error)) {
          if (error.response) {
            console.error(`   Server responded with: ${error.response.status} ${error.response.statusText}`);
            console.error(`   Response data:`, error.response.data);
          } else if (error.request) {
            console.error(`   No response received - Network/timeout error`);
            console.error(`   Error code: ${error.code}`);
          } else {
            console.error(`   Request setup error: ${error.message}`);
          }
        } else {
          console.error(`   Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        console.error(`   Webhook ID: ${webhookConfig.id}`);
        
        // TODO: Log failed delivery to database for monitoring and potential retry
        return {
          webhookId: webhookConfig.id,
          url: webhookConfig.url,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
          timestamp: new Date().toISOString(),
        };
      }
    });

    // Wait for all webhook deliveries to complete
    const results = await Promise.allSettled(dispatchPromises);
    
    // Log detailed summary
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`[WEBHOOK DISPATCHER] Delivery completed for event: ${eventType}`);
    console.log(`[WEBHOOK SUMMARY] Results: ${successful} successful, ${failed} failed`);
    
    // Log individual results for debugging
    results.forEach((result, index) => {
      const webhookNumber = index + 1;
      if (result.status === 'fulfilled') {
        const data = result.value;
        console.log(`   ${webhookNumber}. ${data.url} - ${data.status} (${data.duration || 0}ms)`);
      } else {
        console.log(`   ${webhookNumber}. ${activeWebhooks[index].url} - ${result.reason}`);
      }
    });
    
  } catch (error) {
    console.error(`[WEBHOOK DISPATCHER] Fatal error in webhook dispatcher:`, error);
    throw error;
  }
}

/**
 * Convenience functions for common event types
 */

export async function dispatchUserCreatedEvent(tenantCode: string, userData: any): Promise<void> {
  return dispatchWebhooks('user.created', tenantCode, userData);
}

export async function dispatchUserUpdatedEvent(tenantCode: string, userData: any): Promise<void> {
  return dispatchWebhooks('user.updated', tenantCode, userData);
}

export async function dispatchPartnerCreatedEvent(tenantCode: string, partnerData: any): Promise<void> {
  return dispatchWebhooks('partner.created', tenantCode, partnerData);
}

export async function dispatchPartnerUpdatedEvent(tenantCode: string, partnerData: any): Promise<void> {
  return dispatchWebhooks('partner.updated', tenantCode, partnerData);
}

export async function dispatchIntegrationKeyCreatedEvent(tenantCode: string, keyData: any): Promise<void> {
  return dispatchWebhooks('integration.key.created', tenantCode, keyData);
}

/**
 * Get list of available event types for a specific tenant
 * @param tenantId - The tenant ID to get event types for
 * @returns Promise<string[]> - Array of active event type names
 */
export async function getAvailableEventTypes(tenantId: string): Promise<string[]> {
  const tenantDb = await getTenantDb(tenantId, tenantSchema);
  if (!tenantDb) {
    throw new Error(`Tenant database connection not found for tenant ID: ${tenantId}`);
  }

  try {
    const events = await tenantDb
      .select({ name: webhookEvent.name })
      .from(webhookEvent)
      .where(and(
        eq(webhookEvent.isActive, true)
      ));
    
    return events.map(e => e.name);
  } catch (error) {
    console.error('Error fetching available event types:', error);
    
    // Fallback to default event types if database query fails
    console.log('[WEBHOOK DISPATCHER] Falling back to default event types due to database error');
    return [
      'user.created',
      'user.updated',
      'user.deleted',
      'partner.created',
      'partner.updated',
      'partner.deleted',
      'integration.key.created',
      'integration.key.updated',
      'integration.key.deleted',
    ];
  }
}

/**
 * Get all event types (including inactive) for a specific tenant
 * @param tenantCode - The tenant ID to get event types for
 * @returns Promise<WebhookEvent[]> - Array of all webhook events
 */
export async function getAllEventTypes(tenantCode: string) {

  const tenantDb = await getTenantDb(tenantCode, tenantSchema);
  if (!tenantDb) {
    throw new Error(`Tenant database connection not found for tenant ID: ${tenantCode}`);
  }
  
  try {
    const events = await tenantDb
      .select()
      .from(webhookEvent);
    
    return events;
  } catch (error) {
    console.error('Error fetching all event types:', error);
    return [];
  }
}