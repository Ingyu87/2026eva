import { mkdirSync, writeFileSync } from "fs";

mkdirSync("public/guide", { recursive: true });

const workspace = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 820" fill="none">
  <rect width="1440" height="820" fill="#EEF0F9"/>
  <rect x="16" y="16" width="1408" height="56" rx="16" fill="#fff"/>
  <text x="36" y="50" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="16" font-weight="700">예시초등학교</text>
  <rect x="158" y="30" width="72" height="28" rx="14" fill="#F5F6FA"/>
  <text x="168" y="49" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="12">중간평가</text>
  <rect x="560" y="28" width="88" height="32" rx="16" fill="#4341C4"/>
  <text x="574" y="49" fill="#fff" font-family="Malgun Gothic, sans-serif" font-size="13" font-weight="700">문항 구성</text>
  <text x="666" y="49" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="13">결과 분석</text>
  <rect x="1088" y="28" width="110" height="32" rx="16" fill="#F5F6FA"/>
  <text x="1100" y="49" fill="#333340" font-family="Malgun Gothic, sans-serif" font-size="13">설문지 (DOCX)</text>
  <rect x="1208" y="28" width="130" height="32" rx="16" fill="#4341C4"/>
  <text x="1224" y="49" fill="#fff" font-family="Malgun Gothic, sans-serif" font-size="13" font-weight="700">Google Forms</text>
  <rect x="16" y="84" width="1408" height="44" rx="12" fill="#fff"/>
  <text x="40" y="112" fill="#4341C4" font-family="Malgun Gothic, sans-serif" font-size="14" font-weight="700">교원 1</text>
  <text x="120" y="112" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="14">학부모 0</text>
  <text x="210" y="112" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="14">학생 0</text>
  <text x="280" y="112" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="14">직원 0</text>
  <rect x="16" y="140" width="340" height="664" rx="16" fill="#fff"/>
  <text x="36" y="172" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="15" font-weight="700">평가지표</text>
  <text x="36" y="210" fill="#4341C4" font-family="Malgun Gothic, sans-serif" font-size="13" font-weight="700">I. 협력적 학교자치문화</text>
  <text x="48" y="240" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="13">I-1. 소통과 협력의 학교자치</text>
  <text x="60" y="270" fill="#4341C4" font-family="Malgun Gothic, sans-serif" font-size="13">학교 비전 공유 및 실현</text>
  <text x="60" y="300" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="13">학교자율운영체제 내실화</text>
  <text x="36" y="340" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="13" font-weight="700">II. 교육과정 운영 및 교수·학습</text>
  <text x="36" y="380" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="13" font-weight="700">III. 교육 활동 및 교육 성과</text>
  <rect x="368" y="140" width="560" height="664" rx="16" fill="#fff"/>
  <rect x="388" y="160" width="520" height="40" rx="12" fill="#F5F6FA"/>
  <text x="404" y="186" fill="#9AA0B0" font-family="Malgun Gothic, sans-serif" font-size="13">문항 검색 (단축키 /)</text>
  <rect x="388" y="216" width="520" height="150" rx="12" stroke="#4341C4" stroke-width="2"/>
  <text x="408" y="244" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="12">학교 비전 공유 및 실현</text>
  <text x="408" y="272" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="14">학교 구성원의 소통과 협력을 바탕으로 학교 비전을 공유하고 있다.</text>
  <rect x="408" y="292" width="48" height="26" rx="13" fill="#4341C4"/>
  <text x="418" y="310" fill="#fff" font-family="Malgun Gothic, sans-serif" font-size="12">교원</text>
  <rect x="464" y="292" width="56" height="26" rx="13" fill="#F5F6FA"/>
  <text x="472" y="310" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="12">학부모</text>
  <rect x="528" y="292" width="48" height="26" rx="13" fill="#F5F6FA"/>
  <text x="538" y="310" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="12">학생</text>
  <rect x="584" y="292" width="48" height="26" rx="13" fill="#F5F6FA"/>
  <text x="594" y="310" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="12">직원</text>
  <rect x="388" y="382" width="520" height="110" rx="12" fill="#F5F6FA"/>
  <text x="408" y="414" fill="#333340" font-family="Malgun Gothic, sans-serif" font-size="14">우리 학교는 교육공동체와 소통하며 교육활동을 운영하고 있다.</text>
  <rect x="940" y="140" width="484" height="664" rx="16" fill="#fff"/>
  <text x="960" y="176" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="15" font-weight="700">교원용 1</text>
  <rect x="960" y="196" width="444" height="120" rx="12" fill="#F5F6FA"/>
  <text x="980" y="224" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="12">1  학교 비전 공유 및 실현</text>
  <text x="980" y="252" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="14">학교 구성원의 소통과 협력을 바탕으로 학교 비전을 공유하고 있다.</text>
  <text x="980" y="284" fill="#9AA0B0" font-family="Malgun Gothic, sans-serif" font-size="12">매우 그렇다 · 그렇다 · 보통이다 · 그렇지 않다 · 전혀 그렇지 않다</text>
