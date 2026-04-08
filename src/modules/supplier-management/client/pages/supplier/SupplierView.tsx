import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs
} from "@client/components/console/Breadcrumbs";
import ConfirmDialog from "@client/components/console/ConfirmDialog";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";
import { Badge } from "@client/components/ui/badge";
import { Button } from "@client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@client/components/ui/dialog";
import { Input } from "@client/components/ui/input";
import { Label } from "@client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@client/components/ui/select";
import { Switch } from "@client/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@client/components/ui/table";
import axios from "axios";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import SupplierForm from "./SupplierForm";
import { supplierFormSchema } from "./supplierFormSchema";

// ── Types ──────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}

interface SupplierProduct {
  id: string;
  productId: string;
  supplierPrice: number;
  minOrderQty: number;
  supplierSku: string | null;
  product?: { id: string; name: string; skuCode: string };
}

interface ProductOption {
  id: string;
  name: string;
  skuCode: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
}

const roleLabels: Record<string, string> = {
  sales: "Sales",
  ar: "AR",
  logistics: "Logistics",
  general: "General",
};

// ── Component ──────────────────────────────────────────────────────

const SupplierView = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  // supplier delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);

  // sub-entity data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  // ── Contact dialog state ─────────────────────────────────────────
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("general");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactIsPrimary, setContactIsPrimary] = useState(false);
  const [confirmDeleteContact, setConfirmDeleteContact] = useState<string | null>(null);

  // ── Linked Product dialog state ──────────────────────────────────
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [linkProductId, setLinkProductId] = useState("");
  const [linkSupplierPrice, setLinkSupplierPrice] = useState<number>(0);
  const [linkMinOrderQty, setLinkMinOrderQty] = useState<number>(1);
  const [linkSupplierSku, setLinkSupplierSku] = useState("");
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<string | null>(null);

  // ── Breadcrumbs ──────────────────────────────────────────────────

  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Suppliers",
          onClick: () => navigate("/console/modules/supplier-management/supplier"),
        },
        {
          label: "View Supplier",
        },
      ])
    );

  // ── Supplier form ────────────────────────────────────────────────

  const form = useForm({
    resolver: zodResolver(supplierFormSchema as any),
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

  function onEdit() {
    navigate(`/console/modules/supplier-management/supplier/${id}/edit`);
  }

  function onDelete() {
    setConfirmDelete(true);
  }

  function onConfirmDelete() {
    axios
      .delete(`/api/modules/supplier-management/supplier/${id}`)
      .then(() => {
        toast.success("Supplier deleted successfully");
        navigate(`/console/modules/supplier-management/supplier`);
      })
      .catch(() => {
        toast.error("Failed to delete supplier");
      });
  }

  // ── Load supplier (and all sub-entities) ─────────────────────────

  const loadSupplier = useCallback(() => {
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

      setContacts(data.contacts || []);
      setSupplierProducts(data.products || data.supplierProducts || []);
    });
  }, [id]);

  useEffect(() => {
    loadSupplier();
  }, [loadSupplier]);

  // load products for link product dropdown
  useEffect(() => {
    axios
      .get("/api/modules/product-catalog/product", {
        params: { perPage: 1000, sort: "name", order: "asc" },
      })
      .then((res) => {
        const list = res.data.products || res.data.data || res.data || [];
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        // product module may not be available
      });
  }, []);

  // ── Contact handlers ─────────────────────────────────────────────

  function openAddContact() {
    setContactName("");
    setContactRole("general");
    setContactPhone("");
    setContactEmail("");
    setContactIsPrimary(false);
    setContactDialogOpen(true);
  }

  function saveContact() {
    if (!contactName.trim()) {
      toast.error("Contact name is required");
      return;
    }

    axios
      .post(`/api/modules/supplier-management/supplier/${id}/contacts`, {
        name: contactName.trim(),
        role: contactRole,
        phone: contactPhone.trim() || null,
        email: contactEmail.trim() || null,
        isPrimary: contactIsPrimary,
      })
      .then(() => {
        toast.success("Contact added successfully");
        setContactDialogOpen(false);
        loadSupplier();
      })
      .catch(() => {
        toast.error("Failed to add contact");
      });
  }

  function deleteContact(contactId: string) {
    axios
      .delete(`/api/modules/supplier-management/supplier/contacts/${contactId}`)
      .then(() => {
        toast.success("Contact deleted");
        loadSupplier();
      })
      .catch(() => {
        toast.error("Failed to delete contact");
      });
  }

  // ── Linked Product handlers ──────────────────────────────────────

  function openAddProduct() {
    setLinkProductId("");
    setLinkSupplierPrice(0);
    setLinkMinOrderQty(1);
    setLinkSupplierSku("");
    setProductDialogOpen(true);
  }

  function saveLinkedProduct() {
    if (!linkProductId) {
      toast.error("Please select a product");
      return;
    }

    axios
      .post(`/api/modules/supplier-management/supplier/${id}/products`, {
        productId: linkProductId,
        supplierPrice: Number(linkSupplierPrice),
        minOrderQty: Number(linkMinOrderQty),
        supplierSku: linkSupplierSku.trim() || null,
      })
      .then(() => {
        toast.success("Product linked successfully");
        setProductDialogOpen(false);
        loadSupplier();
      })
      .catch(() => {
        toast.error("Failed to link product");
      });
  }

  function deleteLinkedProduct(spId: string) {
    axios
      .delete(`/api/modules/supplier-management/supplier/supplier-products/${spId}`)
      .then(() => {
        toast.success("Product unlinked");
        loadSupplier();
      })
      .catch(() => {
        toast.error("Failed to unlink product");
      });
  }

  // ── Product name resolver ────────────────────────────────────────

  function productName(sp: SupplierProduct): string {
    if (sp.product?.name) return sp.product.name;
    const found = products.find((p) => p.id === sp.productId);
    return found?.name || sp.productId;
  }

  function productSku(sp: SupplierProduct): string {
    if (sp.product?.skuCode) return sp.product.skuCode;
    const found = products.find((p) => p.id === sp.productId);
    return found?.skuCode || "-";
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Suppliers</h1>
        </div>
        <div className="ml-auto px-4">
          <div className="flex items-center gap-2 text-sm">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          {/* ── Supplier Form ──────────────────────────────────────── */}
          <div className="bg-card rounded-lg border p-6 w-full">
            <SupplierForm
              form={form as any}
              onEdit={onEdit}
              onDelete={onDelete}
              readonly={true}
            />
          </div>

          {/* ── 1. Contacts Section ──────────────────────────────── */}
          <div className="bg-card rounded-lg border p-6 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Contacts</h2>
              <Button variant="outline" size="sm" onClick={openAddContact}>
                <Plus size={16} /> Add Contact
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/20 font-semibold">
                  <TableRow>
                    <TableHead className="py-2">Name</TableHead>
                    <TableHead className="py-2">Role</TableHead>
                    <TableHead className="py-2">Phone</TableHead>
                    <TableHead className="py-2">Email</TableHead>
                    <TableHead className="py-2">Primary</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        No contacts added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {roleLabels[c.role] || c.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.phone || "-"}</TableCell>
                        <TableCell>{c.email || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={c.isPrimary ? "default" : "secondary"}>
                            {c.isPrimary ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteContact(c.id)}
                          >
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── 2. Linked Products Section ───────────────────────── */}
          <div className="bg-card rounded-lg border p-6 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Linked Products</h2>
              <Button variant="outline" size="sm" onClick={openAddProduct}>
                <Plus size={16} /> Link Product
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/20 font-semibold">
                  <TableRow>
                    <TableHead className="py-2">Product Name</TableHead>
                    <TableHead className="py-2">SKU</TableHead>
                    <TableHead className="py-2">Supplier Price (IDR)</TableHead>
                    <TableHead className="py-2">MOQ</TableHead>
                    <TableHead className="py-2">Supplier SKU</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierProducts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        No products linked yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplierProducts.map((sp) => (
                      <TableRow key={sp.id}>
                        <TableCell>{productName(sp)}</TableCell>
                        <TableCell className="font-mono">{productSku(sp)}</TableCell>
                        <TableCell>{formatIDR(sp.supplierPrice)}</TableCell>
                        <TableCell>{sp.minOrderQty}</TableCell>
                        <TableCell>{sp.supplierSku || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteProduct(sp.id)}
                          >
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DIALOGS
         ══════════════════════════════════════════════════════════════ */}

      {/* ── Supplier Delete Confirm ─────────────────────────────── */}
      <ConfirmDialog
        title="Confirm Delete"
        description="This action cannot be undone. This will set the supplier status to inactive."
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={onConfirmDelete}
      />

      {/* ── Contact Dialog ──────────────────────────────────────── */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Contact name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={contactRole} onValueChange={setContactRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="ar">AR</SelectItem>
                  <SelectItem value="logistics">Logistics</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Email address"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={contactIsPrimary}
                onCheckedChange={setContactIsPrimary}
              />
              <Label>Primary Contact</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContactDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveContact}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Contact Delete Confirm ──────────────────────────────── */}
      <ConfirmDialog
        title="Delete Contact"
        description="Are you sure you want to delete this contact? This action cannot be undone."
        open={confirmDeleteContact !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteContact(null);
        }}
        onConfirm={() => {
          if (confirmDeleteContact) deleteContact(confirmDeleteContact);
          setConfirmDeleteContact(null);
        }}
      />

      {/* ── Link Product Dialog ─────────────────────────────────── */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Product <span className="text-destructive">*</span>
              </label>
              <Select
                value={linkProductId}
                onValueChange={setLinkProductId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.skuCode} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Supplier Price</label>
                <Input
                  type="number"
                  value={linkSupplierPrice}
                  onChange={(e) => setLinkSupplierPrice(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Min Order Qty (MOQ)</label>
                <Input
                  type="number"
                  value={linkMinOrderQty}
                  onChange={(e) => setLinkMinOrderQty(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Supplier SKU</label>
              <Input
                value={linkSupplierSku}
                onChange={(e) => setLinkSupplierSku(e.target.value)}
                placeholder="Optional supplier SKU"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProductDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveLinkedProduct}>Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Product Delete Confirm ──────────────────────────────── */}
      <ConfirmDialog
        title="Unlink Product"
        description="Are you sure you want to unlink this product? This action cannot be undone."
        open={confirmDeleteProduct !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteProduct(null);
        }}
        onConfirm={() => {
          if (confirmDeleteProduct) deleteLinkedProduct(confirmDeleteProduct);
          setConfirmDeleteProduct(null);
        }}
      />
    </>
  );
};

export default withModuleAuthorization(SupplierView, {
  moduleId: 'supplier-management',
  moduleName: 'Supplier Management'
});
