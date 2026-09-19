import { jsonOk, requireAdminSession } from '@/lib/api';
import { operationalChecks } from '@/lib/operationalChecks';
import { getIndicatorTemplate } from '@/lib/store';

export async function GET() {
  const session = await requireAdminSession();
  if ('status' in session) return session;
  const checks = operationalChecks(process.env);
  let hasTemplate = false;
  try { hasTemplate = !!(await getIndicatorTemplate()); } catch { /* 저장소 미설정 안내로 처리 */ }
  return jsonOk({ checks: [...checks, {
    name: '교육청 XLSX 양식', configured: hasTemplate,
    next: '2026 교육청의 빈 양식을 아래에서 등록하고, 가상 결과로 내려받은 파일의 입력 칸과 합계 수식을 대조하세요.'
  }] });
}
