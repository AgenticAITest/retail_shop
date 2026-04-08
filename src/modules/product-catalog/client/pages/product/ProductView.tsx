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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@client/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@client/components/ui/table";
import axios from "axios";
import { ImageIcon, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import ProductForm from "./ProductForm";
import { productFormSchema } from "./productFormSchema";

// ── Types ──────────────────────────────────────────────────────────

interface Variant {
  id: string;
  variantSku: string;
  attributes: Record<string, string> | null;
  costPrice: number;
  sellingPrice: number;
  status: string;
}

interface Barcode {
  id: string;
  barcodeValue: string;
  barcodeType: string;
}

interface UomConversion {
  id: string;
  procurementUom: string;
  salesUom: string;
  conversionFactor: number;
}

interface LocationPrice {
  id: string;
  locationId: string;
  costPrice: number;
  sellingPrice: number;
  location?: { id: string; name: string };
}

interface ProductImage {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
}

interface LocationOption {
  id: string;
  name: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
}

function renderAttributes(attrs: Record<string, string> | null): string {
  if (!attrs || typeof attrs !== "object") return "-";
  return Object.entries(attrs)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

function barcodeTypeLabel(t: string): string {
  const map: Record<string, string> = {
    ean13: "EAN-13",
    upca: "UPC-A",
    internal: "Internal",
  };
  return map[t] || t;
}

// ── Component ──────────────────────────────────────────────────────

const ProductView = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  // product delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);

  // sub-entity data
  const [variants, setVariants] = useState<Variant[]>([]);
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
  const [uomConversions, setUomConversions] = useState<UomConversion[]>([]);
  const [locationPrices, setLocationPrices] = useState<LocationPrice[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  // ── Variant dialog state ─────────────────────────────────────────
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [variantSku, setVariantSku] = useState("");
  const [variantAttributes, setVariantAttributes] = useState("");
  const [variantCostPrice, setVariantCostPrice] = useState<number>(0);
  const [variantSellingPrice, setVariantSellingPrice] = useState<number>(0);
  const [variantStatus, setVariantStatus] = useState("active");
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState<string | null>(null);

  // ── Barcode dialog state ─────────────────────────────────────────
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [barcodeType, setBarcodeType] = useState("ean13");
  const [confirmDeleteBarcode, setConfirmDeleteBarcode] = useState<string | null>(null);

  // ── UoM dialog state ─────────────────────────────────────────────
  const [uomDialogOpen, setUomDialogOpen] = useState(false);
  const [procurementUom, setProcurementUom] = useState("");
  const [salesUom, setSalesUom] = useState("");
  const [conversionFactor, setConversionFactor] = useState<number>(1);
  const [confirmDeleteUom, setConfirmDeleteUom] = useState<string | null>(null);

  // ── Location Price dialog state ──────────────────────────────────
  const [locPriceDialogOpen, setLocPriceDialogOpen] = useState(false);
  const [locPriceLocationId, setLocPriceLocationId] = useState("");
  const [locPriceCost, setLocPriceCost] = useState<number>(0);
  const [locPriceSelling, setLocPriceSelling] = useState<number>(0);
  const [confirmDeleteLocPrice, setConfirmDeleteLocPrice] = useState<string | null>(null);

  // ── Image dialog state ───────────────────────────────────────────
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageIsPrimary, setImageIsPrimary] = useState(false);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState<string | null>(null);

  // ── Breadcrumbs ──────────────────────────────────────────────────

  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Products",
          onClick: () => navigate("/console/modules/product-catalog/product"),
        },
        {
          label: "View Product",
        },
      ])
    );

  // ── Product form ─────────────────────────────────────────────────

  const form = useForm({
    resolver: zodResolver(productFormSchema as any),
    defaultValues: {
      id: "",
      skuCode: "",
      name: "",
      description: "",
      categoryId: null,
      brand: "",
      uom: "pcs",
      baseCostPrice: 0,
      sellingPrice: 0,
      taxApplicable: false,
      status: "draft",
    },
  });

  function onEdit() {
    navigate(`/console/modules/product-catalog/product/${id}/edit`);
  }

  function onDelete() {
    setConfirmDelete(true);
  }

  function onConfirmDelete() {
    axios
      .delete(`/api/modules/product-catalog/product/${id}`)
      .then(() => {
        toast.success("Product deleted successfully");
        navigate(`/console/modules/product-catalog/product`);
      })
      .catch(() => {
        toast.error("Failed to delete product");
      });
  }

  // ── Load product (and all sub-entities) ──────────────────────────

  const loadProduct = useCallback(() => {
    axios.get(`/api/modules/product-catalog/product/${id}`).then((response) => {
      const data = response.data;
      form.setValue("id", data.id);
      form.setValue("skuCode", data.skuCode);
      form.setValue("name", data.name);
      form.setValue("description", data.description || "");
      form.setValue("categoryId", data.categoryId || null);
      form.setValue("brand", data.brand || "");
      form.setValue("uom", data.uom || "pcs");
      form.setValue("baseCostPrice", data.baseCostPrice || 0);
      form.setValue("sellingPrice", data.sellingPrice || 0);
      form.setValue("taxApplicable", data.taxApplicable || false);
      form.setValue("status", data.status);
      updateBreadcrumbItem(1, { label: data.name });

      setVariants(data.variants || []);
      setBarcodes(data.barcodes || []);
      setUomConversions(data.uomConversions || []);
      setLocationPrices(data.locationPrices || []);
      setImages(data.images || []);
    });
  }, [id]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  // load locations for location price dropdown
  useEffect(() => {
    axios
      .get("/api/modules/location-management/location", {
        params: { perPage: 1000, sort: "name", order: "asc" },
      })
      .then((res) => {
        const list = res.data.locations || res.data.data || res.data || [];
        setLocations(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        // location module may not be available
      });
  }, []);

  // ── Variant handlers ─────────────────────────────────────────────

  function openAddVariant() {
    setEditingVariant(null);
    setVariantSku("");
    setVariantAttributes("");
    setVariantCostPrice(0);
    setVariantSellingPrice(0);
    setVariantStatus("active");
    setVariantDialogOpen(true);
  }

  function openEditVariant(v: Variant) {
    setEditingVariant(v);
    setVariantSku(v.variantSku);
    setVariantAttributes(
      v.attributes && typeof v.attributes === "object"
        ? JSON.stringify(v.attributes)
        : ""
    );
    setVariantCostPrice(v.costPrice);
    setVariantSellingPrice(v.sellingPrice);
    setVariantStatus(v.status);
    setVariantDialogOpen(true);
  }

  function saveVariant() {
    let parsedAttributes: Record<string, string> = {};
    if (variantAttributes.trim()) {
      try {
        parsedAttributes = JSON.parse(variantAttributes);
      } catch {
        toast.error("Attributes must be valid JSON (e.g. {\"color\":\"red\"})");
        return;
      }
    }

    if (!variantSku.trim()) {
      toast.error("Variant SKU is required");
      return;
    }

    const payload = {
      variantSku: variantSku.trim(),
      attributes: parsedAttributes,
      costPrice: Number(variantCostPrice),
      sellingPrice: Number(variantSellingPrice),
      status: variantStatus,
    };

    const promise = editingVariant
      ? axios.put(
          `/api/modules/product-catalog/product/variants/${editingVariant.id}`,
          payload
        )
      : axios.post(
          `/api/modules/product-catalog/product/${id}/variants`,
          payload
        );

    promise
      .then(() => {
        toast.success(
          editingVariant
            ? "Variant updated successfully"
            : "Variant added successfully"
        );
        setVariantDialogOpen(false);
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to save variant");
      });
  }

  function deleteVariant(variantId: string) {
    axios
      .delete(`/api/modules/product-catalog/product/variants/${variantId}`)
      .then(() => {
        toast.success("Variant deleted");
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to delete variant");
      });
  }

  // ── Barcode handlers ─────────────────────────────────────────────

  function openAddBarcode() {
    setBarcodeValue("");
    setBarcodeType("ean13");
    setBarcodeDialogOpen(true);
  }

  function saveBarcode() {
    if (!barcodeValue.trim()) {
      toast.error("Barcode value is required");
      return;
    }

    axios
      .post(`/api/modules/product-catalog/product/${id}/barcodes`, {
        barcodeValue: barcodeValue.trim(),
        barcodeType,
        productId: id,
      })
      .then(() => {
        toast.success("Barcode added successfully");
        setBarcodeDialogOpen(false);
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to add barcode");
      });
  }

  function deleteBarcode(barcodeId: string) {
    axios
      .delete(`/api/modules/product-catalog/product/barcodes/${barcodeId}`)
      .then(() => {
        toast.success("Barcode deleted");
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to delete barcode");
      });
  }

  // ── UoM handlers ─────────────────────────────────────────────────

  function openAddUom() {
    setProcurementUom("");
    setSalesUom("");
    setConversionFactor(1);
    setUomDialogOpen(true);
  }

  function saveUom() {
    if (!procurementUom.trim() || !salesUom.trim()) {
      toast.error("Procurement UoM and Sales UoM are required");
      return;
    }

    axios
      .post(`/api/modules/product-catalog/product/${id}/uom`, {
        procurementUom: procurementUom.trim(),
        salesUom: salesUom.trim(),
        conversionFactor: Number(conversionFactor),
      })
      .then(() => {
        toast.success("UoM conversion added successfully");
        setUomDialogOpen(false);
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to add UoM conversion");
      });
  }

  function deleteUom(uomId: string) {
    axios
      .delete(`/api/modules/product-catalog/product/uom/${uomId}`)
      .then(() => {
        toast.success("UoM conversion deleted");
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to delete UoM conversion");
      });
  }

  // ── Location Price handlers ──────────────────────────────────────

  function openAddLocPrice() {
    setLocPriceLocationId("");
    setLocPriceCost(0);
    setLocPriceSelling(0);
    setLocPriceDialogOpen(true);
  }

  function saveLocPrice() {
    if (!locPriceLocationId) {
      toast.error("Please select a location");
      return;
    }

    axios
      .post(`/api/modules/product-catalog/product/${id}/location-prices`, {
        locationId: locPriceLocationId,
        costPrice: Number(locPriceCost),
        sellingPrice: Number(locPriceSelling),
      })
      .then(() => {
        toast.success("Location price added successfully");
        setLocPriceDialogOpen(false);
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to add location price");
      });
  }

  function deleteLocPrice(locPriceId: string) {
    axios
      .delete(
        `/api/modules/product-catalog/product/location-prices/${locPriceId}`
      )
      .then(() => {
        toast.success("Location price deleted");
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to delete location price");
      });
  }

  // ── Image handlers ───────────────────────────────────────────────

  function openAddImage() {
    setImageUrl("");
    setImageIsPrimary(false);
    setImageDialogOpen(true);
  }

  function saveImage() {
    if (!imageUrl.trim()) {
      toast.error("Image URL is required");
      return;
    }

    axios
      .post(`/api/modules/product-catalog/product/${id}/images`, {
        imageUrl: imageUrl.trim(),
        isPrimary: imageIsPrimary,
      })
      .then(() => {
        toast.success("Image added successfully");
        setImageDialogOpen(false);
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to add image");
      });
  }

  function deleteImage(imageId: string) {
    axios
      .delete(`/api/modules/product-catalog/product/images/${imageId}`)
      .then(() => {
        toast.success("Image deleted");
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to delete image");
      });
  }

  function setPrimaryImage(imageId: string) {
    axios
      .put(`/api/modules/product-catalog/product/images/${imageId}`, {
        isPrimary: true,
      })
      .then(() => {
        toast.success("Primary image updated");
        loadProduct();
      })
      .catch(() => {
        toast.error("Failed to set primary image");
      });
  }

  // ── Location name resolver ───────────────────────────────────────

  function locationName(lp: LocationPrice): string {
    if (lp.location?.name) return lp.location.name;
    const found = locations.find((l) => l.id === lp.locationId);
    return found?.name || lp.locationId;
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Product Catalog</h1>
        </div>
        <div className="ml-auto px-4">
          <div className="flex items-center gap-2 text-sm">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          {/* ── Product Form ──────────────────────────────────────── */}
          <div className="bg-card rounded-lg border p-6 w-full">
            <ProductForm
              form={form as any}
              onEdit={onEdit}
              onDelete={onDelete}
              readonly={true}
            />
          </div>

          {/* ── 1. Variants Section ───────────────────────────────── */}
          <div className="bg-card rounded-lg border p-6 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Variants</h2>
              <Button variant="outline" size="sm" onClick={openAddVariant}>
                <Plus size={16} /> Add Variant
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/20 font-semibold">
                  <TableRow>
                    <TableHead className="py-2">Variant SKU</TableHead>
                    <TableHead className="py-2">Attributes</TableHead>
                    <TableHead className="py-2">Cost Price</TableHead>
                    <TableHead className="py-2">Selling Price</TableHead>
                    <TableHead className="py-2">Status</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        No variants added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    variants.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{v.variantSku}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {renderAttributes(v.attributes)}
                        </TableCell>
                        <TableCell>{formatIDR(v.costPrice)}</TableCell>
                        <TableCell>{formatIDR(v.sellingPrice)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              v.status === "active" ? "default" : "secondary"
                            }
                          >
                            {v.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditVariant(v)}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfirmDeleteVariant(v.id)
                              }
                            >
                              <Trash2 size={14} className="text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── 2. Barcodes Section ───────────────────────────────── */}
          <div className="bg-card rounded-lg border p-6 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Barcodes</h2>
              <Button variant="outline" size="sm" onClick={openAddBarcode}>
                <Plus size={16} /> Add Barcode
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/20 font-semibold">
                  <TableRow>
                    <TableHead className="py-2">Barcode Value</TableHead>
                    <TableHead className="py-2">Type</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {barcodes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground py-8"
                      >
                        No barcodes added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    barcodes.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono">{b.barcodeValue}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {barcodeTypeLabel(b.barcodeType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteBarcode(b.id)}
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

          {/* ── 3. UoM Conversions Section ────────────────────────── */}
          <div className="bg-card rounded-lg border p-6 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">UoM Conversions</h2>
              <Button variant="outline" size="sm" onClick={openAddUom}>
                <Plus size={16} /> Add UoM
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/20 font-semibold">
                  <TableRow>
                    <TableHead className="py-2">Procurement UoM</TableHead>
                    <TableHead className="py-2">Sales UoM</TableHead>
                    <TableHead className="py-2">Conversion Factor</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uomConversions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        No UoM conversions added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    uomConversions.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.procurementUom}</TableCell>
                        <TableCell>{u.salesUom}</TableCell>
                        <TableCell>{u.conversionFactor}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteUom(u.id)}
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

          {/* ── 4. Location Prices Section ────────────────────────── */}
          <div className="bg-card rounded-lg border p-6 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Location Prices</h2>
              <Button variant="outline" size="sm" onClick={openAddLocPrice}>
                <Plus size={16} /> Add Location Price
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/20 font-semibold">
                  <TableRow>
                    <TableHead className="py-2">Location</TableHead>
                    <TableHead className="py-2">Cost Price</TableHead>
                    <TableHead className="py-2">Selling Price</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationPrices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        No location prices added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    locationPrices.map((lp) => (
                      <TableRow key={lp.id}>
                        <TableCell>{locationName(lp)}</TableCell>
                        <TableCell>{formatIDR(lp.costPrice)}</TableCell>
                        <TableCell>{formatIDR(lp.sellingPrice)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteLocPrice(lp.id)}
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

          {/* ── 5. Images Section ─────────────────────────────────── */}
          <div className="bg-card rounded-lg border p-6 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Images</h2>
              <Button variant="outline" size="sm" onClick={openAddImage}>
                <Plus size={16} /> Add Image
              </Button>
            </div>
            {images.length === 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-muted-foreground">
                  <ImageIcon size={32} className="mb-2" />
                  <p className="text-sm text-center">No images yet.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="relative group rounded-lg border overflow-hidden"
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <img
                        src={img.imageUrl}
                        alt="Product"
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (
                            e.target as HTMLImageElement
                          ).parentElement!.classList.add(
                            "flex",
                            "items-center",
                            "justify-center"
                          );
                          const placeholder = document.createElement("div");
                          placeholder.className =
                            "flex flex-col items-center text-muted-foreground";
                          placeholder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-xs mt-1">No preview</span>`;
                          (
                            e.target as HTMLImageElement
                          ).parentElement!.appendChild(placeholder);
                        }}
                      />
                    </div>
                    {img.isPrimary && (
                      <div className="absolute top-1 left-1">
                        <Badge variant="default" className="text-[10px] px-1 py-0">
                          <Star size={10} className="mr-0.5" /> Primary
                        </Badge>
                      </div>
                    )}
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!img.isPrimary && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-6 w-6 p-0"
                          title="Set as primary"
                          onClick={() => setPrimaryImage(img.id)}
                        >
                          <Star size={12} />
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title="Delete image"
                        onClick={() => setConfirmDeleteImage(img.id)}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                    <div className="p-1">
                      <p className="text-[10px] text-muted-foreground truncate">
                        {img.imageUrl}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DIALOGS
         ══════════════════════════════════════════════════════════════ */}

      {/* ── Product Delete Confirm ──────────────────────────────── */}
      <ConfirmDialog
        title="Confirm Delete"
        description="This action cannot be undone. This will permanently delete the product."
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={onConfirmDelete}
      />

      {/* ── Variant Dialog ──────────────────────────────────────── */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVariant ? "Edit Variant" : "Add Variant"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Variant SKU <span className="text-destructive">*</span>
              </label>
              <Input
                value={variantSku}
                onChange={(e) => setVariantSku(e.target.value)}
                placeholder="e.g. SKU-RED-L"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Attributes (JSON)
              </label>
              <Input
                value={variantAttributes}
                onChange={(e) => setVariantAttributes(e.target.value)}
                placeholder='{"color":"red","size":"L"}'
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cost Price</label>
                <Input
                  type="number"
                  value={variantCostPrice}
                  onChange={(e) => setVariantCostPrice(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Selling Price</label>
                <Input
                  type="number"
                  value={variantSellingPrice}
                  onChange={(e) =>
                    setVariantSellingPrice(Number(e.target.value))
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={variantStatus} onValueChange={setVariantStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVariantDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveVariant}>
              {editingVariant ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Variant Delete Confirm ──────────────────────────────── */}
      <ConfirmDialog
        title="Delete Variant"
        description="Are you sure you want to delete this variant? This action cannot be undone."
        open={confirmDeleteVariant !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteVariant(null);
        }}
        onConfirm={() => {
          if (confirmDeleteVariant) deleteVariant(confirmDeleteVariant);
          setConfirmDeleteVariant(null);
        }}
      />

      {/* ── Barcode Dialog ──────────────────────────────────────── */}
      <Dialog open={barcodeDialogOpen} onOpenChange={setBarcodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Barcode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Barcode Value <span className="text-destructive">*</span>
              </label>
              <Input
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                placeholder="e.g. 5901234123457"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Barcode Type</label>
              <Select value={barcodeType} onValueChange={setBarcodeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ean13">EAN-13</SelectItem>
                  <SelectItem value="upca">UPC-A</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBarcodeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveBarcode}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Barcode Delete Confirm ──────────────────────────────── */}
      <ConfirmDialog
        title="Delete Barcode"
        description="Are you sure you want to delete this barcode? This action cannot be undone."
        open={confirmDeleteBarcode !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteBarcode(null);
        }}
        onConfirm={() => {
          if (confirmDeleteBarcode) deleteBarcode(confirmDeleteBarcode);
          setConfirmDeleteBarcode(null);
        }}
      />

      {/* ── UoM Dialog ──────────────────────────────────────────── */}
      <Dialog open={uomDialogOpen} onOpenChange={setUomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add UoM Conversion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Procurement UoM <span className="text-destructive">*</span>
              </label>
              <Input
                value={procurementUom}
                onChange={(e) => setProcurementUom(e.target.value)}
                placeholder="e.g. Pack of 12"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Sales UoM <span className="text-destructive">*</span>
              </label>
              <Input
                value={salesUom}
                onChange={(e) => setSalesUom(e.target.value)}
                placeholder="e.g. Individual"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Conversion Factor</label>
              <Input
                type="number"
                value={conversionFactor}
                onChange={(e) => setConversionFactor(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUomDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveUom}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── UoM Delete Confirm ──────────────────────────────────── */}
      <ConfirmDialog
        title="Delete UoM Conversion"
        description="Are you sure you want to delete this UoM conversion? This action cannot be undone."
        open={confirmDeleteUom !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteUom(null);
        }}
        onConfirm={() => {
          if (confirmDeleteUom) deleteUom(confirmDeleteUom);
          setConfirmDeleteUom(null);
        }}
      />

      {/* ── Location Price Dialog ───────────────────────────────── */}
      <Dialog open={locPriceDialogOpen} onOpenChange={setLocPriceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Location Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Location <span className="text-destructive">*</span>
              </label>
              <Select
                value={locPriceLocationId}
                onValueChange={setLocPriceLocationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cost Price</label>
                <Input
                  type="number"
                  value={locPriceCost}
                  onChange={(e) => setLocPriceCost(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Selling Price</label>
                <Input
                  type="number"
                  value={locPriceSelling}
                  onChange={(e) => setLocPriceSelling(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLocPriceDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveLocPrice}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Location Price Delete Confirm ───────────────────────── */}
      <ConfirmDialog
        title="Delete Location Price"
        description="Are you sure you want to delete this location price? This action cannot be undone."
        open={confirmDeleteLocPrice !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteLocPrice(null);
        }}
        onConfirm={() => {
          if (confirmDeleteLocPrice) deleteLocPrice(confirmDeleteLocPrice);
          setConfirmDeleteLocPrice(null);
        }}
      />

      {/* ── Image Dialog ────────────────────────────────────────── */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Image URL <span className="text-destructive">*</span>
              </label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPrimary"
                checked={imageIsPrimary}
                onChange={(e) => setImageIsPrimary(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="isPrimary" className="text-sm font-medium">
                Set as primary image
              </label>
            </div>
            {imageUrl.trim() && (
              <div className="rounded-lg border overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full max-h-48 object-contain bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImageDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveImage}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Image Delete Confirm ────────────────────────────────── */}
      <ConfirmDialog
        title="Delete Image"
        description="Are you sure you want to delete this image? This action cannot be undone."
        open={confirmDeleteImage !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteImage(null);
        }}
        onConfirm={() => {
          if (confirmDeleteImage) deleteImage(confirmDeleteImage);
          setConfirmDeleteImage(null);
        }}
      />
    </>
  );
};

export default withModuleAuthorization(ProductView, {
  moduleId: 'product-catalog',
  moduleName: 'Product Catalog'
});
