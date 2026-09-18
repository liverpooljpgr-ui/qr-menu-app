"use client";

import { useState, useMemo } from "react";
import { compressImageIfNeeded, formatFileSize } from "@/lib/image-compression";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileInput } from "@/components/ui/file-input";
import { getPhotoUrl } from "@/lib/storage";
import { X } from "lucide-react";

interface ItemFormProps {
  venueId: string;
  sectionId: string;
  currency?: string;
  initialData?: {
    id: string;
    name: string;
    description?: string | null;
    price_minor?: number;
    photo_path?: string | null;
  };
  onSubmit: (data: {
    name: string;
    description?: string;
    price_minor_units?: number;
    photoFile?: File;
    removePhoto?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ItemForm({
  venueId,
  sectionId,
  currency = "$",
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: ItemFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [price, setPrice] = useState(
    initialData?.price_minor
      ? (initialData.price_minor / 100).toFixed(2)
      : ""
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoPreview = useMemo(() => {
    if (photoFile) {
      return URL.createObjectURL(photoFile);
    }
    if (removePhoto) return undefined;
    return getPhotoUrl(initialData?.photo_path);
  }, [photoFile, removePhoto, initialData?.photo_path]);

  const handlePhotoChange = async (file: File | null) => {
    if (file) {
      const compressed = await compressImageIfNeeded(file);
      setPhotoFile(compressed);
      setRemovePhoto(false);
    } else {
      setPhotoFile(null);
      setRemovePhoto(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Item name is required");
      return;
    }

    try {
      const priceCents =
        price && parseFloat(price) > 0
          ? Math.round(parseFloat(price) * 100)
          : undefined;

      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        price_minor_units: priceCents,
        photoFile: photoFile || undefined,
        removePhoto: removePhoto && !photoFile,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
    }
  };

  return (
    <Card className="p-6 max-w-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          {initialData ? "Edit Item" : "New Item"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Item Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Caesar Salad"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Romaine, croutons, parmesan"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="price">Price ({currency})</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g., 12.99"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label>Photo</Label>
          <FileInput
            accept="image/*"
            onChange={handlePhotoChange}
            preview={photoPreview}
            disabled={isLoading}
            maxSize={10 * 1024 * 1024}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Item"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
