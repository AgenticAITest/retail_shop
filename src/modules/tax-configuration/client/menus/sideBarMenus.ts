import { Receipt } from 'lucide-react';

export const taxConfigurationSidebarMenus = {
  id: 'tax-configuration',
  title: 'Tax Config',
  url: '/console/modules/tax-configuration',
  icon: Receipt,
  roles: 'ADMIN',
  permissions: ['retail.tax.view'],
  items: [
    {
      id: "config",
      title: "PPN Configuration",
      url: "/console/modules/tax-configuration/config",
      roles: "ADMIN",
      permissions: "retail.tax.view",
    },
  ],
};
