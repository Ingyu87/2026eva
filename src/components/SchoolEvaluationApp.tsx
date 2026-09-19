"use client";

import { useEffect, useState } from "react";
import { Workspace } from "@/components/workspace/Workspace";
import type { ApiResult, Audience, PublicSchool, WorkspaceRole } from "@/lib/types";

/**
 * 앱의 바깥 껍데기.
 *
 * 로그인 전후와 관리자 화면만 맡고, 실제 작업 화면은 `Workspace`가 그립니다.
 * 작업 화면은 높이를 화면에 꽉 채워야 하므로 바깥 여백이나 푸터를 두지 않습니다.
 */

type Mode = "user" | "admin";
type AuthMode = "login" | "register";

async function fetchJson<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 25_000, ...rest } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) }
    });
    const payload = (await response.json()) as ApiResult<T>;
    if (!payload.ok) {
      throw new Error(payload.error);
    }
    return payload.data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "서버 응답이 너무 오래 걸렸습니다. 방화벽·VPN·회사망에서 Google(Firestore) 접속이 막히지 않았는지 확인해 주세요."
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const BUILDER_HINT_KEY = "eval-builder-hint";

/** 부장 링크로 들어온 적이 있는 브라우저인지 기억해, 세션이 끝났을 때 안내를 바꿉니다. */
function rememberBuilder(on: boolean) {
  try {
    if (on) {
      localStorage.setItem(BUILDER_HINT_KEY, "1");
    } else {
      localStorage.removeItem(BUILDER_HINT_KEY);
    }
  } catch {
    // 저장이 막혀도 안내만 학교 로그인 화면으로 돌아갑니다.
  }
}

