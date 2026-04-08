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
import PurchaseOrderForm from "./PurchaseOrderForm";
import { poFormSchema } from "./poFormSchema";

// Extended schema for edit: includes changeReason
const editPoFormSchema = poFormSchema.extend({
  changeReason: z.string().min(1, "Change reason is required for amendments"),
});

const PurchaseOrderEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Purchase Orders",
          onClick: () => navigate("/console/modules/purchase-order/po"),
        },
        {
          label: "Edit PO",
        },
      ])
    );

  const form = useForm({
    resolver: zodResolver(editPoFormSchema as any),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      supplierId: "",
      locationId: null as string | null,
      orderDate: "",
      expectedDeliveryDate: null as string | null,
      notes: "",
      changeReason: "",
      items: [] as any[],
    },
  });

  function onSubmit(values: any) {
    setIsLoading(true);

    const payload = { ...values };
    delete payload.id;

    if (payload.locationId === '') payload.locationId = null;
    if (payload.expectedDeliveryDate === '') payload.expectedDeliveryDate = null;
    if (payload.notes === '') payload.notes = null;

    axios
      .put(`/api/modules/purchase-order/po/${id}`, payload)
      .then(() => {
        navigate(`/console/modules/purchase-order/po/${id}`);
        toast.success("Purchase order has been updated.");
      })
      .catch((error) => {
        console.error("Error updating purchase order:", error);
        const msg = error.response?.data?.message || error.response?.data?.error || "Failed to update purchase order.";
        toast.error(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate(`/console/modules/purchase-order/po/${id}`);
  }

  useEffect(() => {
    axios.get(`/api/modules/purchase-order/po/${id}`).then((response) => {
      const data = response.data;

      // Check if PO is editable
      if (data.status !== 'draft' && data.status !== 'approved') {
        toast.error("This purchase order cannot be edited.");
        navigate(`/console/modules/purchase-order/po/${id}`);
        return;
      }

      form.setValue("supplierId", data.supplierId);
      form.setValue("locationId", data.locationId || null);
      form.setValue("orderDate", data.orderDate ? new Date(data.orderDate).toISOString().split('T')[0] : "");
      form.setValue("expectedDeliveryDate", data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate).toISOString().split('T')[0] : null);
      form.setValue("notes", data.notes || "");
      form.setValue("items", (data.items || []).map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        skuCode: item.skuCode,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        discountPercent: parseFloat(item.discountPercent || '0'),
        uom: item.uom || 'pcs',
        supplierSku: item.supplierSku || '',
        notes: item.notes || '',
      })));

      updateBreadcrumbItem(1, { label: `Edit ${data.poNumber}` });
    }).catch((error) => {
      console.error("Error loading PO:", error);
      toast.error("Failed to load purchase order.");
      navigate("/console/modules/purchase-order/po");
    });
  }, []);

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
            <PurchaseOrderForm form={form as any} onSubmit={onSubmit} onCancel={onCancel} isEdit />
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(PurchaseOrderEdit, {
  moduleId: 'purchase-order',
  moduleName: 'Purchase Order'
});
