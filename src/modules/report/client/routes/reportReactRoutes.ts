import { RouteObject } from 'react-router';
import ReportDashboard from '../pages/Dashboard';
import RevenueReport from '../pages/RevenueReport';
import InventoryReport from '../pages/InventoryReport';
import PosReport from '../pages/PosReport';
import TaxReport from '../pages/TaxReport';
import ProcurementReport from '../pages/ProcurementReport';
import TransferReport from '../pages/TransferReport';
import ScheduledReports from '../pages/ScheduledReports';

export const reportReactRoutes = (basePath: string): RouteObject => ({
  path: basePath,
  children: [
    { path: "dashboard", Component: ReportDashboard },
    { path: "revenue", Component: RevenueReport },
    { path: "inventory", Component: InventoryReport },
    { path: "pos", Component: PosReport },
    { path: "tax", Component: TaxReport },
    { path: "procurement", Component: ProcurementReport },
    { path: "transfer", Component: TransferReport },
    { path: "schedules", Component: ScheduledReports },
  ],
});
