import { jsonOk, requireAdminSession } from "@/lib/api";
import { listSchools } from "@/lib/store";

export async function GET() {
  const session = await requireAdminSession();
  if ("status" in session) {
    return session;
  }

  const schools = await listSchools();
  return jsonOk({ schools });
}
