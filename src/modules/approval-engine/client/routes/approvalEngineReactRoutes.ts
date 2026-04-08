import { RouteObject } from 'react-router';
import ApprovalConfig from '../pages/config/ApprovalConfig';
import PendingApprovals from '../pages/pending/PendingApprovals';
import ApprovalHistory from '../pages/history/ApprovalHistory';
import AuditLog from '../pages/audit/AuditLog';

export const approvalEngineReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "config",
        children: [{ index: true, Component: ApprovalConfig }],
      },
      {
        path: "pending",
        children: [{ index: true, Component: PendingApprovals }],
      },
      {
        path: "history",
        children: [{ index: true, Component: ApprovalHistory }],
      },
      {
        path: "audit-log",
        children: [{ index: true, Component: AuditLog }],
      },
    ],
  };
};
