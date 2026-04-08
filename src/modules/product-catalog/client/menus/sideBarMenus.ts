import { Package } from 'lucide-react';

export const productCatalogSidebarMenus = {
  id: 'product-catalog',
  title: 'Products',
  url: '/console/modules/product-catalog',
  icon: Package,
  roles: 'ADMIN',
  permissions: ['retail.product.view'],
  items: [
    {
      id: "product",
      title: "Product Catalog",
      url: "/console/modules/product-catalog/product",
      roles: "ADMIN",
      permissions: "retail.product.view",
    },
    {
      id: "category",
      title: "Categories",
      url: "/console/modules/product-catalog/category",
      roles: "ADMIN",
      permissions: "retail.product.view",
    },
    {
      id: "import-export",
      title: "Import / Export",
      url: "/console/modules/product-catalog/product/import",
      roles: "ADMIN",
      permissions: "retail.product.import",
    },
  ],
};
