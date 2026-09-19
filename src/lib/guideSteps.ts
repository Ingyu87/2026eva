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

/** 도움말 팝업 장면. 글은 짧게, 어디를 누르는지는 캡처 위 표시로 보여 줍니다. */
export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "mode",
    title: "평가 시기",
    caption: "왼쪽 위 배지로 시기를 바꿉니다. 학년말로 바꾸면 중간평가 문항이 남습니다. 이어서 쓸지, 비우고 다시 고를지 고릅니다.",
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
