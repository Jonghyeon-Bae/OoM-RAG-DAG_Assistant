"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Chain, ChainNode } from "@/lib/types/domain";
import { ChainNodeCard } from "@/components/blocks/ChainBlock";
import { cn } from "@/lib/utils";

// B-44 (xyflow 도입 전 폴백): 깊이별 열 배치 + 실제 간선을 SVG로 그린다.
type Box = { x: number; y: number; w: number; h: number };
const GAP = 8; // 선이 카드에 닿기 전 여백
const HEAD = 9; // 화살촉 길이

function orderByParent(chain: Chain): ChainNode[][] {
  const depths = [...new Set(chain.nodes.map((n) => n.depth))].sort((a, b) => a - b);
  const cols: ChainNode[][] = [];
  const pos = new Map<number, number>();
  for (const d of depths) {
    let col = chain.nodes.filter((n) => n.depth === d);
    if (cols.length) {
      col = [...col].sort((a, b) => {
        const first = (id: number) => Math.min(...chain.edges.filter((e) => e.child_id === id).map((e) => pos.get(e.parent_id) ?? 0), 99);
        return first(a.id) - first(b.id);
      });
    }
    col.forEach((n, i) => pos.set(n.id, i));
    cols.push(col);
  }
  return cols;
}

export function ChainGraph({ chain, selectedId, onSelect }: { chain: Chain; selectedId?: number; onSelect?: (id: number) => void }) {
  const cols = useMemo(() => orderByParent(chain), [chain]);
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<number, HTMLDivElement>());
  const [boxes, setBoxes] = useState<Map<number, Box>>(new Map());

  const measure = () => {
    const root = wrap.current;
    if (!root) return;
    const r0 = root.getBoundingClientRect();
    const m = new Map<number, Box>();
    refs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      m.set(id, { x: r.left - r0.left + root.scrollLeft, y: r.top - r0.top + root.scrollTop, w: r.width, h: r.height });
    });
    setBoxes(m);
  };
  useLayoutEffect(measure, [chain]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  // 선택 노드 기준 관련 집합: 조상 전체 + 자신 + 자손 전체 (선택 노드를 지나는 모든 경로)
  const related = useMemo(() => {
    const s = new Set<number>();
    if (!selectedId) return s;
    const up = (id: number) => {
      if (s.has(id)) return;
      s.add(id);
      chain.edges.filter((e) => e.child_id === id).forEach((e) => up(e.parent_id));
    };
    const down = (id: number) => {
      chain.edges.filter((e) => e.parent_id === id).forEach((e) => {
        if (!s.has(e.child_id)) {
          s.add(e.child_id);
          down(e.child_id);
        }
      });
    };
    up(selectedId);
    down(selectedId);
    return s;
  }, [chain, selectedId]);

  return (
    <div ref={wrap} className="relative overflow-x-auto py-1">
      <div className="flex items-start gap-16">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-5">
            {col.map((n) => {
              const dim = selectedId ? !related.has(n.id) : false;
              return (
                <div
                  key={n.id}
                  ref={(el) => {
                    if (el) refs.current.set(n.id, el);
                    else refs.current.delete(n.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect?.(n.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.(n.id)}
                  className={cn("transition-opacity", dim && "opacity-30")}
                >
                  <ChainNodeCard node={n} selected={n.id === selectedId} />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 간선: 노드 위에 그려 화살촉이 가려지지 않게 한다. 선은 카드 사이 공간만 지난다. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {chain.edges.map((e) => {
          const a = boxes.get(e.parent_id);
          const b = boxes.get(e.child_id);
          if (!a || !b) return null;
          const x1 = a.x + a.w + GAP, y1 = a.y + a.h / 2;
          const x2 = b.x - GAP, y2 = b.y + b.h / 2;
          const xEnd = x2 - HEAD; // 선은 화살촉 앞에서 끝남
          const mx = (x1 + xEnd) / 2;
          const hot = selectedId ? related.has(e.parent_id) && related.has(e.child_id) : false;
          const dim = selectedId ? !hot : false;
          const color = hot ? "var(--color-primary-700)" : "var(--color-primary-400)";
          // 끝점 접선: 제어점(mx, y2) → (xEnd, y2) 이므로 각도는 항상 수평(0°)이지만, 일반화를 위해 계산한다.
          const angle = (Math.atan2(y2 - y2, xEnd - mx) * 180) / Math.PI;
          return (
            <g key={`${e.parent_id}-${e.child_id}`} opacity={dim ? 0.25 : 1}>
              <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${xEnd} ${y2}`} fill="none" stroke={color} strokeWidth={hot ? 2.5 : 1.5} strokeLinecap="round" />
              <polygon points={`0,-4.5 ${HEAD},0 0,4.5`} fill={color} transform={`translate(${xEnd} ${y2}) rotate(${angle})`} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
