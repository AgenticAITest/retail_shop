import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs
} from "@client/components/console/Breadcrumbs";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";
import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import PurchaseOrderForm from "./PurchaseOrderForm";
import { poFormSchema } from "./poFormSchema";

const PurchaseOrderAdd = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs } = useBreadcrumbs(
    createBreadcrumbItems([
      {
        label: "Purchase Orders",
        onClick: () => navigate("/console/modules/purchase-order/po"),
      },
      {
        label: "Create PO",
      },
    ])
  );

  const form = useForm({
    resolver: zodResolver(poFormSchema as any),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      supplierId: "",
      locationId: null,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: null,
      notes: "",
      items: [
        {
          productId: "",
          productName: "",
          skuCode: "",
          quantity: 1,
          unitPrice: 0,
          discountPercent: 0,
          uom: "pcs",
          supplierSku: "",
          notes: "",
        },
      ],
    },
  });

  function onSubmit(values: any) {
    setIsLoading(true);

    const payload = { ...values };
    delete payload.id;

    // Clean nullish values
    if (payload.locationId === '') payload.locationId = null;
    if (payload.expectedDeliveryDate === '') payload.expectedDeliveryDate = null;
    if (payload.notes === '') payload.notes = null;

    axios
      .post("/api/modules/purchase-order/po", payload)
      .then(() => {
        navigate("/console/modules/purchase-order/po");
        toast.success("Purchase order has been created.");
      })
      .catch((error) => {
        console.error("Error creating purchase order:", error);
        const msg = error.response?.data?.message || error.response?.data?.error || "Failed to create purchase order.";
        toast.error(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate("/console/modules/purchase-order/po");
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Purchase Orders</h1>
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
            <PurchaseOrderForm form={form as any} onSubmit={onSubmit} onCancel={onCancel} />
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(PurchaseOrderAdd, {
  moduleId: 'purchase-order',
  moduleName: 'Purchase Order'
});