</svg>`;

const edit = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 820" fill="none">
  <rect width="1440" height="820" fill="#EEF0F9"/>
  <rect x="16" y="16" width="1408" height="56" rx="16" fill="#fff"/>
  <text x="36" y="50" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="16" font-weight="700">예시초등학교</text>
  <rect x="940" y="84" width="484" height="720" rx="16" fill="#fff" stroke="#4341C4" stroke-width="2"/>
  <text x="960" y="120" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="15" font-weight="700">교원용 1</text>
  <text x="960" y="156" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="12">1  학교 비전 공유 및 실현</text>
  <rect x="960" y="176" width="444" height="88" rx="12" fill="#F5F6FA"/>
  <text x="976" y="208" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="14">학교 구성원의 소통과 협력을 바탕으로</text>
  <text x="976" y="232" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="14">학교 비전을 공유하고 있다.</text>
  <rect x="960" y="280" width="88" height="28" rx="8" fill="#4341C4"/>
  <text x="972" y="299" fill="#fff" font-family="Malgun Gothic, sans-serif" font-size="12">5점 척도</text>
  <rect x="1056" y="280" width="88" height="28" rx="8" fill="#F5F6FA"/>
  <text x="1068" y="299" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="12">3점 척도</text>
  <rect x="1152" y="280" width="100" height="28" rx="8" fill="#F5F6FA"/>
  <text x="1162" y="299" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="12">예 / 아니오</text>
  <rect x="960" y="324" width="444" height="36" rx="8" fill="#F5F6FA"/>
  <text x="976" y="347" fill="#9AA0B0" font-family="Malgun Gothic, sans-serif" font-size="13">담당부서 (선택)</text>
  <rect x="960" y="376" width="72" height="36" rx="18" fill="#4341C4"/>
  <text x="980" y="399" fill="#fff" font-family="Malgun Gothic, sans-serif" font-size="14" font-weight="700">완료</text>
  <rect x="16" y="84" width="908" height="720" rx="16" fill="#fff"/>
  <text x="40" y="120" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="13">가운데 문항을 담은 뒤, 오른쪽에서 고칩니다.</text>
  <rect x="40" y="148" width="860" height="80" rx="12" fill="#F5F6FA"/>
  <text x="60" y="196" fill="#333340" font-family="Malgun Gothic, sans-serif" font-size="14">학교 구성원의 소통과 협력을 바탕으로 학교 비전을 공유하고 있다.</text>
</svg>`;

