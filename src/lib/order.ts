/**
 * 선택 문항의 순서를 다루는 분수 인덱스 유틸.
 *
 * 전체 항목에 1, 2, 3... 을 다시 매기면 한 사람이 순서를 바꿀 때마다 모든 문서를 쓰게 되어
 * 동시 작업에서 전면 충돌이 납니다. 앞뒤 값의 중간값을 쓰면 이동·삽입 시 자기 문서 하나만
 * 쓰면 됩니다.
 */

/** 맨 끝에 붙일 때 벌리는 간격. */
const STEP = 1;

/**
 * 두 값이 이보다 가까워지면 double 정밀도가 바닥나므로 재정규화가 필요합니다.
 * 중간값을 반복해서 넣어야 도달하는 값이라 실제로는 거의 발생하지 않습니다.
 */
const MIN_GAP = 1e-6;

type Ordered = { order: number };

/** order 오름차순 정렬본을 새로 만들어 돌려줍니다. 원본은 건드리지 않습니다. */
export function sortByOrder<T extends Ordered>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.order - b.order);
}

/** 목록 맨 끝에 새로 붙일 때 쓸 order. */
export function orderForAppend(items: Ordered[]): number {
  if (items.length === 0) {
    return STEP;
  }
  return Math.max(...items.map((item) => item.order)) + STEP;
}

/** 목록 맨 앞에 끼워 넣을 때 쓸 order. */
export function orderForPrepend(items: Ordered[]): number {
  if (items.length === 0) {
    return STEP;
  }
  return Math.min(...items.map((item) => item.order)) - STEP;
}

/**
 * `before`와 `after` 사이에 넣을 order를 만듭니다.
 * 한쪽이 없으면 목록의 끝을 뜻합니다.
 */
export function orderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) {
    return STEP;
  }
  if (before === null) {
    return (after as number) - STEP;
  }
  if (after === null) {
    return before + STEP;
  }
  return (before + after) / 2;
}

/**
 * `items`(정렬 여부 무관) 안에서 `id` 항목을 `delta`칸 옮길 때 쓸 새 order.
 * 옮길 수 없으면(이미 끝) null을 돌려줍니다.
 *
 * 이 함수는 **옮기는 문서 하나의 order만** 계산합니다. 다른 항목은 건드리지 않습니다.
 */
export function orderForMove<T extends Ordered & { id: string }>(
  items: T[],
  id: string,
  delta: number
): number | null {
  const sorted = sortByOrder(items);
  const from = sorted.findIndex((item) => item.id === id);
  if (from < 0) {
    return null;
  }

  const to = from + delta;
  if (to < 0 || to >= sorted.length) {
    return null;
  }

  // 자기 자신을 뺀 목록에서 목표 자리의 앞뒤를 봅니다.
  const rest = sorted.filter((_, index) => index !== from);
  const before = to > 0 ? rest[to - 1].order : null;
  const after = to < rest.length ? rest[to].order : null;
  return orderBetween(before, after);
}

/**
 * 간격이 정밀도 한계에 다다랐는지 확인합니다.
 * true면 호출한 쪽에서 재정규화를 수행해야 합니다.
 */
export function needsRenormalize(items: Ordered[]): boolean {
  const sorted = sortByOrder(items);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].order - sorted[i - 1].order < MIN_GAP) {
      return true;
    }
  }
  return false;
}

/**
 * 순서를 유지한 채 order를 1, 2, 3... 으로 다시 벌립니다.
 * 모든 문서를 쓰게 되므로 `needsRenormalize()`가 true일 때만 호출합니다.
 */
export function renormalize<T extends Ordered>(items: T[]): T[] {
  return sortByOrder(items).map((item, index) => ({ ...item, order: (index + 1) * STEP }));
}

/** 화면에 보여줄 1부터의 일련번호. 저장하지 않습니다. */
export function displayIndex<T extends Ordered & { id: string }>(items: T[], id: string): number {
  return sortByOrder(items).findIndex((item) => item.id === id) + 1;
}
