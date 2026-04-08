import { ShieldCheck } from 'lucide-react';

export const approvalEngineSidebarMenus = {
  id: 'approval-engine',
  title: 'Approvals',
  url: '/console/modules/approval-engine',
  icon: ShieldCheck,
  roles: 'ADMIN',
  permissions: ['retail.approval.view'],
  items: [
    {
      id: "config",
      title: "Approval Config",
      url: "/console/modules/approval-engine/config",
      roles: "ADMIN",
      permissions: "retail.approval.manage",
    },
    {
      id: "pending",
      title: "Pending Approvals",
      url: "/console/modules/approval-engine/pending",
      roles: "ADMIN",
      permissions: "retail.approval.action",
    },
    {
      id: "history",
      title: "Approval History",
      url: "/console/modules/approval-engine/history",
      roles: "ADMIN",
      permissions: "retail.approval.view",
    },
    {
      id: "audit-log",
      title: "Audit Log",
      url: "/console/modules/approval-engine/audit-log",
      roles: "ADMIN",
      permissions: "retail.approval.view",
    },
  ],
};
