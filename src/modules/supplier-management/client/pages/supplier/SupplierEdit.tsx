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
import SupplierForm from "./SupplierForm";
import { supplierFormSchema } from "./supplierFormSchema";

const SupplierEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Suppliers",
          onClick: () => navigate("/console/modules/supplier-management/supplier"),
        },
        {
          label: "Edit Supplier",
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
    axios
      .put(`/api/modules/supplier-management/supplier/${id}`, values)
      .then(() => {
        navigate("/console/modules/supplier-management/supplier");
        toast.success("Supplier has been updated.");
      })
      .catch((error) => {
        console.error("Error updating supplier:", error);
        toast.error("Failed to update supplier.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate(`/console/modules/supplier-management/supplier/${id}`);
  }

  useEffect(() => {
    axios.get(`/api/modules/supplier-management/supplier/${id}`).then((response) => {
      const data = response.data;
      form.setValue("id", data.id);
      form.setValue("code", data.code);
      form.setValue("name", data.name);
      form.setValue("npwp", data.npwp || "");
      form.setValue("address", data.address || "");
      form.setValue("paymentTerms", data.paymentTerms || "");
      form.setValue("leadTimeDays", data.leadTimeDays ?? null);
      form.setValue("bankDetails", data.bankDetails || { bankName: "", accountNumber: "", accountHolder: "" });
      form.setValue("status", data.status);
      updateBreadcrumbItem(1, { label: data.name });
    });
  }, []);

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

export default withModuleAuthorization(SupplierEdit, {
  moduleId: 'supplier-management',
  moduleName: 'Supplier Management'
});
