import { createAppIcon } from "@/lib/app-icon";

export async function GET() {
  return createAppIcon(192);
}
