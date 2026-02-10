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
import { useNavigate } from "react-router";
import { toast } from "sonner";
import DocumentForm from "./DocumentForm";
import { documentFormSchema } from "./documentFormSchema";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";

const DocumentAdd = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Using the enhanced breadcrumbs with React state
  const { items: breadcrumbs, updateItem } = useBreadcrumbs(
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
    reValidateMode:"onSubmit",
    defaultValues: {
      id: "",
      name: "",
      code: "",
      releaseDate: new Date(),
      pages: 0,
    },
  });

  function onSubmit(values: z.infer<typeof documentFormSchema>) {  

    // console.log(values);

    setIsLoading(true);

    axios
      .post("/api/modules/demo-module/document/add", {
        ...values,
      })
      .then(() => {
        //console.log("Document created successfully");
        navigate("/console/modules/demo-module/document");
        toast.success("Document has been created.");
      })
      .catch((error) => {
        console.error("Error creating document:", error);
        toast.error("Failed to create document.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate("/console/modules/demo-module/document");
  }

  useEffect(() => {
    //form.setValue("tenantId", user?.activeTenant.id || '');
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

export default withModuleAuthorization(DocumentAdd, {
  moduleId: 'demo-module',
  moduleName: 'Demo Module'
});
