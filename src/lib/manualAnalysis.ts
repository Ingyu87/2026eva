import { AREAS } from './evaluationFramework';
import type { AiAnalysis } from './types';

/** 빈칸은 담당자가 작성합니다. 관찰·성과를 임의 생성하지 않습니다. */
export function emptyManualAnalysis(): AiAnalysis {
  return {
    areas: AREAS.map(area => ({ area: area.name, findings: [
      { category: '우수한 점', subarea: area.subareas[0], indicator: '', content: '', cause: '', action: '', evidence: [] },
      { category: '개선할 점', subarea: area.subareas[0], indicator: '', content: '', cause: '', action: '', evidence: [] }
    ] })),
    consultingNeeds: [{ category: '컨설팅장학 등 교육청 지원이 필요한 부분', subarea: '', indicator: '', content: '', evidence: [] }],
    featuredCases: [], overallOpinion: ''
  };
}
