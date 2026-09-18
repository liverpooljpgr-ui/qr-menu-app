"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ChevronLeft, Plus, Edit2, Trash2, Copy, CheckCircle, Circle } from "lucide-react";

interface Menu {
  id: string;
  name: string;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Venue {
  id: string;
  name: string;
}

export default function MenusPage() {
  const params = useParams();
  const router = useRouter();
  const venueId = params.venueId as string;
  const supabase = createClient();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadVenue();
    loadMenus();
  }, [venueId]);

  const loadVenue = async () => {
    const { data } = await supabase
      .from("venues")
      .select("id, name")
      .eq("id", venueId)
      .single();

    setVenue(data);
  };

  const loadMenus = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("menus")
      .select("*")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false });

    setMenus(data || []);
    setIsLoading(false);
  };

  const handleCreateMenu = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("menus")
        .insert([
          {
            venue_id: venueId,
            name: `Menu (${new Date().toLocaleDateString()})`,
            status: "draft",
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        router.push(`/app/venues/${venueId}/menus/${data.id}/editor`);
      }
    } catch (error) {
      console.error("Failed to create menu:", error);
      alert("Failed to create menu");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDuplicateMenu = async (menu: Menu) => {
    try {
      const { data: newMenu, error } = await supabase
        .from("menus")
        .insert([
          {
            venue_id: venueId,
            name: `${menu.name} (Copy)`,
            status: "draft",
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Duplicate sections and items
      if (newMenu) {
        const { data: sections } = await supabase
          .from("menu_sections")
          .select("*")
          .eq("menu_id", menu.id);

        if (sections && sections.length > 0) {
          const newSections = sections.map((s) => ({
            menu_id: newMenu.id,
            venue_id: venueId,
            name: s.name,
            position: s.position,
          }));

          const { data: insertedSections } = await supabase
            .from("menu_sections")
            .insert(newSections)
            .select();

          // Duplicate items for each section
          if (insertedSections) {
            for (let i = 0; i < sections.length; i++) {
              const { data: items } = await supabase
                .from("menu_items")
                .select("*")
                .eq("section_id", sections[i].id);

              if (items && items.length > 0) {
                const newItems = items.map((item) => ({
                  section_id: insertedSections[i].id,
                  venue_id: venueId,
                  name: item.name,
                  description: item.description,
                  price_minor: item.price_minor,
                  photo_path: item.photo_path,
                  is_available: item.is_available,
                  position: item.position,
                }));

                await supabase.from("menu_items").insert(newItems);
              }
            }
          }
        }

        await loadMenus();
      }
    } catch (error) {
      console.error("Failed to duplicate menu:", error);
      alert("Failed to duplicate menu");
    }
  };

  const handleDeleteMenu = async (menuId: string) => {
    if (!confirm("Delete this menu?")) return;

    setDeletingId(menuId);
    try {
      const { error } = await supabase.from("menus").delete().eq("id", menuId);

      if (error) throw error;
      await loadMenus();
    } catch (error) {
      console.error("Failed to delete menu:", error);
      alert("Failed to delete menu");
    } finally {
      setDeletingId(null);
    }
  };

  const handleChangeStatus = async (menu: Menu) => {
    try {
      const newStatus = menu.status === "published" ? "draft" : "published";

      const { error } = await supabase
        .from("menus")
        .update({
          status: newStatus,
          published_at: newStatus === "published" ? new Date().toISOString() : null,
        })
        .eq("id", menu.id);

      if (error) throw error;
      await loadMenus();
    } catch (error) {
      console.error("Failed to change menu status:", error);
      alert("Failed to change menu status");
    }
  };

  if (!venue) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/app/venues">
          <Button variant="outline" size="sm">
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{venue.name}</h1>
          <p className="text-sm text-muted-foreground">Manage menus</p>
        </div>
      </div>

      {/* Create New Menu Button */}
      <Button
        onClick={handleCreateMenu}
        disabled={isCreating}
        className="w-fit"
      >
        <Plus className="w-4 h-4 mr-2" />
        {isCreating ? "Creating..." : "Create New Menu"}
      </Button>

      {/* Menus List */}
      {isLoading ? (
        <div className="text-muted-foreground">Loading menus...</div>
      ) : menus.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No menus yet</p>
          <Button onClick={handleCreateMenu}>Create First Menu</Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {menus.map((menu) => (
            <Card key={menu.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle>{menu.name}</CardTitle>
                  <CardDescription>
                    Created {new Date(menu.created_at).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge
                  variant={menu.status === "published" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {menu.status === "published" ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </>
                  ) : (
                    <>
                      <Circle className="w-3 h-3 mr-1" />
                      {menu.status}
                    </>
                  )}
                </Badge>
              </CardHeader>

              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {/* Edit Button - only for draft menus */}
                  {menu.status === "draft" && (
                    <Link href={`/app/venues/${venueId}/menus/${menu.id}/editor`}>
                      <Button variant="outline" size="sm">
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                  )}

                  {/* Duplicate Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicateMenu(menu)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </Button>

                  {/* Change Status Button */}
                  <Button
                    variant={menu.status === "published" ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleChangeStatus(menu)}
                  >
                    {menu.status === "published" ? "Deactivate" : "Activate"}
                  </Button>

                  {/* Delete Button - only for inactive menus */}
                  {menu.status !== "published" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteMenu(menu.id)}
                      disabled={deletingId === menu.id}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deletingId === menu.id ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
