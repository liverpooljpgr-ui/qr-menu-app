import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Create ACME organization with unique slug
    const slug = `acme-${Date.now()}`;
    const { data: org, error: orgError } = await supabase.rpc("create_organization", {
      p_name: "ACME",
      p_slug: slug,
    });

    if (orgError) {
      console.error("Organization creation error:", orgError);
      return NextResponse.json(
        { error: "Failed to create organization: " + (orgError.message || "unknown error") },
        { status: 500 }
      );
    }

    if (!org || !org.id) {
      return NextResponse.json({ error: "Organization creation returned no ID" }, { status: 500 });
    }

    // Create a venue in the organization
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .insert({
        organization_id: org.id,
        name: "ACME Pizzeria",
        slug: "acme-pizzeria",
        currency: "USD",
      })
      .select()
      .single();

    if (venueError) {
      return NextResponse.json({ error: venueError.message }, { status: 500 });
    }

    // Create a menu
    const { data: menu, error: menuError } = await supabase
      .from("menus")
      .insert({
        venue_id: venue.id,
        name: "Main Menu",
        status: "draft",
      })
      .select()
      .single();

    if (menuError) {
      return NextResponse.json({ error: menuError.message }, { status: 500 });
    }

    // Create sections
    const { data: sections, error: sectionsError } = await supabase
      .from("menu_sections")
      .insert([
        {
          menu_id: menu.id,
          venue_id: venue.id,
          name: "Pizzas",
          position: 0,
          translations: {},
        },
        {
          menu_id: menu.id,
          venue_id: venue.id,
          name: "Appetizers",
          position: 1,
          translations: {},
        },
      ])
      .select();

    if (sectionsError) {
      return NextResponse.json({ error: sectionsError.message }, { status: 500 });
    }

    // Create a Margarita pizza item in Pizzas section
    const pizzasSection = sections?.[0];
    if (pizzasSection) {
      const { data: item, error: itemError } = await supabase
        .from("menu_items")
        .insert({
          section_id: pizzasSection.id,
          venue_id: venue.id,
          name: "Margarita Pizza",
          description: "Classic pizza with tomato, mozzarella, and basil",
          price_minor: 1299, // $12.99
          position: 0,
          is_available: true,
          photo_path: null,
          translations: {},
        })
        .select()
        .single();

      if (itemError) {
        console.error("Item creation error:", itemError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        organizationId: org.id,
        venueId: venue.id,
        menuId: menu.id,
        sections: sections,
      },
    });
  } catch (error) {
    console.error("Init error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
