import { ShoppingCart } from 'lucide-react';

export const posSidebarMenus = {
  id: 'pos',
  title: 'Point of Sale',
  url: '/console/modules/pos',
  icon: ShoppingCart,
  roles: ['ADMIN', 'MANAGER'],
  permissions: ['pos.transaction.view'],
  items: [
    {
      id: "pos-terminal",
      title: "Open POS",
      url: "/pos",
      roles: ['ADMIN', 'MANAGER'],
      permissions: "pos.sale.create",
    },
    {
      id: "pos-transactions",
      title: "Transaction History",
      url: "/console/modules/pos/transaction",
      roles: ['ADMIN', 'MANAGER'],
      permissions: "pos.transaction.view",
    },
    {
      id: "pos-shifts",
      title: "Shift History",
      url: "/console/modules/pos/shift",
      roles: ['ADMIN', 'MANAGER'],
      permissions: "pos.transaction.view",
    },
  ],
};
