// Verifies the anonymous (publishable-key) surface is exactly what the RLS design intends:
// readable: current menu_publications + the guest RPCs. Everything else must be closed.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
}

const membersOnlyTables = [
  "organizations", "memberships", "venues", "brandings", "menus", "menu_sections",
  "menu_items", "option_groups", "option_choices", "tables", "guest_sessions", "events",
];

// 1. Members-only tables must not return rows to anon (error or empty both acceptable).
for (const table of membersOnlyTables) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  const leaked = Array.isArray(data) && data.length > 0;
  check(`anon cannot read ${table}`, !leaked, error ? `${error.code}: ${error.message}` : `rows=${data?.length ?? 0}`);
}

// 2. Anon cannot write to any table directly (guest analytics go through RPCs).
{
  const { error } = await supabase
    .from("events")
    .insert({ venue_id: "00000000-0000-0000-0000-000000000000", event_type: "probe" });
  check("anon cannot insert into events directly", !!error, error ? `${error.code}: ${error.message}` : "insert succeeded");
}

// 3. Current publications are readable (empty for now, but must not error).
{
  const { data, error } = await supabase.from("menu_publications").select("id").limit(1);
  check("anon can read menu_publications", !error && Array.isArray(data), error ? `${error.code}: ${error.message}` : `rows=${data.length}`);
}

// 4. Guest lookup RPCs are callable and return nothing for bogus inputs.
{
  const { data, error } = await supabase.rpc("resolve_qr_token", { p_token: "bogus-token" });
  check("resolve_qr_token callable, empty for bogus token", !error && data.length === 0, error ? `${error.code}: ${error.message}` : `rows=${data.length}`);
}
{
  const { data, error } = await supabase.rpc("resolve_venue_slug", { p_slug: "bogus-slug" });
  check("resolve_venue_slug callable, empty for bogus slug", !error && data.length === 0, error ? `${error.code}: ${error.message}` : `rows=${data.length}`);
}

// 5. Guest write RPCs reject invalid entry points / sessions.
{
  const { error } = await supabase.rpc("start_guest_session", { p_token: "bogus-token" });
  check("start_guest_session rejects bogus token", !!error, error ? error.message : "session created");
}
{
  const { error } = await supabase.rpc("log_event", {
    p_session_id: "00000000-0000-0000-0000-000000000000",
    p_event_type: "probe",
  });
  check("log_event rejects unknown session", !!error, error ? error.message : "event logged");
}

// 6. Member-only RPCs are not executable anonymously.
{
  const { error } = await supabase.rpc("create_organization", { p_name: "x", p_slug: "x" });
  check("anon cannot call create_organization", !!error, error ? `${error.code}: ${error.message}` : "call succeeded");
}
{
  const { error } = await supabase.rpc("publish_menu", { p_menu_id: "00000000-0000-0000-0000-000000000000" });
  check("anon cannot call publish_menu", !!error, error ? `${error.code}: ${error.message}` : "call succeeded");
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.detail})`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exitCode = 1;
