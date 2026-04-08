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
import SupplierForm from "./SupplierForm";
import { supplierFormSchema } from "./supplierFormSchema";

const SupplierAdd = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs, updateItem } = useBreadcrumbs(
    createBreadcrumbItems([
      {
        label: "Suppliers",
        onClick: () => navigate("/console/modules/supplier-management/supplier"),
      },
      {
        label: "Add Supplier",
      },
    ])
  );

  const form = useForm({
    resolver: zodResolver(supplierFormSchema as any),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      id: "",
      code: "",
      name: "",
      npwp: "",
      address: "",
      paymentTerms: "",
      leadTimeDays: null,
      bankDetails: {
        bankName: "",
        accountNumber: "",
        accountHolder: "",
      },
      status: "active",
    },
  });

  function onSubmit(values: any) {
    setIsLoading(true);

    // Clean empty strings before POST, don't send id
    const payload = { ...values };
    delete payload.id;
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '') {
        payload[key] = null;
      }
    });
    if (payload.bankDetails) {
      Object.keys(payload.bankDetails).forEach((key) => {
        if (payload.bankDetails[key] === '') {
          payload.bankDetails[key] = null;
        }
      });
    }

    axios
      .post("/api/modules/supplier-management/supplier/add", payload)
      .then(() => {
        navigate("/console/modules/supplier-management/supplier");
        toast.success("Supplier has been created.");
      })
      .catch((error) => {
        console.error("Error creating supplier:", error);
        toast.error("Failed to create supplier.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate("/console/modules/supplier-management/supplier");
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Suppliers</h1>
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
            <SupplierForm form={form as any} onSubmit={onSubmit} onCancel={onCancel} />
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(SupplierAdd, {
  moduleId: 'supplier-management',
  moduleName: 'Supplier Management'
});
