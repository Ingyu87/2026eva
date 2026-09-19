export type GuideStep = {
  id: string;
  title: string;
  /** 줄바꿈(\n)은 그대로 보입니다. */
  caption: string;
  /** 실제 화면 캡처. 없으면 글만 보입니다. `npm run guide:capture`로 다시 뽑습니다. */
  image?: string;
};

export type GuideVariant = "lead" | "builder";

/**
 * 연구부장용 도움말.
 * 그림은 실제 화면을 잘라 강조 표시를 붙인 것입니다. 화면이 바뀌면 캡처를 다시 뽑으세요.
 */
export const LEAD_GUIDE_STEPS: GuideStep[] = [
  {
    id: "flow",
    title: "진행 순서",
    caption:
      "1. 왼쪽 위 배지로 평가 시기(중간평가 / 학년말)를 확인합니다.\n2. 부장마다 링크를 만들어 보냅니다.\n3. 부장이 담은 문항은 이 화면에 그대로 모입니다. 연구부장도 같은 화면에서 문항을 담습니다.\n4. 영역별 문항 확인에서 누락을 확인하고 설문지를 내보냅니다.\n5. 응답을 받은 뒤 결과 분석에서 제출 서류를 만듭니다."
  },
  {
    id: "mode",
    title: "평가 시기",
    caption:
      "왼쪽 위 배지가 지금의 평가 시기입니다. 눌러서 중간평가와 학년말을 바꿉니다. 학년말 배지를 다시 누르면 중간평가 문항을 이어 쓸지 고르는 화면으로 돌아갑니다.",
    image: "/guide/lead-mode.png"
  },
  {
    id: "find",
    title: "문항 찾기",
    caption: "왼쪽에서 영역·지표를 고르거나, 가운데 위 검색창에 단어를 넣으면 문항이 좁혀집니다. / 키를 누르면 검색창으로 바로 갑니다.",
    image: "/guide/lead-find.png"
  },
  {
    id: "add",
    title: "담기",
    caption:
      "문항 카드 아래의 교원·학부모·학생·직원 칩을 누르면 그 대상에 담기고, 다시 누르면 빠집니다. 여러 대상에 담으면 대상마다 따로 담겨서 문장을 각각 고칠 수 있습니다.",
    image: "/guide/lead-add.png"
  },
  {
    id: "edit",
    title: "고치기",
    caption:
      "오른쪽 목록에서 연필(✎)을 눌러 문장·응답 유형·세부영역·담당부서를 고치고 완료를 누릅니다. 저장은 자동입니다.",
    image: "/guide/lead-edit.png"
  },
  {
    id: "coverage",
    title: "영역별 문항 확인",
    caption:
      "오른쪽 아래에서 Ⅰ·Ⅱ·Ⅲ 영역이 모두 초록이어야 합니다. 학생·학부모·교원 설문은 세 영역 문항이 모두 있어야 하고, 빠진 채 내보내면 확인 창이 뜹니다.",
    image: "/guide/lead-coverage.png"
  },
  {
    id: "invite",
    title: "부장 링크",
    caption:
      "위쪽 부장 링크(만든 뒤에는 부장 작업 n/m) 버튼을 누릅니다. 역할 이름을 적고 링크 만들기를 누른 뒤, 복사된 링크를 그 부장에게만 보내세요. 부장이 제출하면 여기에 제출함으로 바뀝니다.\n이 브라우저에서 링크를 열면 내 계정이 로그아웃되니, 확인은 시크릿 창에서 하세요. 잘못 보냈으면 끊기를 누릅니다.",
    image: "/guide/lead-invite.png"
  },
  {
    id: "export",
    title: "설문 내보내기",
    caption:
      "부장들이 제출하면 내보냅니다. 설문지(DOCX)는 인쇄용, Google Forms는 응답용입니다. 학생용 폼은 설정에서 학년을 먼저 고릅니다.",
    image: "/guide/lead-export.png"
  },
  {
    id: "analyze",
    title: "결과 분석",
    caption:
      "응답을 받은 뒤 가운데 탭의 결과 분석 · 내보내기로 갑니다. 대상별 응답 엑셀을 올리세요. 현재 평가 시기에 맞는 응답 파일을 올리세요. 중간평가 결과는 교내 결과 보고서로 활용할 수 있습니다.",
    image: "/guide/lead-analyze.png"
  },
  {
    id: "mapping",
    title: "응답 열과 문항 연결",
    caption: "자동으로 못 찾은 열만 문항을 골라 줍니다. 그대로 두면 그 열은 집계에서 빠집니다."
  },
  {
    id: "docs",
    title: "제출 서류",
    caption:
      "설문 결과 보고서(HTML)는 중간평가에서도 만들 수 있습니다. 평가지표 및 현황(XLSX)과 학교평가서(DOCX)는 학년말 결과로 만듭니다. 중간평가 결과로는 학교평가서를 만들지 않습니다. (가이드북 Q12)"
  },
  {
    id: "stuck",
    title: "막혔을 때",
    caption:
      "\"다른 사람이 먼저 수정했습니다\"가 뜨면 내 수정과 상대 수정 중 남길 쪽을 고릅니다.\n부장이 링크가 안 열린다고 하면 부장 작업에서 끊긴 링크가 아닌지 보고, 새 링크를 만들어 주세요."
  }
];

