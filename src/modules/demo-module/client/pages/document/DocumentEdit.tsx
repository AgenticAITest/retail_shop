import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs,
} from "@client/components/console/Breadcrumbs";
import { useAuth } from "@client/provider/AuthProvider";
import axios from "axios";
import { parse } from "date-fns";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import DocumentForm from "./DocumentForm";
import { documentFormSchema } from "./documentFormSchema";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";

const DocumentEdit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Documents",
          onClick: () => navigate("/console/modules/demo-module/document"),
        },
        {
          label: "Add Document",
        },
      ])
    );

  const form = useForm<z.infer<typeof documentFormSchema>>({
    resolver: zodResolver(documentFormSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      id: "",
      name: "",
      code: "",
      releaseDate: new Date(),
      pages: 0,
    },
  });

  function onSubmit(values: z.infer<typeof documentFormSchema>) {
    //console.log(values);
    setIsLoading(true);
    axios
      .put(`/api/modules/demo-module/document/${id}/edit`, values)
      .then(() => {
        //console.log("Document created successfully");
        navigate("/console/modules/demo-module/document");
        toast.success("Document has been updated.");
      })
      .catch((error) => {
        console.error("Error updating document:", error);
        toast.error("Failed to update document.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate(`/console/modules/demo-module/document/${id}`);
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
            <Breadcrumbs items={breadcrumbs} loading={isLoading} />
          </div>
        </div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="bg-card rounded-lg border p-6 w-full">
            <DocumentForm form={form} onSubmit={onSubmit} onCancel={onCancel} />
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(DocumentEdit, {
  moduleId: 'demo-module',
  moduleName: 'Demo Module'
});