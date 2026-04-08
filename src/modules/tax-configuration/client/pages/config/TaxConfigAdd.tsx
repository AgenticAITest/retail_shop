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
import TaxConfigForm from "./TaxConfigForm";
import { taxConfigFormSchema } from "./taxConfigFormSchema";

const TaxConfigAdd = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs } = useBreadcrumbs(
    createBreadcrumbItems([
      {
        label: "PPN Configuration",
        onClick: () => navigate("/console/modules/tax-configuration/config"),
      },
      {
        label: "Update Tax Rate",
      },
    ])
  );

  const form = useForm({
    resolver: zodResolver(taxConfigFormSchema as any),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      ratePercent: 11,
      effectiveDate: new Date(),
      calcMode: "exclusive",
    },
  });

  function onSubmit(values: any) {
    setIsLoading(true);

    axios
      .post("/api/modules/tax-configuration/config", {
        ...values,
      })
      .then(() => {
        navigate("/console/modules/tax-configuration/config");
        toast.success("Tax configuration has been updated.");
      })
      .catch((error) => {
        console.error("Error creating tax config:", error);
        toast.error("Failed to update tax configuration.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate("/console/modules/tax-configuration/config");
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">PPN Tax Configuration</h1>
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
            <TaxConfigForm form={form as any} onSubmit={onSubmit} onCancel={onCancel} />
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(TaxConfigAdd, {
  moduleId: 'tax-configuration',
  moduleName: 'Tax Configuration'
});
