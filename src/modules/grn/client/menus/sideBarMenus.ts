import { PackageCheck } from 'lucide-react';

export const grnSidebarMenus = {
  id: 'grn',
  title: 'Goods Receiving',
  url: '/console/modules/grn',
  icon: PackageCheck,
  roles: 'ADMIN',
  permissions: ['retail.grn.view'],
  items: [
    {
      id: "grn-list",
      title: "GRN List",
      url: "/console/modules/grn/grn",
      roles: "ADMIN",
      permissions: "retail.grn.view",
    },
    {
      id: "grn-create",
      title: "Receive Goods",
      url: "/console/modules/grn/grn/add",
      roles: "ADMIN",
      permissions: "retail.grn.create",
    },
  ],
};
