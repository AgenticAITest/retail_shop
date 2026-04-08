import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs,
} from "@client/components/console/Breadcrumbs";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import ProductForm from "./ProductForm";
import { productFormSchema } from "./productFormSchema";

const ProductEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Products",
          onClick: () => navigate("/console/modules/product-catalog/product"),
        },
        {
          label: "Edit Product",
        },
      ])
    );

  const form = useForm({
    resolver: zodResolver(productFormSchema as any),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      id: "",
      skuCode: "",
      name: "",
      description: "",
      categoryId: null,
      brand: "",
      uom: "pcs",
      baseCostPrice: 0,
      sellingPrice: 0,
      taxApplicable: false,
      status: "draft",
    },
  });

  function onSubmit(values: any) {
    setIsLoading(true);
    axios
      .put(`/api/modules/product-catalog/product/${id}`, values)
      .then(() => {
        navigate("/console/modules/product-catalog/product");
        toast.success("Product has been updated.");
      })
      .catch((error) => {
        console.error("Error updating product:", error);
        toast.error("Failed to update product.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate(`/console/modules/product-catalog/product/${id}`);
  }

  useEffect(() => {
    axios.get(`/api/modules/product-catalog/product/${id}`).then((response) => {
      const data = response.data;
      form.setValue("id", data.id);
      form.setValue("skuCode", data.skuCode);
      form.setValue("name", data.name);
      form.setValue("description", data.description || "");
      form.setValue("categoryId", data.categoryId || null);
      form.setValue("brand", data.brand || "");
      form.setValue("uom", data.uom || "pcs");
      form.setValue("baseCostPrice", data.baseCostPrice || 0);
      form.setValue("sellingPrice", data.sellingPrice || 0);
      form.setValue("taxApplicable", data.taxApplicable || false);
      form.setValue("status", data.status);
      updateBreadcrumbItem(1, { label: data.name });
    });
  }, []);

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

export default withModuleAuthorization(ProductEdit, {
  moduleId: 'product-catalog',
  moduleName: 'Product Catalog'
});
