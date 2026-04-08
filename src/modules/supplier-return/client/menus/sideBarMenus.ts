import { Undo2 } from 'lucide-react';

export const supplierReturnSidebarMenus = {
  id: 'supplier-return',
  title: 'Supplier Returns',
  url: '/console/modules/supplier-return',
  icon: Undo2,
  roles: 'ADMIN',
  permissions: ['retail.supplier-return.view'],
  items: [
    {
      id: "sr-list",
      title: "Returns List",
      url: "/console/modules/supplier-return/return",
      roles: "ADMIN",
      permissions: "retail.supplier-return.view",
    },
    {
      id: "sr-create",
      title: "New Return",
      url: "/console/modules/supplier-return/return/add",
      roles: "ADMIN",
      permissions: "retail.supplier-return.create",
    },
    {
      id: "cn-list",
      title: "Credit Notes",
      url: "/console/modules/supplier-return/credit-note",
      roles: "ADMIN",
      permissions: "retail.supplier-return.view",
    },
  ],
};
