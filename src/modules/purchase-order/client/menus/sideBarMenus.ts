import { ClipboardList } from 'lucide-react';

export const purchaseOrderSidebarMenus = {
  id: 'purchase-order',
  title: 'Purchase Orders',
  url: '/console/modules/purchase-order',
  icon: ClipboardList,
  roles: 'ADMIN',
  permissions: ['retail.po.view'],
  items: [
    {
      id: "po-list",
      title: "PO List",
      url: "/console/modules/purchase-order/po",
      roles: "ADMIN",
      permissions: "retail.po.view",
    },
    {
      id: "po-create",
      title: "Create PO",
      url: "/console/modules/purchase-order/po/add",
      roles: "ADMIN",
      permissions: "retail.po.create",
    },
    {
      id: "reorder-suggestions",
      title: "Reorder Suggestions",
      url: "/console/modules/purchase-order/suggestions",
      roles: "ADMIN",
      permissions: "retail.po.view",
    },
  ],
};
