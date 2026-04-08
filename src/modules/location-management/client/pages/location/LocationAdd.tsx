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
import LocationForm from "./LocationForm";
import { locationFormSchema } from "./locationFormSchema";

const LocationAdd = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs, updateItem } = useBreadcrumbs(
    createBreadcrumbItems([
      {
        label: "Locations",
        onClick: () => navigate("/console/modules/location-management/location"),
      },
      {
        label: "Add Location",
      },
    ])
  );

  const form = useForm({
    resolver: zodResolver(locationFormSchema as any),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      id: "",
      code: "",
      name: "",
      type: "shop",
      parentId: null,
      address: "",
      city: "",
      province: "",
      phone: "",
      timezone: "Asia/Jakarta",
      syncConfig: {
        frequency: "once_daily",
        windows: ["06:00"],
        bandwidthMode: "full",
        manualSyncEnabled: false,
        autoSyncOnReconnect: true,
      },
      status: "active",
    },
  });

  function onSubmit(values: any) {
    setIsLoading(true);

    axios
      .post("/api/modules/location-management/location/add", {
        ...values,
      })
      .then(() => {
        navigate("/console/modules/location-management/location");
        toast.success("Location has been created.");
      })
      .catch((error) => {
        console.error("Error creating location:", error);
        toast.error("Failed to create location.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate("/console/modules/location-management/location");
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Locations</h1>
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
            <LocationForm form={form as any} onSubmit={onSubmit} onCancel={onCancel} />
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(LocationAdd, {
  moduleId: 'location-management',
  moduleName: 'Location Management'
});
