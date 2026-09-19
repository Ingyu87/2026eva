"use client";

import { useRef, useState } from "react";
import { placementFromSubarea } from "@/lib/evaluationFramework";
import type { PriorSurveyItem } from "@/lib/priorSurvey";
import {
  AUDIENCES,
  AUDIENCE_SHORT_LABELS,
  type Audience,
  type ResponseType
} from "@/lib/types";
import { SubareaField } from "./SubareaField";

export type PriorSurveyCommit = {
  audience: Audience;
  area: string;
  subarea: string;
  indicator: string;
  question: string;
  responseType: ResponseType;
};

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

export function PriorSurveyImport({
  onCommit
}: {
  onCommit: (items: PriorSurveyCommit[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "ready">("idle");
  const [error, setError] = useState("");
  const [items, setItems] = useState<PriorSurveyItem[]>([]);

  const ready = items.length > 0 && items.every((item) => placementFromSubarea(item.subarea));

  async function upload(file: File) {
    setError("");
    setStatus("reading");
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/ingest/prior-survey", { method: "POST", body: form });
      const payload = (await response.json()) as ApiEnvelope<{ items: PriorSurveyItem[] }>;
      if (!payload.ok) {
        throw new Error(payload.error);
      }
      setItems(payload.data.items);
      setStatus("ready");
    } catch (err) {
      setItems([]);
      setStatus("idle");
      setError(err instanceof Error ? err.message : "문항지를 읽지 못했습니다.");
    }
  }

  return (
    <div className="ws-prior">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="ra-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void upload(file);
          }
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="ws-start-action"
        disabled={status === "reading"}
        onClick={() => inputRef.current?.click()}
      >
        <strong>전년도 학년말 문항지 올리기</strong>
        <span>{status === "reading" ? "읽는 중…" : "PDF"}</span>
      </button>
      {error ? <p className="ws-custom-error">{error}</p> : null}

      {status === "ready" ? (
        <>
          <p className="ws-hint">{items.length}개</p>
          <div className="ws-prior-list">
            {items.map((item, index) => (
              <div key={`${item.audience}-${index}`} className="ws-prior-item">
                <p className="ws-item-text">{item.question}</p>
                <label className="ws-field">
                  <span>대상</span>
                  <select
                    className="ws-select"
                    value={item.audience}
                    onChange={(event) => {
                      const audience = event.target.value as Audience;
                      setItems((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, audience } : entry
                        )
                      );
                    }}
                  >
                    {AUDIENCES.map((audience) => (
                      <option key={audience} value={audience}>
                        {AUDIENCE_SHORT_LABELS[audience]}
                      </option>
                    ))}
                  </select>
                </label>
                <SubareaField
                  subarea={item.subarea}
                  indicator={item.indicator}
                  onChange={(next) => {
                    setItems((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, ...next } : entry
                      )
                    );
                  }}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ws-btn ws-btn--primary"
            disabled={!ready}
            onClick={() => {
              const next = items.flatMap((item) => {
                const legal = placementFromSubarea(item.subarea);
                if (!legal) {
                  return [];
                }
                return [
                  {
                    ...legal,
                    audience: item.audience,
                    indicator: item.indicator.trim() || "학교 자체 문항",
                    question: item.question,
                    responseType: "likert_5" as const
                  }
                ];
              });
              onCommit(next);
            }}
          >
            담기
          </button>
        </>
      ) : null}
    </div>
  );
}
