import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs,
} from "@client/components/console/Breadcrumbs";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";
import ConfirmDialog from "@client/components/console/ConfirmDialog";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import CategoryForm from "./CategoryForm";
import { categoryFormSchema } from "./categoryFormSchema";

const CategoryView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Categories",
          onClick: () => navigate("/console/modules/product-catalog/category"),
        },
        {
          label: "View Category",
        },
      ])
    );

  const form = useForm({
    resolver: zodResolver(categoryFormSchema as any),
    defaultValues: {
      name: "",
      parentId: null,
      sortOrder: 0,
    },
  });

  function onEdit() {
    navigate(`/console/modules/product-catalog/category/${id}/edit`);
  }

  function onDelete() {
    setConfirmDelete(true);
  }

  function onConfirmDelete() {
    axios
      .delete(`/api/modules/product-catalog/category/${id}`)
      .then(() => {
        navigate("/console/modules/product-catalog/category");
        toast.success("Category has been deleted.");
      })
      .catch((error) => {
        console.error("Error deleting category:", error);
        toast.error("Failed to delete category. It may have products assigned.");
      });
  }

  useEffect(() => {
    setIsLoading(true);
    axios.get(`/api/modules/product-catalog/category/${id}`)
      .then((response) => {
        const data = response.data;
        form.setValue("name", data.name);
        form.setValue("parentId", data.parentId || null);
        form.setValue("sortOrder", data.sortOrder || 0);
        updateBreadcrumbItem(1, { label: data.name });
      })
      .finally(() => {
        setIsLoading(false);
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
            <CategoryForm
              form={form as any}
              onEdit={onEdit}
              onDelete={onDelete}
              readonly={true}
            />
          </div>
        </div>
      </div>
      <ConfirmDialog
        title="Confirm Delete"
        description="This action cannot be undone. This will delete the category."
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
};

export default withModuleAuthorization(CategoryView, {
  moduleId: 'product-catalog',
  moduleName: 'Product Catalog'
});
