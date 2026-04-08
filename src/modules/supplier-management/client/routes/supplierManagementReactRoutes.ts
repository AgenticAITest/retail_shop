import { RouteObject } from 'react-router';
import Supplier from '../pages/supplier/Supplier';
import SupplierAdd from '../pages/supplier/SupplierAdd';
import SupplierEdit from '../pages/supplier/SupplierEdit';
import SupplierView from '../pages/supplier/SupplierView';
import SupplierImport from '../pages/import/SupplierImport';

export const supplierManagementReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "supplier",
        children: [
          { index: true, Component: Supplier },
          { path: "add", Component: SupplierAdd },
          { path: "import", Component: SupplierImport },
          { path: ":id", Component: SupplierView },
          { path: ":id/edit", Component: SupplierEdit },
        ]
      },
    ]
  };
};