/** 일반 부장용 도움말. 연구부장이 준 링크로 들어와 문항만 다룹니다. */
export const BUILDER_GUIDE_STEPS: GuideStep[] = [
  {
    id: "link",
    title: "링크로 들어오기",
    caption:
      "연구부장에게 받은 링크를 열면 로그인 없이 이 화면이 열립니다. 왼쪽 위에 내 역할 이름이 보입니다. 나가더라도 같은 링크를 다시 열면 이어서 할 수 있습니다. 링크는 다른 사람에게 넘기지 마세요.",
    image: "/guide/builder-enter.png"
  },
  {
    id: "find",
    title: "문항 찾기",
    caption: "왼쪽에서 영역·지표를 고르거나, 가운데 위 검색창에 단어를 넣으면 문항이 좁혀집니다.",
    image: "/guide/builder-find.png"
  },
  {
    id: "add",
    title: "담기",
    caption:
      "문항 카드 아래의 칩을 누르면 그 대상에 담기고, 다시 누르면 빠집니다. 링크에 대상이 정해져 있으면 그 대상 탭만 보입니다.",
    image: "/guide/builder-add.png"
  },
  {
    id: "owners",
    title: "내 문항과 남의 문항",
    caption:
      "오른쪽 카드 위의 이름이 그 문항을 담은 사람입니다. 내가 담은 문항만 고치고 지우고 옮길 수 있고, 다른 사람이 담은 문항(회색)은 잠겨 있습니다. 바꾸고 싶으면 연구부장에게 요청하세요.",
    image: "/guide/builder-owners.png"
  },
  {
    id: "edit",
    title: "고치기",
    caption: "내 문항의 연필(✎)을 눌러 문장·응답 유형을 고치고 완료를 누릅니다. 저장은 자동입니다.",
    image: "/guide/lead-edit.png"
  },
  {
    id: "submit",
    title: "제출하기",
    caption:
      "다 담았으면 위쪽 제출을 누르세요. 연구부장 화면에 제출함으로 표시됩니다. 제출한 뒤에 문항을 고치면 다시 작성 중으로 돌아가니, 고친 뒤에 한 번 더 제출하세요.",
    image: "/guide/builder-submit.png"
  },
  {
    id: "stuck",
    title: "막혔을 때",
    caption:
      "링크가 열리지 않거나 화면에서 나갔다면 받은 링크를 다시 여세요. 그래도 안 되면 연구부장에게 새 링크를 요청하세요.\n\"다른 사람이 먼저 수정했습니다\"가 뜨면 내 수정과 상대 수정 중 남길 쪽을 고르면 됩니다."
  }
];

export function getGuideSteps(variant: GuideVariant): GuideStep[] {
  return variant === "builder" ? BUILDER_GUIDE_STEPS : LEAD_GUIDE_STEPS;
}
