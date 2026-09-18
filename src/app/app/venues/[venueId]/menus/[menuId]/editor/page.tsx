"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MenuSections, type MenuSection } from "@/components/menu/menu-sections";
import { MenuItems, type MenuItem } from "@/components/menu/menu-items";
import { SectionForm } from "@/components/menu/section-form";
import { ItemForm } from "@/components/menu/item-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";

interface Menu {
  id: string;
  venue_id: string;
}

interface Venue {
  id: string;
  name: string;
  currency?: string;
}

type FormMode = "none" | "add-section" | "edit-section" | "add-item" | "edit-item";

export default function MenuEditor() {
  const params = useParams();
  const router = useRouter();
  const venueId = params.venueId as string;
  const menuId = params.menuId as string;
  const supabase = createClient();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<MenuSection | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>("none");
  const [editingSection, setEditingSection] = useState<MenuSection | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [venueId, menuId]);

  useEffect(() => {
    if (selectedSection) {
      loadItems(selectedSection.id);
    }
  }, [selectedSection]);

  const loadData = async () => {
    setIsLoading(true);
    const { data: venueData } = await supabase
      .from("venues")
      .select("id, name, currency")
      .eq("id", venueId)
      .single();

    setVenue(venueData);

    const { data: menuData } = await supabase
      .from("menus")
      .select("id, venue_id")
      .eq("id", menuId)
      .single();

    setMenu(menuData as Menu);

    if (menuData) {
      await loadSections();
    }
    setIsLoading(false);
  };

  const loadSections = async () => {
    const { data } = await supabase
      .from("menu_sections")
      .select("*")
      .eq("menu_id", menuId)
      .order("position");

    setSections(data || []);
    if (data?.length && !selectedSection) {
      setSelectedSection(data[0]);
    }
  };

  const loadItems = async (sectionId: string) => {
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("section_id", sectionId)
      .order("position");

    setItems(data || []);
  };

  const handleSaveSection = async (data: {
    name: string;
    description?: string;
  }) => {
    setIsSaving(true);
    setError(null);
    try {
      if (editingSection) {
        const { error } = await supabase
          .from("menu_sections")
          .update({ name: data.name })
          .eq("id", editingSection.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("menu_sections")
          .insert([
            {
              name: data.name,
              menu_id: menuId,
              position: sections.length,
              venue_id: venueId,
              translations: {},
            },
          ]);

        if (error) {
          console.error("Section insert error:", error);
          throw error;
        }
      }

      setFormMode("none");
      setEditingSection(null);
      await loadSections();
    } catch (err) {
      console.error("Error saving section:", err);
      setError(err instanceof Error ? err.message : "Failed to save section");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveItem = async (data: {
    name: string;
    description?: string;
    price_minor_units?: number;
    photoFile?: File;
  }) => {
    setIsSaving(true);
    setError(null);
    try {
      let photoPath = editingItem?.photo_path;

      if (data.photoFile) {
        const formData = new FormData();
        formData.append("file", data.photoFile);
        formData.append("venueId", venueId);

        const uploadRes = await fetch("/api/storage/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Photo upload failed");
        }
        if (uploadData.error) throw new Error(uploadData.error);
        photoPath = uploadData.path;
      }

      const itemData = {
        name: data.name,
        description: data.description || null,
        price_minor: data.price_minor_units || 0,
        photo_path: photoPath || null,
        is_available: true,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("menu_items")
          .update(itemData)
          .eq("id", editingItem.id);

        if (error) {
          console.error("Item update error:", error);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("menu_items")
          .insert([
            {
              ...itemData,
              section_id: selectedSection!.id,
              venue_id: venueId,
              position: items.length,
              translations: {},
            },
          ]);

        if (error) {
          console.error("Item insert error:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          throw new Error(error.message || "Failed to create item");
        }
      }

      setFormMode("none");
      setEditingItem(null);
      await loadItems(selectedSection!.id);
    } catch (err) {
      console.error("Error saving item:", err);
      setError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReorderSections = async (reorderedSections: MenuSection[]) => {
    for (let idx = 0; idx < reorderedSections.length; idx++) {
      const { error } = await supabase
        .from("menu_sections")
        .update({ position: idx })
        .eq("id", reorderedSections[idx].id);

      if (error) {
        throw error;
      }
    }

    setSections(reorderedSections);
  };

  const handleReorderItems = async (reorderedItems: MenuItem[]) => {
    for (let idx = 0; idx < reorderedItems.length; idx++) {
      const { error } = await supabase
        .from("menu_items")
        .update({ position: idx })
        .eq("id", reorderedItems[idx].id);

      if (error) {
        throw error;
      }
    }

    setItems(reorderedItems);
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm("Delete this section and all its items?")) return;

    const { error } = await supabase
      .from("menu_sections")
      .delete()
      .eq("id", sectionId);

    if (error) {
      alert("Failed to delete section");
      return;
    }

    await loadSections();
    if (selectedSection?.id === sectionId) {
      setSelectedSection(sections[0] || null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Delete this item?")) return;

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      alert("Failed to delete item");
      return;
    }

    await loadItems(selectedSection!.id);
  };

  if (!venue) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href={`/app/venues/${venueId}/menus`}>
          <Button variant="outline" size="sm">
            <ChevronLeft className="w-4 h-4" />
            Back to Menus
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{venue.name}</h1>
          <p className="text-sm text-muted-foreground">Edit menu</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md text-sm">
          Error: {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sections Panel */}
        <Card className="lg:col-span-1 p-4">
          {formMode === "add-section" || formMode === "edit-section" ? (
            <SectionForm
              venueId={venueId}
              initialData={editingSection || undefined}
              onSubmit={handleSaveSection}
              onCancel={() => {
                setFormMode("none");
                setEditingSection(null);
              }}
              isLoading={isSaving}
            />
          ) : (
            <MenuSections
              sections={sections}
              selectedSectionId={selectedSection?.id}
              isLoading={isLoading}
              onAddSection={() => {
                setEditingSection(null);
                setFormMode("add-section");
              }}
              onSelectSection={setSelectedSection}
              onEditSection={(section) => {
                setEditingSection(section);
                setFormMode("edit-section");
              }}
              onDeleteSection={handleDeleteSection}
              onReorder={handleReorderSections}
            />
          )}
        </Card>

        {/* Items Panel */}
        <Card className="lg:col-span-2 p-4">
          {formMode === "add-item" || formMode === "edit-item" ? (
            <ItemForm
              venueId={venueId}
              sectionId={selectedSection?.id || ""}
              currency={venue.currency || "$"}
              initialData={editingItem || undefined}
              onSubmit={handleSaveItem}
              onCancel={() => {
                setFormMode("none");
                setEditingItem(null);
              }}
              isLoading={isSaving}
            />
          ) : selectedSection ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{selectedSection.name}</h2>
              <MenuItems
                items={items}
                isLoading={isLoading}
                onAddItem={() => {
                  setEditingItem(null);
                  setFormMode("add-item");
                }}
                onEditItem={(item) => {
                  setEditingItem(item);
                  setFormMode("edit-item");
                }}
                onDeleteItem={handleDeleteItem}
                onReorder={handleReorderItems}
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Create a section first
              </p>
              <Button
                className="mt-4"
                onClick={() => {
                  setEditingSection(null);
                  setFormMode("add-section");
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Section
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
