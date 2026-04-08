import { ArrowRightLeft } from 'lucide-react';

export const transferSidebarMenus = {
  id: 'transfer',
  title: 'Transfers',
  url: '/console/modules/transfer',
  icon: ArrowRightLeft,
  roles: 'ADMIN',
  permissions: ['retail.transfer.view'],
  items: [
    {
      id: "transfer-list",
      title: "Transfer List",
      url: "/console/modules/transfer/transfer",
      roles: "ADMIN",
      permissions: "retail.transfer.view",
    },
    {
      id: "transfer-create",
      title: "New Transfer",
      url: "/console/modules/transfer/transfer/add",
      roles: "ADMIN",
      permissions: "retail.transfer.create",
    },
  ],
};
