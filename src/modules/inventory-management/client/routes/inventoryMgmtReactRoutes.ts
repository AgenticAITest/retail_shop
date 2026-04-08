import { RouteObject } from 'react-router';
import StockCountList from '../pages/stock-count/StockCountList';
import StockCountSession from '../pages/stock-count/StockCountSession';
import AdjustmentList from '../pages/adjustment/AdjustmentList';
import MovementLedger from '../pages/movement/MovementLedger';
import AlertConfig from '../pages/alerts/AlertConfig';
import ConsolidatedInventory from '../pages/consolidated/ConsolidatedInventory';
import ValuationSummary from '../pages/consolidated/ValuationSummary';

export const inventoryMgmtReactRoutes = (basePath: string): RouteObject => ({
  path: basePath,
  children: [
    { path: "stock-count", children: [
      { index: true, Component: StockCountList },
      { path: ":id", Component: StockCountSession },
    ]},
    { path: "adjustment", Component: AdjustmentList },
    { path: "movement", Component: MovementLedger },
    { path: "alerts", Component: AlertConfig },
    { path: "consolidated", Component: ConsolidatedInventory },
    { path: "valuation", Component: ValuationSummary },
  ],
});
