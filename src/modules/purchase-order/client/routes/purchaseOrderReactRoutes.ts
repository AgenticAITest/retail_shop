import { RouteObject } from 'react-router';
import PurchaseOrder from '../pages/po/PurchaseOrder';
import PurchaseOrderAdd from '../pages/po/PurchaseOrderAdd';
import PurchaseOrderEdit from '../pages/po/PurchaseOrderEdit';
import PurchaseOrderView from '../pages/po/PurchaseOrderView';
import ReorderSuggestions from '../pages/suggestions/ReorderSuggestions';

export const purchaseOrderReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "po",
        children: [
          { index: true, Component: PurchaseOrder },
          { path: "add", Component: PurchaseOrderAdd },
          { path: ":id", Component: PurchaseOrderView },
          { path: ":id/edit", Component: PurchaseOrderEdit },
        ]
      },
      {
        path: "suggestions",
        Component: ReorderSuggestions,
      },
    ]
  };
};
