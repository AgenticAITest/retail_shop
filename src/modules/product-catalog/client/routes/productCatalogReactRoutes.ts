import { RouteObject } from 'react-router';
import Product from '../pages/product/Product';
import ProductAdd from '../pages/product/ProductAdd';
import ProductEdit from '../pages/product/ProductEdit';
import ProductView from '../pages/product/ProductView';
import ProductImport from '../pages/import/ProductImport';
import Category from '../pages/category/Category';
import CategoryAdd from '../pages/category/CategoryAdd';
import CategoryEdit from '../pages/category/CategoryEdit';
import CategoryView from '../pages/category/CategoryView';

export const productCatalogReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "product",
        children: [
          { index: true, Component: Product },
          { path: "add", Component: ProductAdd },
          { path: "import", Component: ProductImport },
          { path: ":id", Component: ProductView },
          { path: ":id/edit", Component: ProductEdit },
        ]
      },
      {
        path: "category",
        children: [
          { index: true, Component: Category },
          { path: "add", Component: CategoryAdd },
          { path: ":id", Component: CategoryView },
          { path: ":id/edit", Component: CategoryEdit },
        ]
      },
    ]
  };
};
