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
import LocationForm from "./LocationForm";
import { locationFormSchema } from "./locationFormSchema";

const LocationEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Locations",
          onClick: () => navigate("/console/modules/location-management/location"),
        },
        {
          label: "Edit Location",
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
      syncConfig: null,
      status: "active",
    },
  });

  function onSubmit(values: any) {
    setIsLoading(true);
    axios
      .put(`/api/modules/location-management/location/${id}`, values)
      .then(() => {
        navigate("/console/modules/location-management/location");
        toast.success("Location has been updated.");
      })
      .catch((error) => {
        console.error("Error updating location:", error);
        toast.error("Failed to update location.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate(`/console/modules/location-management/location/${id}`);
  }

  useEffect(() => {
    axios.get(`/api/modules/location-management/location/${id}`).then((response) => {
      const data = response.data;
      form.setValue("id", data.id);
      form.setValue("code", data.code);
      form.setValue("name", data.name);
      form.setValue("type", data.type);
      form.setValue("parentId", data.parentId || null);
      form.setValue("address", data.address || "");
      form.setValue("city", data.city || "");
      form.setValue("province", data.province || "");
      form.setValue("phone", data.phone || "");
      form.setValue("timezone", data.timezone || "Asia/Jakarta");
      form.setValue("syncConfig", data.syncConfig || null);
      form.setValue("status", data.status);
      updateBreadcrumbItem(1, { label: data.name });
    });
  }, []);

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

export default withModuleAuthorization(LocationEdit, {
  moduleId: 'location-management',
  moduleName: 'Location Management'
});
