"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface SectionFormProps {
  venueId: string;
  initialData?: {
    id: string;
    name: string;
    description?: string;
  };
  onSubmit: (data: {
    name: string;
    description?: string;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SectionForm({
  venueId,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: SectionFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Section name is required");
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save section"
      );
    }
  };

  return (
    <Card className="p-6 max-w-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          {initialData ? "Edit Section" : "New Section"}
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
          <Label htmlFor="name">Section Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Appetizers"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Small bites to start"
            disabled={isLoading}
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
            {isLoading ? "Saving..." : "Save Section"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
