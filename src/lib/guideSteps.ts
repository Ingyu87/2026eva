export type GuideStep = {
  id: string;
  title: string;
  /** 줄바꿈(\n)은 그대로 보입니다. */
  caption: string;
  /** 실제 화면 캡처. 화면이 바뀌면 가상 학교로 다시 캡처합니다. */
  image?: string;
};

export type GuideVariant = "lead" | "builder";

/**
 * 연구부장용 도움말.
 * 그림은 가상 학교로 실제 작업 화면을 캡처한 것입니다. 화면이 바뀌면 캡처를 다시 뽑으세요.
 */
export const LEAD_GUIDE_STEPS: GuideStep[] = [
  {
    id: "roles",
    title: "부장 접속 방법",
    caption: "연구부장은 학교 계정으로 로그인하고, 부장에게는 ‘부장 링크’에서 만든 개별 링크를 보내세요. 학교 계정 비밀번호는 공유하지 마세요.\n부장은 받은 링크에서 문항을 작성하고 제출합니다."
  },
  { id: "display", title: "글자 크기·열 너비", caption: "상단 ‘글자’ 옆 − / +를 눌러 글자 크기를 조절하세요. 화면의 열 사이 경계를 끌면 너비가 바뀌고, 경계를 두 번 누르면 원래 너비로 돌아갑니다." },
  { id: "intro", title: "설문 안내문 수정", caption: "‘설문 설정 → 안내문’에서 응답 대상을 선택하고 내용을 수정하세요. 수정한 내용은 자동으로 저장됩니다." },
  {
    id: "prior-survey",
    title: "작년 설문 가져오기",
    caption: "‘작년 설문지 올리기’에서 대상별 PDF를 최대 4개 선택하세요. 추출한 문항·보기·응답 유형을 원본과 대조한 뒤 사용할 문항을 선택하세요.\n응답 결과나 개인정보가 포함된 파일은 올리지 마세요."
  },
  {
    id: "flow",
    title: "설문 작성 순서",
    caption:
      "평가 시기를 선택하고 대상별 문항을 작성하세요. 부장과 나누어 작성하려면 개별 링크를 보내세요.\n문항 검토가 끝나면 설문지를 내려받거나 Google Forms를 만드세요. 응답을 받은 뒤에는 ‘결과 분석’에서 보고서를 작성합니다."
  },
  {
    id: "mode",
    title: "평가 시기·학생 학년",
    caption:
      "‘설문 설정 → 설문 정보’에서 중간평가 또는 학년말 학교평가를 선택하세요. 학생용 Google Forms를 만들 때는 설문에 참여할 학년도 선택해야 합니다."
  },
  {
    id: "find",
    title: "문항 검색",
    caption: "왼쪽에서 영역·지표를 선택하거나 검색창에 단어를 입력하세요. / 키를 누르면 검색창으로 이동합니다."
  },
  {
    id: "add",
    title: "문항 추가",
    caption:
      "응답 대상을 선택하고 문항의 ‘담기’를 누르세요. 선택한 문항은 오른쪽 목록에 추가됩니다. 다시 누르면 목록에서 빠집니다."
  },
  {
    id: "edit",
    title: "문항 수정",
    caption:
      "오른쪽 목록에서 ‘수정’을 눌러 문장·응답 유형·세부영역을 고친 뒤 ‘완료’를 누르세요. AI가 추천한 분류와 유형도 확인해 주세요. 수정한 내용은 자동으로 저장됩니다."
  },
  {
    id: "coverage",
    title: "영역별 문항 확인",
    caption:
      "학생·학부모·교원 설문에는 Ⅰ·Ⅱ·Ⅲ 영역의 문항이 모두 필요합니다. 오른쪽 아래 ‘영역별 문항 확인’에서 빠진 영역을 확인하세요."
  },
  {
    id: "invite",
    title: "부장 링크 관리",
    caption:
      "상단 ‘부장 링크’에서 이름과 응답 대상을 입력해 링크를 만드세요. 부장에게 각자의 링크를 보내면 이곳에서 제출 여부를 확인할 수 있습니다.\n링크를 시험하려면 시크릿 창에서 여세요. 현재 창에서 열면 학교 계정에서 로그아웃됩니다. 잘못 보낸 링크는 ‘끊기’로 사용을 중단할 수 있습니다."
  },
  {
    id: "export",
    title: "설문지·구글폼 만들기",
    caption:
      "검토한 문항을 파일로 받으려면 상단 ‘설문지 (DOCX)’ 또는 ‘한글 (HWPX)’을 누르세요. 온라인 설문은 ‘Google Forms’에서 만듭니다.\n학생용은 설문 학년을 먼저 선택하세요. 생성된 폼의 문항을 확인한 뒤 응답용 주소를 배포하세요."
  },
  {
    id: "analyze",
    title: "응답 파일 올리기",
    caption:
      "‘결과 분석’에서 학생·학부모·교원·직원 응답 파일을 각각 올리세요. CSV 또는 엑셀(XLSX)을 사용할 수 있습니다. 이름·이메일·연락처 열은 미리 삭제하세요."
  },
  {
    id: "mapping",
    title: "문항 연결·점수 집계",
    caption: "파일의 질문과 연결된 설문 문항이 같은지 확인하세요. 연결되지 않은 질문은 문항을 직접 선택하고, 응답 시각 등은 집계에서 제외하세요. 학생 학년 열은 학년 문항으로 지정합니다.\n‘점수 집계하기’를 누르면 올린 대상의 결과를 함께 집계합니다."
  },
  {
    id: "write", title: "평가 의견 작성",
    caption: "‘4. 의견’에서 ‘AI로 평가 의견 초안 작성’을 누르면 집계 결과를 참고해 초안을 만듭니다. 실제 학교 활동을 추가로 입력하면 초안 작성에 참고합니다.\n초안을 검토·수정하고 ‘수정 내용 저장’을 누르세요. AI를 사용하지 않으려면 ‘직접 작성’을 선택하세요."
  },
  {
    id: "review", title: "검토 기록 저장",
    caption: "‘검토 기록’에 집계 이름과 검토 내용을 적고 저장하세요. 기록은 학교 내부용이며 제출 문서에는 들어가지 않습니다. 평가 의견을 다시 저장하면 확인 항목이 해제되므로 재검토하세요."
  },
  {
    id: "hwp", title: "한글 파일 편집",
    caption: "‘5. 문서’에서 ‘학교평가서 작성용 (HWPX)’을 내려받아 한글에서 여세요. 응답 자료나 의견이 없는 항목은 빈칸으로 표시됩니다.\n한글에서 수정한 내용은 앱에 반영되지 않습니다. 수정한 파일은 따로 보관하세요."
  },
  {
    id: "docs",
    title: "보고서 내려받기",
    caption:
      "HTML은 교내 공유용, HWPX는 교육청 양식의 학교평가서입니다. 학교평가서는 학년말 결과로만 만들 수 있습니다.\n제출용 버튼을 누를 수 없다면 ‘제출 전 확인할 내용’을 펼쳐 누락된 응답이나 의견을 확인하세요."
  },
  {
    id: "stuck",
    title: "접속·저장 오류",
    caption:
      "다른 사람이 먼저 수정했다는 안내가 나오면 두 내용을 비교해 저장할 내용을 선택하세요.\n부장 링크가 열리지 않으면 ‘부장 링크’에서 사용 중단 여부를 확인하고 필요하면 새 링크를 보내세요."
  }
];

