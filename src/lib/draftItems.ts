import { sortByOrder } from "./order";
import { AUDIENCES, type Audience, type SelectedQuestion } from "./types";

/**
 * 선택 문항은 대상별 배열이 아니라 평평한 목록으로 오갑니다.
 * 문서를 쪼개 두어야 동시 편집에서 덮어쓰기가 나지 않기 때문입니다.
 * 화면과 내보내기에서 대상별로 묶어야 할 때 이 헬퍼를 씁니다.
 */

/** 한 대상의 문항만 순서대로 추립니다. 삭제 표식이 붙은 것은 제외합니다. */
export function itemsForAudience(
  items: SelectedQuestion[],
  audience: Audience
): SelectedQuestion[] {
  return sortByOrder(items.filter((item) => !item.deleted && item.audience === audience));
}

/** 네 대상 전부를 묶어 돌려줍니다. 비어 있는 대상도 빈 배열로 채웁니다. */
export function groupByAudience(
  items: SelectedQuestion[]
): Record<Audience, SelectedQuestion[]> {
  return AUDIENCES.reduce(
    (acc, audience) => {
      acc[audience] = itemsForAudience(items, audience);
      return acc;
    },
    {} as Record<Audience, SelectedQuestion[]>
  );
}

/** 대상별 문항 수. 탭 뱃지에 씁니다. */
export function countByAudience(items: SelectedQuestion[]): Record<Audience, number> {
  return AUDIENCES.reduce(
    (acc, audience) => {
      acc[audience] = items.filter((item) => !item.deleted && item.audience === audience).length;
      return acc;
    },
    {} as Record<Audience, number>
  );
}
