import { Warehouse } from 'lucide-react';

export const inventoryMgmtSidebarMenus = {
  id: 'inventory-management',
  title: 'Inventory',
  url: '/console/modules/inventory-management',
  icon: Warehouse,
  roles: 'ADMIN',
  permissions: ['retail.inventory.view'],
  items: [
    { id: "inv-counts", title: "Stock Counts", url: "/console/modules/inventory-management/stock-count", roles: "ADMIN", permissions: "retail.inventory.count" },
    { id: "inv-adjustments", title: "Adjustments", url: "/console/modules/inventory-management/adjustment", roles: "ADMIN", permissions: "retail.inventory.adjust" },
    { id: "inv-movements", title: "Movement Ledger", url: "/console/modules/inventory-management/movement", roles: "ADMIN", permissions: "retail.inventory.view" },
    { id: "inv-alerts", title: "Low-Stock Alerts", url: "/console/modules/inventory-management/alerts", roles: "ADMIN", permissions: "retail.inventory.alerts" },
    { id: "inv-consolidated", title: "Consolidated View", url: "/console/modules/inventory-management/consolidated", roles: "ADMIN", permissions: "retail.inventory.view" },
    { id: "inv-valuation", title: "Valuation", url: "/console/modules/inventory-management/valuation", roles: "ADMIN", permissions: "retail.inventory.view" },
  ],
};
