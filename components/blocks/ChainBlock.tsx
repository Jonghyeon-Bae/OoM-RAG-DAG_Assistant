import { ArrowRight } from "lucide-react";
import type { Chain, ChainNode } from "@/lib/types/domain";
import { cn, typeLabel } from "@/components/ui";

// B-17 / B-45: 깊이별 열(root → 원인 → 해결)로 배치한 체인 블록. DAG 캔버스(xyflow)의 폴백이자 어시스턴트 답변 카드 공용.
const tone: Record<ChainNode["type"], string> = {
  fail: "bg-fail-bg text-fail",
  success: "bg-success-bg text-success",
  ref: "bg-ref-bg text-ref",
};

export function ChainNodeCard({ node, compact = false, selected = false }: { node: ChainNode; compact?: boolean; selected?: boolean }) {
  const deprecated = node.status === "deprecated";
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        tone[node.type],
        deprecated && "opacity-50 grayscale-[0.4]",
        selected ? "border-primary-700 ring-2 ring-primary-400" : "border-transparent",
        compact ? "min-w-[200px]" : "min-w-[220px]",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        <span className="size-1.5 rounded-full bg-current" />
        {typeLabel[node.type]}
        {deprecated && <span className="ml-auto rounded-full bg-warn-bg px-2 py-0.5 text-[11px] text-warn">폐기</span>}
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug">{node.title}</div>
      {(node.note || (!compact && node.path_label)) && (
        <div className="mt-1 text-xs opacity-80">{node.note ?? node.path_label}</div>
      )}
    </div>
  );
}

export function ChainBlock({ chain, compact = false, selectedId }: { chain: Chain; compact?: boolean; selectedId?: number }) {
  const depths = [...new Set(chain.nodes.map((n) => n.depth))].sort((a, b) => a - b);
  return (
    <div className="flex items-start gap-3 overflow-x-auto">
      {depths.map((d, i) => (
        <div key={d} className="flex items-start gap-3">
          <div className="flex flex-col gap-3">
            {chain.nodes
              .filter((n) => n.depth === d)
              .map((n) => (
                <ChainNodeCard key={n.id} node={n} compact={compact} selected={n.id === selectedId} />
              ))}
          </div>
          {i < depths.length - 1 && <ArrowRight className="mt-5 size-4 shrink-0 text-ink-muted" />}
        </div>
      ))}
    </div>
  );
}
