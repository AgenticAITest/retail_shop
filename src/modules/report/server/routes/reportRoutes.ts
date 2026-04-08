import {
  posTransaction, posTransactionItem, posTransactionPayment,
  inventory, product, location, transfer, approvalLog, stockAlertConfig,
  goodsReceivedNote,
} from "@server/lib/db/schema/tenantSchema";
import { user } from "@server/lib/db/schema/system";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";

const reportRoutes = Router();
reportRoutes.use(resolveTenantContext());
reportRoutes.use(authenticated());
reportRoutes.use(checkModuleAuthorization('report'));

// ============================================================
// DASHBOARD KPIs
// ============================================================

reportRoutes.get("/dashboard/kpis", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });

  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Revenue today
    const [revToday] = await req.tenantDb.execute(sql`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM pos_transactions
      WHERE status = 'completed' AND completed_at >= ${today.toISOString()}
    `);

    // Revenue MTD
    const [revMtd] = await req.tenantDb.execute(sql`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM pos_transactions
      WHERE status = 'completed' AND completed_at >= ${monthStart.toISOString()}
    `);

    // Total inventory value
    const [invValue] = await req.tenantDb.execute(sql`
      SELECT COALESCE(SUM(i.qty_on_hand * CAST(p.base_cost_price AS NUMERIC)), 0) as total
      FROM inventory i JOIN products p ON i.product_id = p.id WHERE i.qty_on_hand > 0
    `);

    // Pending approvals
    const [pendingApprovals] = await req.tenantDb.execute(sql`
      SELECT COUNT(*) as total FROM approval_logs WHERE action = 'pending'
    `);

    // Active transfers
    const [activeTransfers] = await req.tenantDb.execute(sql`
      SELECT COUNT(*) as total FROM transfers WHERE status NOT IN ('closed', 'received')
    `);

    // Low-stock alerts
    const [lowStock] = await req.tenantDb.execute(sql`
      SELECT COUNT(*) as total FROM stock_alert_configs sac
      LEFT JOIN inventory i ON i.location_id = sac.location_id AND i.product_id = sac.product_id
      WHERE sac.is_active = true AND COALESCE(i.qty_on_hand, 0) <= sac.min_qty
    `);

    res.json({
      totalRevenueToday: Number(revToday.total),
      totalRevenueMTD: Number(revMtd.total),
      totalInventoryValue: Math.round(Number(invValue.total) * 100) / 100,
      pendingApprovals: Number(pendingApprovals.total),
      activeTransfers: Number(activeTransfers.total),
      lowStockAlerts: Number(lowStock.total),
    });
  } catch (error) { console.error("Error fetching KPIs:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// DASHBOARD REVENUE CHART (last 30 days)
// ============================================================

reportRoutes.get("/dashboard/revenue-chart", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });

  try {
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rows = await req.tenantDb.execute(sql`
      SELECT DATE(completed_at) as date, l.name as location_name,
        COALESCE(SUM(t.total_amount), 0) as revenue, COUNT(*) as transactions
      FROM pos_transactions t
      LEFT JOIN locations l ON t.location_id = l.id
      WHERE t.status = 'completed' AND t.completed_at >= ${thirtyDaysAgo.toISOString()}
      GROUP BY DATE(completed_at), l.name
      ORDER BY DATE(completed_at) ASC
    `);

    res.json({ chartData: rows });
  } catch (error) { console.error("Error fetching revenue chart:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// DASHBOARD RECENT ACTIVITY
// ============================================================

reportRoutes.get("/dashboard/activity", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });

  try {
    const recentTxns = await req.tenantDb.execute(sql`
      SELECT 'transaction' as type, t.transaction_id as ref, t.total_amount as amount,
        t.status, t.completed_at as date, l.name as location_name
      FROM pos_transactions t LEFT JOIN locations l ON t.location_id = l.id
      ORDER BY t.created_at DESC LIMIT 5
    `);

    const recentTransfers = await req.tenantDb.execute(sql`
      SELECT 'transfer' as type, tr.transfer_number as ref, NULL as amount,
        tr.status, tr.created_at as date, sl.name as location_name
      FROM transfers tr LEFT JOIN locations sl ON tr.source_location_id = sl.id
      ORDER BY tr.created_at DESC LIMIT 5
    `);

    const activity = [...recentTxns, ...recentTransfers]
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    res.json({ activity });
  } catch (error) { console.error("Error fetching activity:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// REVENUE BY SHOP
// ============================================================

reportRoutes.get("/revenue/by-shop", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;

  try {
    const since = new Date(); since.setDate(since.getDate() - days);

    const rows = await req.tenantDb.execute(sql`
      SELECT l.id as location_id, l.name as location_name,
        COALESCE(SUM(t.total_amount), 0) as revenue,
        COUNT(*) as transaction_count,
        COALESCE(AVG(t.total_amount), 0) as avg_basket
      FROM pos_transactions t
      JOIN locations l ON t.location_id = l.id
      WHERE t.status = 'completed' AND t.completed_at >= ${since.toISOString()}
      GROUP BY l.id, l.name ORDER BY revenue DESC
    `);

    res.json({ byShop: rows, period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// REVENUE BY PRODUCT (top sellers)
// ============================================================

reportRoutes.get("/revenue/by-product", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const limit = parseInt(req.query.limit as string) || 20;
  const days = parseInt(req.query.days as string) || 30;

  try {
    const since = new Date(); since.setDate(since.getDate() - days);

    const rows = await req.tenantDb.execute(sql`
      SELECT ti.product_id, ti.product_name, ti.sku_code,
        SUM(ti.quantity) as total_qty, SUM(CAST(ti.line_total AS NUMERIC)) as total_revenue
      FROM pos_transaction_items ti
      JOIN pos_transactions t ON ti.pos_transaction_id = t.id
      WHERE t.status = 'completed' AND t.completed_at >= ${since.toISOString()}
      GROUP BY ti.product_id, ti.product_name, ti.sku_code
      ORDER BY total_revenue DESC LIMIT ${limit}
    `);

    res.json({ byProduct: rows, period: `Last ${days} days`, limit });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// REVENUE TRENDS (daily)
// ============================================================

reportRoutes.get("/revenue/trends", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;

  try {
    const since = new Date(); since.setDate(since.getDate() - days);

    const rows = await req.tenantDb.execute(sql`
      SELECT DATE(completed_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as transactions
      FROM pos_transactions
      WHERE status = 'completed' AND completed_at >= ${since.toISOString()}
      GROUP BY DATE(completed_at) ORDER BY date ASC
    `);

    res.json({ trends: rows, period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// INVENTORY BY LOCATION
// ============================================================

reportRoutes.get("/inventory/by-location", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });

  try {
    const rows = await req.tenantDb.execute(sql`
      SELECT l.id as location_id, l.name as location_name,
        COALESCE(SUM(i.qty_on_hand), 0) as total_on_hand,
        COALESCE(SUM(i.in_transit), 0) as total_in_transit,
        COUNT(DISTINCT i.product_id) as product_count,
        COALESCE(SUM(i.qty_on_hand * CAST(p.base_cost_price AS NUMERIC)), 0) as total_value
      FROM locations l
      LEFT JOIN inventory i ON i.location_id = l.id
      LEFT JOIN products p ON i.product_id = p.id
      WHERE l.status = 'active'
      GROUP BY l.id, l.name ORDER BY total_value DESC
    `);

    res.json({ byLocation: rows });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// SLOW-MOVING STOCK
// ============================================================

reportRoutes.get("/inventory/slow-moving", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;

  try {
    const since = new Date(); since.setDate(since.getDate() - days);

    // Products with stock but no/few sales in the period
    const rows = await req.tenantDb.execute(sql`
      SELECT p.id as product_id, p.sku_code, p.name,
        COALESCE(SUM(i.qty_on_hand), 0) as total_stock,
        COALESCE(sales.total_sold, 0) as total_sold
      FROM products p
      JOIN inventory i ON i.product_id = p.id AND i.qty_on_hand > 0
      LEFT JOIN (
        SELECT ti.product_id, SUM(ti.quantity) as total_sold
        FROM pos_transaction_items ti
        JOIN pos_transactions t ON ti.pos_transaction_id = t.id
        WHERE t.status = 'completed' AND t.completed_at >= ${since.toISOString()}
        GROUP BY ti.product_id
      ) sales ON sales.product_id = p.id
      WHERE p.status = 'active'
      GROUP BY p.id, p.sku_code, p.name, sales.total_sold
      HAVING COALESCE(sales.total_sold, 0) = 0
      ORDER BY total_stock DESC
      LIMIT 50
    `);

    res.json({ slowMoving: rows, period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// POS REPORTS
// ============================================================

reportRoutes.get("/pos/shift-summary", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;
  try {
    const since = new Date(); since.setDate(since.getDate() - days);
    const rows = await req.tenantDb.execute(sql`
      SELECT s.id, s.opened_at, s.closed_at, s.opening_float, s.expected_cash, s.actual_cash, s.variance,
        l.name as location_name, u.fullname as cashier_name,
        COUNT(t.id) as transaction_count, COALESCE(SUM(t.total_amount), 0) as revenue
      FROM pos_shifts s LEFT JOIN locations l ON s.location_id = l.id LEFT JOIN sys_user u ON s.cashier_id = u.id
      LEFT JOIN pos_transactions t ON t.shift_id = s.id AND t.status = 'completed'
      WHERE s.opened_at >= ${since.toISOString()}
      GROUP BY s.id, s.opened_at, s.closed_at, s.opening_float, s.expected_cash, s.actual_cash, s.variance, l.name, u.fullname
      ORDER BY s.opened_at DESC
    `);
    res.json({ shifts: rows, period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

reportRoutes.get("/pos/payment-breakdown", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;
  try {
    const since = new Date(); since.setDate(since.getDate() - days);
    const rows = await req.tenantDb.execute(sql`
      SELECT p.payment_method, COUNT(*) as count, SUM(CAST(p.amount AS NUMERIC)) as total
      FROM pos_transaction_payments p JOIN pos_transactions t ON p.pos_transaction_id = t.id
      WHERE t.status = 'completed' AND t.completed_at >= ${since.toISOString()}
      GROUP BY p.payment_method ORDER BY total DESC
    `);
    res.json({ breakdown: rows, period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

reportRoutes.get("/pos/hourly", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;
  try {
    const since = new Date(); since.setDate(since.getDate() - days);
    const rows = await req.tenantDb.execute(sql`
      SELECT EXTRACT(HOUR FROM completed_at) as hour, COUNT(*) as transactions, COALESCE(SUM(total_amount), 0) as revenue
      FROM pos_transactions WHERE status = 'completed' AND completed_at >= ${since.toISOString()}
      GROUP BY EXTRACT(HOUR FROM completed_at) ORDER BY hour
    `);
    res.json({ hourly: rows, period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

reportRoutes.get("/pos/cashier-performance", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;
  try {
    const since = new Date(); since.setDate(since.getDate() - days);
    const rows = await req.tenantDb.execute(sql`
      SELECT u.id as cashier_id, u.fullname as cashier_name, COUNT(t.id) as transactions,
        COALESCE(SUM(t.total_amount), 0) as revenue, COALESCE(AVG(t.total_amount), 0) as avg_basket
      FROM pos_transactions t JOIN sys_user u ON t.cashier_id = u.id
      WHERE t.status = 'completed' AND t.completed_at >= ${since.toISOString()}
      GROUP BY u.id, u.fullname ORDER BY revenue DESC
    `);
    res.json({ cashiers: rows, period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

reportRoutes.get("/pos/voids", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;
  try {
    const since = new Date(); since.setDate(since.getDate() - days);
    const rows = await req.tenantDb.execute(sql`
      SELECT t.transaction_id, t.total_amount, t.void_reason, t.voided_at,
        l.name as location_name, u.fullname as voided_by_name
      FROM pos_transactions t LEFT JOIN locations l ON t.location_id = l.id LEFT JOIN sys_user u ON t.voided_by = u.id
      WHERE t.status = 'voided' AND t.voided_at >= ${since.toISOString()}
      ORDER BY t.voided_at DESC
    `);
    res.json({ voids: rows, period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// TAX REPORTS
// ============================================================

reportRoutes.get("/tax/summary", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;
  try {
    const since = new Date(); since.setDate(since.getDate() - days);
    const [result] = await req.tenantDb.execute(sql`
      SELECT COALESCE(SUM(CAST(tax_amount AS NUMERIC)), 0) as total_ppn,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as total_revenue, COUNT(*) as transaction_count
      FROM pos_transactions WHERE status = 'completed' AND completed_at >= ${since.toISOString()}
    `);
    res.json({ totalPPN: Number(result.total_ppn), totalRevenue: Number(result.total_revenue), transactionCount: Number(result.transaction_count), period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

reportRoutes.get("/tax/by-location", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;
  try {
    const since = new Date(); since.setDate(since.getDate() - days);
    const rows = await req.tenantDb.execute(sql`
      SELECT l.name as location_name, COALESCE(SUM(CAST(t.tax_amount AS NUMERIC)), 0) as ppn, COALESCE(SUM(CAST(t.total_amount AS NUMERIC)), 0) as revenue
      FROM pos_transactions t JOIN locations l ON t.location_id = l.id
      WHERE t.status = 'completed' AND t.completed_at >= ${since.toISOString()}
      GROUP BY l.name ORDER BY ppn DESC
    `);
    res.json({ byLocation: rows, period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

reportRoutes.get("/tax/by-category", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const days = parseInt(req.query.days as string) || 30;
  try {
    const since = new Date(); since.setDate(since.getDate() - days);
    const rows = await req.tenantDb.execute(sql`
      SELECT COALESCE(c.name, 'Uncategorized') as category_name,
        COALESCE(SUM(CAST(ti.tax_amount AS NUMERIC)), 0) as ppn, COALESCE(SUM(CAST(ti.line_total AS NUMERIC)), 0) as revenue
      FROM pos_transaction_items ti JOIN pos_transactions t ON ti.pos_transaction_id = t.id
      LEFT JOIN products p ON ti.product_id = p.id LEFT JOIN categories c ON p.category_id = c.id
      WHERE t.status = 'completed' AND t.completed_at >= ${since.toISOString()}
      GROUP BY c.name ORDER BY ppn DESC
    `);
    res.json({ byCategory: rows, period: `Last ${days} days` });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// PROCUREMENT REPORTS
// ============================================================

reportRoutes.get("/procurement/po-summary", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  try {
    const rows = await req.tenantDb.execute(sql`
      SELECT status, COUNT(*) as count, COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as total_value
      FROM purchase_orders GROUP BY status ORDER BY count DESC
    `);
    res.json({ poSummary: rows });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

reportRoutes.get("/procurement/supplier-scorecard", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  try {
    const rows = await req.tenantDb.execute(sql`
      SELECT s.id as supplier_id, s.name as supplier_name, COUNT(DISTINCT po.id) as total_pos,
        COUNT(DISTINCT CASE WHEN po.status IN ('fully_received','closed') THEN po.id END) as completed_pos,
        COUNT(DISTINCT sr.id) as total_returns
      FROM suppliers s LEFT JOIN purchase_orders po ON po.supplier_id = s.id
      LEFT JOIN supplier_returns sr ON sr.supplier_id = s.id
      WHERE s.status = 'active' GROUP BY s.id, s.name ORDER BY total_pos DESC
    `);
    res.json({ scorecard: rows });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

reportRoutes.get("/procurement/grn-timeliness", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  try {
    const rows = await req.tenantDb.execute(sql`
      SELECT s.name as supplier_name, COUNT(g.id) as grn_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (g.received_date - po.order_date)) / 86400)) as avg_days
      FROM goods_received_notes g JOIN purchase_orders po ON g.purchase_order_id = po.id
      JOIN suppliers s ON po.supplier_id = s.id GROUP BY s.name ORDER BY avg_days ASC
    `);
    res.json({ timeliness: rows });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// TRANSFER REPORTS
// ============================================================

reportRoutes.get("/transfer/volume", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  try {
    const rows = await req.tenantDb.execute(sql`
      SELECT sl.name as source_name, dl.name as dest_name, COUNT(*) as transfer_count,
        COALESCE(SUM(ti.requested_qty), 0) as total_qty
      FROM transfers t JOIN locations sl ON t.source_location_id = sl.id JOIN locations dl ON t.dest_location_id = dl.id
      LEFT JOIN transfer_items ti ON ti.transfer_id = t.id
      GROUP BY sl.name, dl.name ORDER BY transfer_count DESC
    `);
    res.json({ volume: rows });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

reportRoutes.get("/transfer/discrepancy", authorized("ADMIN", "retail.report.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  try {
    const rows = await req.tenantDb.execute(sql`
      SELECT ti.product_name, ti.sku_code, COUNT(*) as line_count,
        SUM(ABS(ti.discrepancy_qty)) as total_discrepancy,
        SUM(CASE WHEN ti.discrepancy_reason = 'short' THEN ABS(ti.discrepancy_qty) ELSE 0 END) as short_qty,
        SUM(CASE WHEN ti.discrepancy_reason = 'damaged' THEN ABS(ti.discrepancy_qty) ELSE 0 END) as damaged_qty
      FROM transfer_items ti WHERE ti.discrepancy_qty != 0
      GROUP BY ti.product_name, ti.sku_code ORDER BY total_discrepancy DESC
    `);
    res.json({ discrepancies: rows });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Internal server error" }); }
});

export default reportRoutes;
