import { BarChart3 } from 'lucide-react';

export const reportSidebarMenus = {
  id: 'report',
  title: 'Reports',
  url: '/console/modules/report',
  icon: BarChart3,
  roles: ['ADMIN', 'MANAGER'],
  permissions: ['retail.report.view'],
  items: [
    { id: "rpt-dashboard", title: "Dashboard", url: "/console/modules/report/dashboard", roles: ['ADMIN', 'MANAGER'], permissions: "retail.report.view" },
    { id: "rpt-revenue", title: "Revenue Report", url: "/console/modules/report/revenue", roles: ['ADMIN', 'MANAGER'], permissions: "retail.report.view" },
    { id: "rpt-inventory", title: "Inventory Report", url: "/console/modules/report/inventory", roles: ['ADMIN', 'MANAGER'], permissions: "retail.report.view" },
    { id: "rpt-pos", title: "POS Report", url: "/console/modules/report/pos", roles: ['ADMIN', 'MANAGER'], permissions: "retail.report.view" },
    { id: "rpt-tax", title: "Tax (PPN) Report", url: "/console/modules/report/tax", roles: ['ADMIN', 'MANAGER'], permissions: "retail.report.view" },
    { id: "rpt-procurement", title: "Procurement Report", url: "/console/modules/report/procurement", roles: ['ADMIN', 'MANAGER'], permissions: "retail.report.view" },
    { id: "rpt-transfer", title: "Transfer Report", url: "/console/modules/report/transfer", roles: ['ADMIN', 'MANAGER'], permissions: "retail.report.view" },
    { id: "rpt-schedules", title: "Scheduled Reports", url: "/console/modules/report/schedules", roles: ['ADMIN'], permissions: "retail.report.schedule" },
  ],
};
