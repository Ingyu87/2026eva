import { requireSchoolSession } from "@/lib/api";
import { buildSurveyHwpx, hwpxFileName } from "@/lib/hwpxExport";
import { getDraftBundle } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireSchoolSession();
  if ("status" in session) return session;
  const { draft, items } = await getDraftBundle(session.schoolId, session.schoolName);
  const buffer = await buildSurveyHwpx(draft, items);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/hwp+zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(hwpxFileName(draft))}`,
      "Cache-Control": "private, no-store"
    }
  });
}
