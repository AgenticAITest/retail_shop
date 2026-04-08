import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs
} from "@client/components/console/Breadcrumbs";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";
import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import ProductForm from "./ProductForm";
import { productFormSchema } from "./productFormSchema";

const ProductAdd = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs, updateItem } = useBreadcrumbs(
    createBreadcrumbItems([
      {
        label: "Products",
        onClick: () => navigate("/console/modules/product-catalog/product"),
      },
      {
        label: "Add Product",
      },
    ])
  );

  const form = useForm({
    resolver: zodResolver(productFormSchema as any),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      skuCode: "",
      name: "",
      description: "",
      categoryId: null,
      brand: "",
      uom: "pcs",
      baseCostPrice: 0,
      sellingPrice: 0,
      taxApplicable: true,
      status: "draft",
    },
  });

  function onSubmit(values: any) {
    setIsLoading(true);

    // Clean payload: remove empty strings and undefined values
    const payload: Record<string, any> = {};
    for (const [key, val] of Object.entries(values)) {
      if (val !== "" && val !== undefined) {
        payload[key] = val;
      }
    }

    axios
      .post("/api/modules/product-catalog/product/add", payload)
      .then(() => {
        navigate("/console/modules/product-catalog/product");
        toast.success("Product has been created.");
      })
      .catch((error) => {
        console.error("Error creating product:", error);
        toast.error("Failed to create product.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate("/console/modules/product-catalog/product");
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Product Catalog</h1>
        </div>
        <div className="ml-auto px-4">
          <div className="flex items-center gap-2 text-sm">
            <Breadcrumbs items={breadcrumbs} loading={isLoading} />
          </div>
        </div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="bg-card rounded-lg border p-6 w-full">
            <ProductForm form={form as any} onSubmit={onSubmit} onCancel={onCancel} />
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(ProductAdd, {
  moduleId: 'product-catalog',
  moduleName: 'Product Catalog'
});
