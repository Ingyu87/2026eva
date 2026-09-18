import bank2026 from "../data/question-bank-2026.json";
import { isCurrentSubarea } from "./evaluationFramework";
import type { QuestionBankItem } from "./types";

/**
 * 교육청 예시자료에서 만든 읽기 전용 문항 풀.
 *
 * 파일은 `scripts/extract_question_bank.py` → `scripts/build-question-bank.mjs`로 만듭니다.
 * 세부영역 검증도 그 단계에서 끝내지만, 파일을 손으로 고쳤을 가능성이 있으므로
 * 여기서 한 번 더 거릅니다. 잘못된 세부영역이 섞이면 제출 서식에 매핑되지 않습니다.
 */

type BankFile = {
  year: number;
  schoolLevel: QuestionBankItem["schoolLevel"];
  items: Array<Omit<QuestionBankItem, "year" | "schoolLevel">>;
};

const file = bank2026 as BankFile;

export const questionBank: QuestionBankItem[] = file.items
  .filter((item) => isCurrentSubarea(item.subarea))
  .map((item) => ({
    ...item,
    year: file.year,
    schoolLevel: file.schoolLevel
  }));

export const questionBankYear = file.year;