/** 일반 부장용 도움말. 연구부장이 준 링크로 들어와 문항만 다룹니다. */
export const BUILDER_GUIDE_STEPS: GuideStep[] = [
  {
    id: "link",
    title: "부장 링크 접속",
    caption:
      "연구부장에게 받은 링크로 접속하세요. 같은 링크를 다시 열면 작성하던 문항을 이어서 수정할 수 있습니다. 링크는 다른 사람에게 공유하지 마세요."
  },
  {
    id: "find",
    title: "문항 검색",
    caption: "검색창에 담당 업무와 관련된 단어를 입력하세요. 필요한 문항이 없으면 ‘직접 문항 작성’을 누르세요. 영역 분류는 연구부장이 지정합니다."
  },
  {
    id: "add",
    title: "문항 추가",
    caption:
      "응답 대상을 선택하고 문항의 ‘담기’를 누르세요. 문항이 오른쪽 목록에 추가됩니다. 다시 누르면 목록에서 빠집니다. 링크에 응답 대상이 지정되어 있으면 해당 대상만 선택할 수 있습니다."
  },
  {
    id: "owners",
    title: "다른 부장의 문항 수정",
    caption:
      "같은 학교의 문항 중 담당 업무에 해당하는 문항을 수정할 수 있습니다. 같은 문항을 동시에 수정하면 두 내용을 비교해 저장할 내용을 선택하세요."
  },
  {
    id: "edit",
    title: "문항 수정",
    caption: "문항의 ‘수정’을 눌러 문장과 응답 유형을 고친 뒤 ‘완료’를 누르세요. 수정한 내용은 자동으로 저장됩니다."
  },
  {
    id: "submit",
    title: "문항 제출",
    caption:
      "문항 작성을 마쳤으면 상단 ‘제출’을 누르세요. 제출 후 문항을 수정하면 작성 중으로 바뀌므로 다시 제출해야 합니다."
  },
  {
    id: "stuck",
    title: "접속·저장 오류",
    caption:
      "접속이 끊기면 받은 링크를 다시 여세요. 링크가 열리지 않으면 연구부장에게 새 링크를 요청하세요.\n다른 사람이 먼저 수정했다는 안내가 나오면 두 내용을 비교해 저장할 내용을 선택하세요."
  }
];

export function getGuideSteps(variant: GuideVariant): GuideStep[] {
  const images: Record<string, string> = variant === "builder" ? {
    link: "builder-work", find: "builder-find", add: "builder-find", owners: "builder-work",
    edit: "builder-edit", submit: "builder-submit", stuck: "builder-work"
  } : {
    roles: "builder-work", "prior-survey": "prior", flow: "workspace", mode: "settings", find: "find", add: "find",
    edit: "edit", coverage: "workspace", invite: "invite", export: "workspace", analyze: "results",
    mapping: "mapping", write: "opinion", review: "review", hwp: "docs", docs: "docs", stuck: "workspace",
    intro: "intro", display: "workspace"
  };
  return (variant === "builder" ? BUILDER_GUIDE_STEPS : LEAD_GUIDE_STEPS)
    .map(step => ({ ...step, image: variant === 'lead' && ['analyze', 'write', 'hwp', 'docs'].includes(step.id) ? undefined : `/guide/current-${images[step.id]}.png` }));
}
