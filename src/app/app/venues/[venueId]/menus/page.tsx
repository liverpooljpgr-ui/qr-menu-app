"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { VenueSettingsForm, type VenueSettings } from "@/components/venue/venue-settings-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  Edit2,
  Trash2,
  Copy,
  CheckCircle,
  Circle,
  Globe,
  EyeOff,
  ExternalLink,
} from "lucide-react";

interface Menu {
  id: string;
  name: string;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

type Tab = "venue" | "menus";

export default function MenusPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const venueId = params.venueId as string;
  const supabase = createClient();

  const tab: Tab = searchParams.get("tab") === "menus" ? "menus" : "venue";
  const setTab = (next: string) => {
    router.replace(`/app/venues/${venueId}/menus?tab=${next}`, { scroll: false });
  };

  const [venue, setVenue] = useState<VenueSettings | null>(null);
  const [venueMissing, setVenueMissing] = useState(false);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [pendingPublish, setPendingPublish] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);

  useEffect(() => {
    loadVenue();
    loadMenus();
  }, [venueId]);

  const loadVenue = async () => {
    const [{ data }, { data: branding }] = await Promise.all([
      supabase
        .from("venues")
        .select("id, name, slug, currency, timezone, default_locale")
        .eq("id", venueId)
        .maybeSingle(),
      supabase.from("brandings").select("logo_path").eq("venue_id", venueId).maybeSingle(),
    ]);

    setVenue(data);
    setVenueMissing(!data);
    setLogoPath(branding?.logo_path ?? null);
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
            is_active: s.is_active,
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
                  is_active: item.is_active,
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

  const currentlyPublished = menus.find((m) => m.status === "published") ?? null;

  const publishMenu = async (menu: Menu) => {
    setPublishingId(menu.id);
    setError(null);
    const { error } = await supabase.rpc("publish_menu", { p_menu_id: menu.id });
    if (error) {
      setError(error.message);
    } else {
      await loadMenus();
    }
    setPublishingId(null);
  };

  const handlePublish = (menu: Menu) => {
    if (currentlyPublished && currentlyPublished.id !== menu.id) {
      setPendingPublish(menu);
      return;
    }
    void publishMenu(menu);
  };

  const confirmReplacePublish = async () => {
    const menu = pendingPublish;
    setPendingPublish(null);
    if (menu) await publishMenu(menu);
  };

  const handleUnpublish = async (menu: Menu) => {
    if (!confirm("Unpublish this menu? Guests will no longer be able to see it.")) return;

    setPublishingId(menu.id);
    setError(null);
    const { error } = await supabase.rpc("unpublish_menu", { p_menu_id: menu.id });
    if (error) {
      setError(error.message);
    } else {
      await loadMenus();
    }
    setPublishingId(null);
  };

  if (venueMissing) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">Venue not found, or you don&apos;t have access to it.</p>
        <Link href="/app/venues">
          <Button variant="outline" size="sm">
            <ChevronLeft className="w-4 h-4" />
            Back to venues
          </Button>
        </Link>
      </div>
    );
  }

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
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{venue.name}</h1>
          <p className="text-sm text-muted-foreground">Manage venue</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="venue">Venue</TabsTrigger>
          <TabsTrigger value="menus">Menus</TabsTrigger>
        </TabsList>

        <TabsContent value="venue" className="pt-4">
          <VenueSettingsForm
            venue={venue}
            logoPath={logoPath}
            onVenueChange={setVenue}
            onLogoChange={setLogoPath}
          />
        </TabsContent>

        <TabsContent value="menus" className="pt-4 flex flex-col gap-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

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
                        {menu.status === "published" && menu.published_at
                          ? `Published ${new Date(menu.published_at).toLocaleString()}`
                          : `Created ${new Date(menu.created_at).toLocaleDateString()}`}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={menu.status === "published" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {menu.status === "published" ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Published
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
                      <Link href={`/app/venues/${venueId}/menus/${menu.id}/editor`}>
                        <Button variant="outline" size="sm">
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </Link>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicateMenu(menu)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handlePublish(menu)}
                        disabled={publishingId === menu.id}
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        {publishingId === menu.id
                          ? "Publishing..."
                          : menu.status === "published"
                            ? "Republish"
                            : "Publish"}
                      </Button>

                      {menu.status === "published" && (
                        <>
                          <a
                            href={`/m/${venue.slug}?menu=${menu.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Guest view
                            </Button>
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnpublish(menu)}
                            disabled={publishingId === menu.id}
                          >
                            <EyeOff className="w-4 h-4 mr-2" />
                            Unpublish
                          </Button>
                        </>
                      )}

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
        </TabsContent>
      </Tabs>

      <Dialog
        open={pendingPublish !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPublish(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace the published menu?</DialogTitle>
            <DialogDescription>
              Only one menu can be published at a time. Publishing &ldquo;
              {pendingPublish?.name}&rdquo; will hide &ldquo;{currentlyPublished?.name}
              &rdquo; from guests immediately. You can publish it again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPublish(null)}>
              Cancel
            </Button>
            <Button onClick={confirmReplacePublish}>
              <Globe className="w-4 h-4 mr-2" />
              Publish &ldquo;{pendingPublish?.name}&rdquo; and hide &ldquo;
              {currentlyPublished?.name}&rdquo;
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
