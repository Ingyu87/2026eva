import type { SelectedQuestion, SelectedQuestionPatch } from "./types";

export const WORK_COLORS = ["purple", "blue", "teal", "amber", "pink", "slate"] as const;
export type WorkColor = typeof WORK_COLORS[number];
export const WORK_COLOR_LABELS: Record<WorkColor, string> = { purple: "보라", blue: "파랑", teal: "청록", amber: "갈색", pink: "분홍", slate: "회색" };
export type WorkActor = { id: string; label: string; color: WorkColor };
export type WorkStatus = { kind: "edited" | "confirmed"; actorId: string; label: string; color: WorkColor; at: string };
export function isWorkColor(value: unknown): value is WorkColor { return WORK_COLORS.includes(value as WorkColor); }
export function isLeadActorId(id?: string): boolean {
  return id === "lead" || Boolean(id?.startsWith("lead:"));
}
/** 화면에 보여줄 기록. 연구부장 확인은 남기지 않습니다. */
export function builderWorkStatus(status?: WorkStatus): WorkStatus | undefined {
  if (!status || isLeadActorId(status.actorId)) return undefined;
  return status;
}
export function defaultWorkColor(label: string): WorkColor {
  if (label.includes("교무")) return "purple";
  let hash = 0; for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return WORK_COLORS[hash % WORK_COLORS.length];
}
const CONTENT_FIELDS = ["editedQuestion", "responseType", "choices", "audience"] as const;
export function nextWorkStatus(current: SelectedQuestion, patch: SelectedQuestionPatch, actor: WorkActor, at: string): WorkStatus | undefined {
  // 연구부장은 전체 문항을 검토하므로 수정·확인 기록에 넣지 않습니다. 기록은 부장 링크 작업만 남깁니다.
  if (isLeadActorId(actor.id)) {
    return builderWorkStatus(current.workStatus);
  }
  const changed = CONTENT_FIELDS.some(key => patch[key] !== undefined && JSON.stringify(patch[key]) !== JSON.stringify(current[key]));
  if (!changed && patch.confirmReview !== true) return current.workStatus;
  return { kind: changed ? "edited" : "confirmed", actorId: actor.id, label: actor.label, color: actor.color, at };
}
export function workStatusText(status: WorkStatus): string {
  const time = new Date(status.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `${status.label} · ${status.kind === "edited" ? "수정" : "확인 완료"} · ${time}`;
}
