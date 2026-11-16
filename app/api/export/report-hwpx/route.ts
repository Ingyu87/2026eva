import { jsonError, requireSchoolSession } from '@/lib/api';
import { canExport } from '@/lib/exportGate';
import { getDraftBundle, getSurveyResult } from '@/lib/store';
import { reportReadiness } from '@/lib/reportReadiness';
import { buildReportHwpx } from '@/lib/reportHwpx';

export async function GET(request:Request){
 const session=await requireSchoolSession();if('status' in session)return session;
 const {draft,items}=await getDraftBundle(session.schoolId,session.schoolName);
 const url=new URL(request.url),id=url.searchParams.get('resultId'),type=url.searchParams.get('type');
 if(!id||!['draft','submit'].includes(type??''))return jsonError('집계 결과를 선택한 뒤 작성용 또는 제출용 학교평가서를 내려받으세요.');
 const result=await getSurveyResult(draft.id,id);if(!result)return jsonError('집계 결과를 찾을 수 없습니다.',404);
 const gate=canExport('report-hwpx',draft,result);if(!gate.allowed)return jsonError(gate.reason!,403);
 if(type==='submit'){const issues=reportReadiness(result);if(issues.length)return jsonError(`제출 전 확인: ${issues.join(' ')} 작성용 HWPX를 내려받아 한글에서 보완할 수도 있습니다.`);}
 const buffer=await buildReportHwpx(draft,result.itemsSnapshot??items,result);
 const name=`학교평가서_${draft.schoolName.replace(/[<>:"/\\|?*]/g,'_')}_${type==='draft'?'작성용':'제출용'}.hwpx`;
 return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/hwp+zip','Cache-Control':'private, no-store','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`}});
}
