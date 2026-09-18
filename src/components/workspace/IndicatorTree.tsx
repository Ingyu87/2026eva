"use client";

import { useMemo, useState } from "react";
import type { QuestionBankItem } from "@/lib/types";

/**
 * 좌측 지표 트리.
 *
 * 예전에는 영역·세부영역·평가지표를 드롭다운 3개로 골라야 해서 문항 하나 담는 데
 * 최소 4번을 눌러야 했습니다. 트리로 펼쳐 두면 어디에 문항이 몰려 있는지 한눈에 보이고
 * 클릭 한 번으로 걸러집니다.
 */

export type TreeSelection = {
  area: string;
  subarea: string;
  indicator: string;
};

export const EMPTY_SELECTION: TreeSelection = { area: "", subarea: "", indicator: "" };

type Node = {
  key: string;
  label: string;
  count: number;
  children: Node[];
};

function buildTree(items: QuestionBankItem[]): Node[] {
  const areas = new Map<string, Map<string, Map<string, number>>>();

  for (const item of items) {
    const subareas = areas.get(item.area) ?? new Map();
    const indicators = subareas.get(item.subarea) ?? new Map<string, number>();
    indicators.set(item.indicator, (indicators.get(item.indicator) ?? 0) + 1);
    subareas.set(item.subarea, indicators);
    areas.set(item.area, subareas);
  }

  return Array.from(areas.entries()).map(([area, subareas]) => {
    const children = Array.from(subareas.entries()).map(([subarea, indicators]) => {
      const leaves = Array.from(indicators.entries()).map(([indicator, count]) => ({
        key: `${area}|${subarea}|${indicator}`,
        label: indicator,
        count,
        children: []
      }));
      return {
        key: `${area}|${subarea}`,
        label: subarea,
        count: leaves.reduce((sum, leaf) => sum + leaf.count, 0),
        children: leaves
      };
    });
    return {
      key: area,
      label: area,
      count: children.reduce((sum, child) => sum + child.count, 0),
      children
    };
  });
}

export function IndicatorTree({
  bank,
  selection,
  onSelect
}: {
  bank: QuestionBankItem[];
  selection: TreeSelection;
  onSelect: (next: TreeSelection) => void;
}) {
  const tree = useMemo(() => buildTree(bank), [bank]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  /** 이미 고른 항목을 다시 누르면 필터가 풀립니다. */
  const pick = (next: TreeSelection) => {
    const same =
      selection.area === next.area &&
      selection.subarea === next.subarea &&
      selection.indicator === next.indicator;
    onSelect(same ? EMPTY_SELECTION : next);
  };

  const isActive = (next: TreeSelection) =>
    selection.area === next.area &&
    selection.subarea === next.subarea &&
    selection.indicator === next.indicator;

  return (
    <div className="ws-col ws-tree">
      <div className="ws-col-head">
        <h2>평가지표</h2>
        {selection.area ? (
          <button type="button" className="ws-link" onClick={() => onSelect(EMPTY_SELECTION)}>
            전체 보기
          </button>
        ) : null}
      </div>

      <div className="ws-col-body">
        {tree.map((area) => {
          const areaSel = { area: area.label, subarea: "", indicator: "" };
          const areaCollapsed = collapsed.has(area.key);
          return (
            <div key={area.key} className="ws-tree-group">
              <div className="ws-tree-row ws-tree-row--area">
                <button
                  type="button"
                  className="ws-tree-caret"
                  aria-label={areaCollapsed ? "펼치기" : "접기"}
                  onClick={() => toggle(area.key)}
                >
                  {areaCollapsed ? "▸" : "▾"}
                </button>
                <button
                  type="button"
                  className={isActive(areaSel) ? "ws-tree-label is-active" : "ws-tree-label"}
                  onClick={() => pick(areaSel)}
                >
                  <span>{area.label}</span>
                  <span className="ws-count">{area.count}</span>
                </button>
              </div>

              {areaCollapsed
                ? null
                : area.children.map((subarea) => {
                    const subSel = {
                      area: area.label,
                      subarea: subarea.label,
                      indicator: ""
                    };
                    const subCollapsed = collapsed.has(subarea.key);
                    return (
                      <div key={subarea.key}>
                        <div className="ws-tree-row ws-tree-row--subarea">
                          <button
                            type="button"
                            className="ws-tree-caret"
                            aria-label={subCollapsed ? "펼치기" : "접기"}
                            onClick={() => toggle(subarea.key)}
                          >
                            {subCollapsed ? "▸" : "▾"}
                          </button>
                          <button
                            type="button"
                            className={
                              isActive(subSel) ? "ws-tree-label is-active" : "ws-tree-label"
                            }
                            onClick={() => pick(subSel)}
                          >
                            <span>{subarea.label}</span>
                            <span className="ws-count">{subarea.count}</span>
                          </button>
                        </div>

                        {subCollapsed
                          ? null
                          : subarea.children.map((indicator) => {
                              const leafSel = {
                                area: area.label,
                                subarea: subarea.label,
                                indicator: indicator.label
                              };
                              return (
                                <div
                                  key={indicator.key}
                                  className="ws-tree-row ws-tree-row--indicator"
                                >
                                  <button
                                    type="button"
                                    className={
                                      isActive(leafSel)
                                        ? "ws-tree-label is-active"
                                        : "ws-tree-label"
                                    }
                                    onClick={() => pick(leafSel)}
                                  >
                                    <span>{indicator.label}</span>
                                    <span className="ws-count">{indicator.count}</span>
                                  </button>
                                </div>
                              );
                            })}
                      </div>
                    );
                  })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
