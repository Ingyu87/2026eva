export type GuideHighlight = {
  top: string;
  left: string;
  width: string;
  height: string;
};

export type GuideStep = {
  id: string;
  title: string;
  caption: string;
  image: string;
  highlight: GuideHighlight;
};

export type GuideVariant = "lead" | "builder";

/** 연구부장용 도움말 장면. 글은 짧게, 어디를 누르는지는 캡처 위 표시로 보여 줍니다. */
export const LEAD_GUIDE_STEPS: GuideStep[] = [
  {
    id: "mode",
    title: "평가 시기",
    caption: "왼쪽 위 배지로 시기를 바꿉니다. 학년말 배지를 다시 누르면 선택 화면으로 돌아갑니다.",
    image: "/guide/01-workspace.svg",
    highlight: { top: "2%", left: "10%", width: "8%", height: "6%" }
  },
  {
    id: "find",
    title: "문항 찾기",
    caption: "왼쪽에서 영역·지표를 고르거나, 가운데 위에 검색어를 넣습니다.",
    image: "/guide/01-workspace.svg",
    highlight: { top: "17%", left: "1%", width: "24%", height: "80%" }
  },
  {
    id: "add",
    title: "담기",
    caption: "문항 카드의 교원·학부모·학생·직원 칩을 누르면 그 대상에 담기고, 다시 누르면 빠집니다.",
    image: "/guide/01-workspace.svg",
    highlight: { top: "26%", left: "27%", width: "36%", height: "20%" }
  },
  {
    id: "edit",
    title: "고치기",
    caption: "오른쪽 목록에서 문항을 연 뒤 문장·응답 유형·담당부서를 고치고 완료를 누릅니다.",
    image: "/guide/02-edit.svg",
    highlight: { top: "10%", left: "65%", width: "34%", height: "88%" }
  },
  {
    id: "invite",
    title: "부장 링크",
    caption: "톱니(⚙) > 부장 링크에서 역할 이름을 적고 링크 만들기를 누릅니다. 복사된 링크를 그 부장에게만 보내세요. 링크를 받은 사람은 문항 구성만 열립니다. 잘못 보냈으면 끊기를 누릅니다.",
    image: "/guide/05-invite.svg",
    highlight: { top: "20%", left: "44%", width: "7%", height: "4%" }
  },
  {
    id: "export",
    title: "설문 내보내기",
    caption: "설문지(DOCX)는 인쇄용, Google Forms는 응답용입니다. 학생용 폼은 설정에서 학년을 먼저 고릅니다.",
    image: "/guide/01-workspace.svg",
    highlight: { top: "2%", left: "75%", width: "23%", height: "6%" }
  },
  {
    id: "analyze",
    title: "결과 분석",
    caption: "가운데 탭에서 결과 분석으로 갑니다. 학년말 응답 엑셀을 대상별로 올립니다. 중간평가 때 받은 파일은 쓰지 마세요.",
    image: "/guide/03-analyze.svg",
    highlight: { top: "2%", left: "44%", width: "8%", height: "6%" }
  },
  {
    id: "mapping",
    title: "열 연결",
    caption: "자동으로 못 찾은 열만 문항을 골라 줍니다. 그대로 두면 그 열은 집계에서 빠집니다.",
    image: "/guide/03-analyze.svg",
    highlight: { top: "32%", left: "1%", width: "98%", height: "34%" }
  },
  {
    id: "docs",
    title: "제출 서류",
    caption: "학년말에서만 열립니다. 중간평가 결과로는 학교평가서를 만들지 않습니다. (가이드북 Q12)",
    image: "/guide/03-analyze.svg",
    highlight: { top: "68%", left: "1%", width: "98%", height: "30%" }
  }
];

/** 일반 부장용 도움말 장면. 연구부장이 준 링크로 들어와 문항만 다룹니다. */
export const BUILDER_GUIDE_STEPS: GuideStep[] = [
  {
    id: "link",
    title: "링크로 들어오기",
    caption: "연구부장에게 받은 링크를 열면 로그인 없이 문항 구성 화면이 열립니다. 왼쪽 위에 내 역할 이름이 보입니다. 링크는 다른 사람에게 넘기지 마세요.",
    image: "/guide/04-builder-workspace.svg",
    highlight: { top: "2%", left: "10%", width: "8%", height: "6%" }
  },
  {
    id: "find",
    title: "문항 찾기",
    caption: "왼쪽에서 영역·지표를 고르거나, 가운데 위에 검색어를 넣습니다.",
    image: "/guide/04-builder-workspace.svg",
    highlight: { top: "17%", left: "1%", width: "24%", height: "80%" }
  },
  {
    id: "add",
    title: "담기",
    caption: "문항 카드의 대상 칩을 누르면 그 대상에 담기고, 다시 누르면 빠집니다. 대상이 정해진 링크는 그 대상 탭만 보입니다.",
    image: "/guide/04-builder-workspace.svg",
    highlight: { top: "26%", left: "27%", width: "36%", height: "20%" }
  },
  {
    id: "edit",
    title: "고치기",
    caption: "오른쪽 목록에서 문항을 연 뒤 문장·응답 유형·담당부서를 고치고 완료를 누릅니다. 다른 사람이 먼저 고쳤으면 알려 줍니다.",
    image: "/guide/02-edit.svg",
    highlight: { top: "10%", left: "65%", width: "34%", height: "88%" }
  },
  {
    id: "done",
    title: "끝난 뒤",
    caption: "저장은 자동입니다. 위쪽에 저장됨이 보이면 창을 닫아도 됩니다. 설문 시기, 결과 분석, 서류는 연구부장이 맡습니다.",
    image: "/guide/04-builder-workspace.svg",
    highlight: { top: "2%", left: "75%", width: "23%", height: "6%" }
  }
];

export function getGuideSteps(variant: GuideVariant): GuideStep[] {
  return variant === "builder" ? BUILDER_GUIDE_STEPS : LEAD_GUIDE_STEPS;
}
