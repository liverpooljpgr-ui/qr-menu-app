import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
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

// Set exitCode rather than calling process.exit(): exiting mid-teardown of the
// client's sockets trips a libuv assertion on Windows and corrupts the status.
if (connected) {
  console.log("Supabase connection successful");
} else {
  console.error("Supabase connection failed:", error);
  process.exitCode = 1;
}