function readBuilderHint(): boolean {
  try {
    return localStorage.getItem(BUILDER_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function SchoolEvaluationApp() {
  const [mode, setMode] = useState<Mode>("user");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [school, setSchool] = useState<PublicSchool | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("lead");
  const [builderLabel, setBuilderLabel] = useState("");
  const [builderAudience, setBuilderAudience] = useState<Audience | undefined>(undefined);
  const [schoolName, setSchoolName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [linkNotice, setLinkNotice] = useState<"ended" | "invalid" | "confirm" | null>(null);
  const [pendingToken, setPendingToken] = useState("");

  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [schools, setSchools] = useState<PublicSchool[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    const inviteToken = invite && invite !== "missing" && invite !== "invalid" ? invite : "";
    if (invite === "invalid" || invite === "missing") {
      setLinkNotice("invalid");
      window.history.replaceState({}, "", "/");
    }

    void (async () => {
      try {
        const data = await fetchJson<{
          school: PublicSchool | null;
          role: WorkspaceRole | null;
          builderLabel?: string;
          builderAudience?: Audience | null;
        }>("/api/auth/me");

        if (inviteToken) {
          // 연구부장 계정이 열려 있는 브라우저에서 링크를 열면 그 계정이 로그아웃됩니다.
          if (data.school && data.role === "lead") {
            setPendingToken(inviteToken);
            setLinkNotice("confirm");
            return;
          }
          window.location.replace(`/api/invite/accept?token=${encodeURIComponent(inviteToken)}`);
          return;
        }

        if (data.school) {
          setSchool(data.school);
          setSchoolName(data.school.schoolName);
          setWorkspaceRole(data.role === "builder" ? "builder" : "lead");
          setBuilderLabel(data.builderLabel ?? "");
          setBuilderAudience(data.builderAudience ?? undefined);
          rememberBuilder(data.role === "builder");
        } else if (readBuilderHint()) {
          setLinkNotice("ended");
        }
      } catch {
        setSchool(null);
      }
    })();

    const google = params.get("google");
    if (google === "success") {
      setStatus("대상별 Google Forms 생성이 완료되었습니다.");
      window.history.replaceState({}, "", "/");
    }
    if (google === "error") {
      setError(params.get("message") || "Google Forms 생성에 실패했습니다.");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  async function submitAuth() {
    setError("");
    setStatus("");
    setSubmitting(true);
    const url = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    try {
      const data = await fetchJson<{ school: PublicSchool }>(url, {
        method: "POST",
        body: JSON.stringify({ schoolName, password })
      });
      setSchool(data.school);
      setWorkspaceRole("lead");
      rememberBuilder(false);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    const wasBuilder = workspaceRole === "builder";
    await fetch("/api/auth/logout", { method: "POST" });
    setSchool(null);
    if (wasBuilder) {
      setLinkNotice("ended");
      return;
    }
    setWorkspaceRole("lead");
    setBuilderLabel("");
    setBuilderAudience(undefined);
    setStatus("로그아웃되었습니다.");
  }

  async function loadSchools() {
    const data = await fetchJson<{ schools: PublicSchool[] }>("/api/admin/schools");
    setSchools(data.schools);
  }

  async function adminLogin() {
    setError("");
    try {
      await fetchJson<{ authenticated: boolean }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: adminPassword })
      });
      setAdminAuthed(true);
      setAdminPassword("");
      await loadSchools();
    } catch (err) {
      setError(err instanceof Error ? err.message : "관리자 로그인에 실패했습니다.");
    }
  }

  async function resetSchoolPassword(id: string) {
    const nextPassword = window.prompt("새 비밀번호를 입력하세요.");
    if (!nextPassword) {
      return;
    }
    await fetchJson<{ updated: boolean }>(`/api/admin/schools/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password: nextPassword })
    });
    setStatus("비밀번호를 초기화했습니다.");
    await loadSchools();
  }

  async function toggleSchoolStatus(item: PublicSchool) {
    await fetchJson<{ updated: boolean }>(`/api/admin/schools/${item.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: item.status === "active" ? "inactive" : "active" })
    });
    await loadSchools();
  }

  async function deleteSchoolAccount(id: string) {
    if (!window.confirm("학교 계정과 저장된 초안을 삭제할까요?")) {
      return;
    }
    await fetchJson<{ deleted: boolean }>(`/api/admin/schools/${id}`, { method: "DELETE" });
    await loadSchools();
  }

  // 작업 화면은 100dvh를 그대로 써야 해서 바깥 껍데기 없이 그립니다.
  if (mode === "user" && school) {
    return (
      <Workspace
        school={school}
        role={workspaceRole}
        builderLabel={builderLabel}
        builderAudience={builderAudience}
        onLogout={() => void logout()}
      />
    );
  }

  return (
    <div className="gate">
      <header className="gate-topbar">
        <span className="gate-brand">학교평가 설문 생성기</span>
        <div className="gate-modes">
          <button
            type="button"
            className={mode === "user" ? "gate-mode is-active" : "gate-mode"}
            onClick={() => setMode("user")}
          >
            학교
          </button>
          <button
            type="button"
            className={mode === "admin" ? "gate-mode is-active" : "gate-mode"}
            onClick={() => setMode("admin")}
          >
            관리자
          </button>
        </div>
      </header>

      <main className="gate-main">
        {status ? <div className="gate-msg gate-msg--ok">{status}</div> : null}
        {error ? <div className="gate-msg gate-msg--error">{error}</div> : null}

        {mode === "user" && linkNotice ? (
          <section className="gate-card">
            {linkNotice === "confirm" ? (
              <>
                <h1>연구부장 계정으로 로그인되어 있습니다</h1>
                <p className="gate-lead">
                  이 링크는 일반 부장용입니다. 지금 열면 이 브라우저에서 연구부장 계정이 로그아웃됩니다.
                  링크만 확인하려면 시크릿 창에 붙여 넣으세요.
                </p>
                <div className="gate-actions">
                  <button
                    type="button"
                    className="ws-btn ws-btn--primary ws-btn--lg"
                    onClick={() => window.location.replace("/")}
                  >
                    취소하고 돌아가기
                  </button>
                  <button
                    type="button"
                    className="ws-btn ws-btn--ghost"
                    onClick={() =>
                      window.location.replace(`/api/invite/accept?token=${encodeURIComponent(pendingToken)}`)
                    }
                  >
                    그래도 열기
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1>{linkNotice === "invalid" ? "열 수 없는 링크입니다" : "문항 작업 화면에서 나왔습니다"}</h1>
                <p className="gate-lead">
                  {linkNotice === "invalid"
                    ? "링크가 끊겼거나 주소가 잘못되었습니다. 연구부장에게 새 링크를 요청하세요."
                    : "받은 링크를 다시 열면 이어서 작업할 수 있습니다. 링크가 열리지 않으면 연구부장에게 새 링크를 요청하세요."}
                </p>
                <div className="gate-actions">
                  <button
                    type="button"
                    className="ws-btn ws-btn--ghost"
                    onClick={() => {
                      rememberBuilder(false);
                      setLinkNotice(null);
                    }}
                  >
                    연구부장 로그인
                  </button>
                </div>
              </>
            )}
          </section>
        ) : mode === "user" ? (
          <section className="gate-card">
            <h1>{authMode === "login" ? "학교 로그인" : "학교 등록"}</h1>
            <p className="gate-lead">
              문항을 골라 설문을 만들고 DOCX와 Google Forms로 내보냅니다.
            </p>

            <label className="ws-field">
              <span>학교 이름</span>
              <input
                className="ws-input"
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
              />
            </label>
            <label className="ws-field">
              <span>비밀번호</span>
              <input
                className="ws-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitAuth();
                  }
                }}
              />
            </label>

            <div className="gate-actions">
              <button
                type="button"
                className="ws-btn ws-btn--primary ws-btn--lg"
                disabled={submitting}
                onClick={() => void submitAuth()}
              >
                {submitting ? "처리 중…" : authMode === "login" ? "로그인" : "등록하기"}
              </button>
              <button
                type="button"
                className="ws-btn ws-btn--ghost"
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
              >
                {authMode === "login" ? "새 학교 등록" : "기존 학교 로그인"}
              </button>
            </div>
          </section>
        ) : !adminAuthed ? (
          <section className="gate-card">
            <h1>관리자 로그인</h1>
            <label className="ws-field">
              <span>관리자 비밀번호</span>
              <input
                className="ws-input"
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void adminLogin();
                  }
                }}
              />
            </label>
            <div className="gate-actions">
              <button
                type="button"
                className="ws-btn ws-btn--primary ws-btn--lg"
                onClick={() => void adminLogin()}
              >
                관리자 로그인
              </button>
            </div>
          </section>
        ) : (
          <section className="gate-card gate-card--wide">
            <div className="gate-card-head">
              <h1>학교 계정 관리</h1>
              <button
                type="button"
                className="ws-btn ws-btn--ghost"
                onClick={() => void loadSchools()}
              >
                새로고침
              </button>
            </div>

            <table className="gate-table">
              <thead>
                <tr>
                  <th>학교명</th>
                  <th>상태</th>
                  <th>등록일</th>
                  <th>최근 로그인</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((item) => (
                  <tr key={item.id}>
                    <td>{item.schoolName}</td>
                    <td>
                      <span className={item.status === "active" ? "gate-pill is-on" : "gate-pill"}>
                        {item.status === "active" ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td>{item.createdAt?.slice(0, 10)}</td>
                    <td>{item.lastLoginAt?.slice(0, 16).replace("T", " ") || "-"}</td>
                    <td className="gate-row-actions">
                      <button
                        type="button"
                        className="ws-btn ws-btn--soft"
                        onClick={() => void resetSchoolPassword(item.id)}
                      >
                        비번 초기화
                      </button>
                      <button
                        type="button"
                        className="ws-btn ws-btn--ghost"
                        onClick={() => void toggleSchoolStatus(item)}
                      >
                        {item.status === "active" ? "비활성화" : "활성화"}
                      </button>
                      <button
                        type="button"
                        className="ws-btn ws-btn--danger"
                        onClick={() => void deleteSchoolAccount(item.id)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {schools.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="gate-empty">
                      등록된 학교가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        )}
      </main>

      <footer className="gate-footer">
        <span>2026 서울가동초 백인규</span>
        <a href="/terms" target="_blank" rel="noreferrer">
          이용약관
        </a>
        <a href="/privacy" target="_blank" rel="noreferrer">
          개인정보처리방침
        </a>
      </footer>
    </div>
  );
}