const analyze = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 820" fill="none">
  <rect width="1440" height="820" fill="#EEF0F9"/>
  <rect x="16" y="16" width="1408" height="56" rx="16" fill="#fff"/>
  <text x="36" y="50" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="16" font-weight="700">예시초등학교</text>
  <rect x="158" y="30" width="110" height="28" rx="14" fill="#E8EAFB"/>
  <text x="168" y="49" fill="#3B3AA8" font-family="Malgun Gothic, sans-serif" font-size="12" font-weight="700">학년말 학교평가</text>
  <text x="560" y="49" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="13">문항 구성</text>
  <rect x="640" y="28" width="88" height="32" rx="16" fill="#4341C4"/>
  <text x="654" y="49" fill="#fff" font-family="Malgun Gothic, sans-serif" font-size="13" font-weight="700">결과 분석</text>
  <rect x="16" y="88" width="1408" height="160" rx="16" fill="#fff"/>
  <text x="36" y="124" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="16" font-weight="700">1. 결과 파일 올리기</text>
  <rect x="36" y="144" width="320" height="80" rx="12" fill="#F5F6FA"/>
  <text x="56" y="176" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="14">교원 · 올려진 파일</text>
  <text x="56" y="200" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="12">교원_응답.xlsx · 42명</text>
  <rect x="372" y="144" width="320" height="80" rx="12" fill="#F5F6FA"/>
  <text x="392" y="188" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="14">학부모 파일 올리기</text>
  <rect x="708" y="144" width="320" height="80" rx="12" fill="#F5F6FA"/>
  <text x="728" y="188" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="14">학생 파일 올리기</text>
  <rect x="1044" y="144" width="356" height="80" rx="12" fill="#F5F6FA"/>
  <text x="1064" y="188" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="14">직원 파일 올리기</text>
  <rect x="16" y="264" width="1408" height="280" rx="16" fill="#fff"/>
  <text x="36" y="300" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="16" font-weight="700">2. 문항 연결 확인</text>
  <rect x="36" y="320" width="1368" height="44" rx="8" fill="#F2F3FD"/>
  <text x="56" y="348" fill="#333340" font-family="Malgun Gothic, sans-serif" font-size="13">열 제목</text>
  <text x="520" y="348" fill="#333340" font-family="Malgun Gothic, sans-serif" font-size="13">연결</text>
  <text x="56" y="396" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="13">학교 구성원의 소통과 협력을 바탕으로...</text>
  <text x="520" y="396" fill="#3B3AA8" font-family="Malgun Gothic, sans-serif" font-size="13">문항 12 · 자동</text>
  <text x="56" y="436" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="13">학년</text>
  <text x="520" y="436" fill="#3B3AA8" font-family="Malgun Gothic, sans-serif" font-size="13">학년 문항</text>
  <text x="56" y="476" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="13">타임스탬프</text>
  <text x="520" y="476" fill="#C45C5C" font-family="Malgun Gothic, sans-serif" font-size="13">연결 안 됨 — 문항을 고르세요</text>
  <rect x="36" y="500" width="200" height="28" rx="14" fill="#4341C4"/>
  <text x="56" y="519" fill="#fff" font-family="Malgun Gothic, sans-serif" font-size="12">연결 확정하고 집계하기</text>
  <rect x="16" y="560" width="1408" height="244" rx="16" fill="#fff"/>
  <text x="36" y="596" fill="#16161D" font-family="Malgun Gothic, sans-serif" font-size="16" font-weight="700">5. 산출물 내려받기</text>
  <rect x="36" y="620" width="220" height="40" rx="20" fill="#F5F6FA"/>
  <text x="56" y="646" fill="#333340" font-family="Malgun Gothic, sans-serif" font-size="13">설문 결과 보고서 (HTML)</text>
  <rect x="268" y="620" width="220" height="40" rx="20" fill="#F5F6FA"/>
  <text x="288" y="646" fill="#333340" font-family="Malgun Gothic, sans-serif" font-size="13">평가지표 및 현황 (XLSX)</text>
  <rect x="500" y="620" width="240" height="40" rx="20" fill="#4341C4"/>
  <text x="520" y="646" fill="#fff" font-family="Malgun Gothic, sans-serif" font-size="13">학교평가서 제출용 (DOCX)</text>
  <text x="36" y="700" fill="#6B7080" font-family="Malgun Gothic, sans-serif" font-size="13">제출 서류는 학년말 학교평가에서만 만들 수 있습니다. (가이드북 Q12)</text>
</svg>`;

writeFileSync("public/guide/01-workspace.svg", workspace, "utf8");
writeFileSync("public/guide/02-edit.svg", edit, "utf8");
writeFileSync("public/guide/03-analyze.svg", analyze, "utf8");
console.log("wrote 3 svgs");
