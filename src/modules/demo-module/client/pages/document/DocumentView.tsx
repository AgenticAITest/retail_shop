import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs
} from "@client/components/console/Breadcrumbs";
import { useAuth } from "@client/provider/AuthProvider";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import DocumentForm from "./DocumentForm";
import { documentFormSchema } from "./documentFormSchema";

import ConfirmDialog from "@client/components/console/ConfirmDialog";
import { parse } from "date-fns";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";

const DocumentView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Documents",
          onClick: () => navigate("/console/modules/demo-module/document"),
        },
        {
          label: "View Document",
        },
      ])
    );

  const form = useForm<z.infer<typeof documentFormSchema>>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      id: "",
      name: "",
      code: "",
      releaseDate: new Date(),
      pages: 0,
    },
  });

  function onEdit() {
    navigate(`/console/modules/demo-module/document/${id}/edit`);
  }

  function onDelete() {
    setConfirmDelete(true);
  }
  
  function onPrint() {
    navigate(`/console/modules/demo-module/document/${id}/print`);
  }

  function onConfirmDelete() {
    axios
      .delete(`/api/modules/demo-module/document/${id}/delete`)
      .then(() => {
        toast.success("Document deleted successfully");
        navigate(`/console/modules/demo-module/document`);
      })
      .catch((error) => {
        toast.error("Failed to delete document");
      });
  }

  useEffect(() => {
    axios.get(`/api/modules/demo-module/document/${id}`).then((response) => {
      form.setValue("id", response.data.id);
      form.setValue("name", response.data.name);
      form.setValue("code", response.data.code);
      form.setValue("releaseDate", parse(response.data.releaseDate, "yyyy-MM-dd", new Date()));
      form.setValue("pages", response.data.pages);
      updateBreadcrumbItem(1, { label: response.data.name });
    });
  }, []);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Documents</h1>
        </div>
        <div className="ml-auto px-4">
          <div className="flex items-center gap-2 text-sm">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="bg-card rounded-lg border p-6 w-full">
            <DocumentForm
              form={form}
              onEdit={onEdit}
              onDelete={onDelete}
              onPrint={onPrint}
              readonly={true}
            />
          </div>
        </div>
      </div>
      <ConfirmDialog
        title='Confirm Delete'
        description='This action cannot be undone. This will permanently delete the document and remove all associated data.'
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
};

export default withModuleAuthorization(DocumentView, {
  moduleId: 'demo-module',
  moduleName: 'Demo Module'
});