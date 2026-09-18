"use client";

import type { DraftConflict } from "@/hooks/useDraftWorkspace";
import { Button } from "./Button";

/**
 * 같은 문항을 두 사람이 동시에 고쳤을 때 물어보는 창.
 *
 * 조용히 덮어쓰는 경로를 없애는 것이 이 화면의 존재 이유입니다.
 * 기존 유실 사고의 본질이 "말없이 덮어쓰기"였습니다.
 */
export function ConflictDialog({
  conflict,
  onResolve
}: {
  conflict: DraftConflict;
  onResolve: (choice: "mine" | "theirs") => void;
}) {
  const theirs = conflict.current;
  const editor = theirs?.updatedBy?.trim();
  const when = theirs?.updatedAt
    ? new Date(theirs.updatedAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : null;

  const mineText = conflict.mine?.editedQuestion;
  const theirsText = theirs?.editedQuestion;

  return (
    <div className="conflict-overlay" role="alertdialog" aria-modal="true">
      <div className="conflict-dialog">
        <h3>이 문항을 다른 사람이 먼저 수정했습니다</h3>
        <p className="conflict-meta">
          {editor ? `${editor} 님` : "다른 사용자"}
          {when ? ` · ${when}` : ""}
        </p>

        {theirs ? (
          <div className="conflict-compare">
            <div>
              <span className="conflict-label">저장되어 있는 내용</span>
              <p>{theirsText}</p>
            </div>
            {mineText ? (
              <div>
                <span className="conflict-label">내가 수정한 내용</span>
                <p>{mineText}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="conflict-meta">이 문항은 이미 삭제되었습니다.</p>
        )}

        <div className="conflict-actions">
          <Button onClick={() => onResolve("mine")}>내 수정으로 덮어쓰기</Button>
          <Button variant="secondary" onClick={() => onResolve("theirs")}>
            상대 수정 유지
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 로그인 직후 표시 이름을 한 번 묻습니다.
 *
 * 로그인 계정은 학교 단위 하나뿐이라 개인을 구분할 수단이 없습니다.
 * 여기서 받는 값은 접속자 표시와 충돌 안내에만 쓰는 라벨이며 인증이 아닙니다.
 */
export function DisplayNamePrompt({
  suggestions,
  onSubmit,
  onSkip
}: {
  suggestions: string[];
  onSubmit: (name: string) => void;
  onSkip: () => void;
}) {
  return (
    <div className="conflict-overlay" role="dialog" aria-modal="true">
      <form
        className="conflict-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          const input = new FormData(event.currentTarget).get("displayName");
          const value = typeof input === "string" ? input.trim() : "";
          if (value) {
            onSubmit(value);
          } else {
            onSkip();
          }
        }}
      >
        <h3>누구신가요?</h3>
        <p className="conflict-meta">같이 작업하는 분들에게 표시됩니다. 나중에 바꿀 수 있습니다.</p>

        <input
          className="conflict-input"
          name="displayName"
          list="display-name-suggestions"
          maxLength={20}
          autoFocus
          placeholder="예: 교무부장"
        />
        <datalist id="display-name-suggestions">
          {suggestions.map((title) => (
            <option key={title} value={title} />
          ))}
        </datalist>

        <div className="conflict-actions">
          <Button type="submit">시작하기</Button>
          <Button type="button" variant="secondary" onClick={onSkip}>
            익명으로
          </Button>
        </div>
      </form>
    </div>
  );
}
