import { Truck } from 'lucide-react';

export const supplierManagementSidebarMenus = {
  id: 'supplier-management',
  title: 'Suppliers',
  url: '/console/modules/supplier-management',
  icon: Truck,
  roles: 'ADMIN',
  permissions: ['retail.supplier.view'],
  items: [
    {
      id: "supplier",
      title: "Supplier Directory",
      url: "/console/modules/supplier-management/supplier",
      roles: "ADMIN",
      permissions: "retail.supplier.view",
    },
    {
      id: "import",
      title: "Import / Export",
      url: "/console/modules/supplier-management/supplier/import",
      roles: "ADMIN",
      permissions: "retail.supplier.create",
    },
  ],
};
