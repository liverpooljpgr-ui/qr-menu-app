import { OnboardingForm } from "@/components/app/onboarding-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppHomePage() {
  const supabase = await createClient();

  // RLS scopes both queries to the user's own organizations.
  const { data: memberships } = await supabase.from("memberships").select("organization_id");
  if (!memberships?.length) {
    return <OnboardingForm />;
  }

  // Redirect to venues page (menu management hub)
  redirect("/app/venues");
}
