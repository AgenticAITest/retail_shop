import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs,
} from "@client/components/console/Breadcrumbs";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import CategoryForm from "./CategoryForm";
import { categoryFormSchema } from "./categoryFormSchema";

const CategoryEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Categories",
          onClick: () => navigate("/console/modules/product-catalog/category"),
        },
        {
          label: "Edit Category",
        },
      ])
    );

  const form = useForm({
    resolver: zodResolver(categoryFormSchema as any),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      name: "",
      parentId: null,
      sortOrder: 0,
    },
  });

  function onSubmit(values: any) {
    setIsLoading(true);
    axios
      .put(`/api/modules/product-catalog/category/${id}`, values)
      .then(() => {
        navigate("/console/modules/product-catalog/category");
        toast.success("Category has been updated.");
      })
      .catch((error) => {
        console.error("Error updating category:", error);
        toast.error("Failed to update category.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate(`/console/modules/product-catalog/category/${id}`);
  }

  useEffect(() => {
    axios.get(`/api/modules/product-catalog/category/${id}`).then((response) => {
      const data = response.data;
      form.setValue("name", data.name);
      form.setValue("parentId", data.parentId || null);
      form.setValue("sortOrder", data.sortOrder || 0);
      updateBreadcrumbItem(1, { label: data.name });
    });
  }, []);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Categories</h1>
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
            <CategoryForm form={form as any} onSubmit={onSubmit} onCancel={onCancel} />
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(CategoryEdit, {
  moduleId: 'product-catalog',
  moduleName: 'Product Catalog'
});
