import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

// Node 20 has no native WebSocket global, which supabase-js needs to
// initialize its (unused here) realtime client. Node 22+ or a browser
// don't need this.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { realtime: { transport: ws } }
);

// Querying a table that doesn't exist still proves the connection works:
// PostgREST only returns this error after accepting our key and looking
// the table up, so anything other than a "not found" error means the
// request never actually reached Supabase.
const { error } = await supabase
  .from("__connection_check__")
  .select("*")
  .limit(1);

const connected = error?.code === "PGRST205" || error?.code === "42P01";

if (connected) {
  console.log("Supabase connection successful");
  process.exit(0);
} else {
  console.error("Supabase connection failed:", error);
  process.exit(1);
}
