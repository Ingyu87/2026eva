"use client";

import { AREAS, placementFromSubarea } from "@/lib/evaluationFramework";

/**
 * 영역은 세부영역에서 따라옵니다. 학교가 영역·세부영역을 마음대로 적지 못하게 합니다.
 * (기본계획 Ⅴ-3-가-2, 가이드북 Q6)
 */
export function SubareaField({
  subarea,
  indicator,
  onChange
}: {
  subarea: string;
  indicator: string;
  onChange: (next: { area: string; subarea: string; indicator: string }) => void;
}) {
  const valid = placementFromSubarea(subarea);

  return (
    <div className="ws-subarea-field">
      <label className="ws-field">
        <span>세부영역</span>
        <select
          className="ws-select"
          value={valid?.subarea ?? ""}
          onChange={(event) => {
            const next = placementFromSubarea(event.target.value);
            if (!next) {
              return;
            }
            onChange({ ...next, indicator });
          }}
        >
          {!valid ? <option value="">세부영역을 고르세요</option> : null}
          {AREAS.map((area) => (
            <optgroup key={area.code} label={area.name}>
              {area.subareas.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="ws-field">
        <span>평가지표</span>
        <input
          className="ws-input"
          value={indicator}
          placeholder="평가지표 이름"
          onChange={(event) => {
            const next = placementFromSubarea(subarea);
            if (!next) {
              return;
            }
            onChange({ ...next, indicator: event.target.value });
          }}
        />
      </label>
      {subarea.includes("Ⅲ-4") ? (
        <p className="ws-hint">Ⅲ-4. 기타는 자율고·특목고·특성화고·특수학교 전용입니다. 초등은 해당 없을 수 있습니다.</p>
      ) : null}
    </div>
  );
}
