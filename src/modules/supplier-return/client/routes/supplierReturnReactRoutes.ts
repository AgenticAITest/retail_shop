import { RouteObject } from 'react-router';
import SupplierReturn from '../pages/supplier-return/SupplierReturn';
import SupplierReturnAdd from '../pages/supplier-return/SupplierReturnAdd';
import SupplierReturnView from '../pages/supplier-return/SupplierReturnView';
import CreditNoteList from '../pages/supplier-return/CreditNoteList';

export const supplierReturnReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "return",
        children: [
          { index: true, Component: SupplierReturn },
          { path: "add", Component: SupplierReturnAdd },
          { path: ":id", Component: SupplierReturnView },
        ]
      },
      {
        path: "credit-note",
        children: [
          { index: true, Component: CreditNoteList },
        ]
      },
    ]
  };
};
