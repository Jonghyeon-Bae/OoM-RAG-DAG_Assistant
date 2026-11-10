import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Chip, TypeBadge } from "@/components/ui";
import { relationLabel } from "@/lib/relation";
import type { RevisionImpact, RevisionStatus } from "@/lib/types/domain";

// 규정 개정 영향 (백엔드 요청 K·L, D-3 기본안: 대시보드 상단). 개정된 규정 조문을 근거로 적은 사례가 개정 뒤 어떻게 되는지.
// 타임라인 쪽은 노드 카드의 근거 조문 줄에 "개정" 표시(#085)로 같은 정보를 보인다. 다시 연결(PUT policy-refs)은 다음 단계
const statusLabel: Record<RevisionStatus, string> = { replaced: "다시 연결 필요", amended: "조문 내용 바뀜", same: "조문 그대로" };
const statusTone: Record<RevisionStatus, "fail" | "warn" | "neutral"> = { replaced: "fail", amended: "warn", same: "neutral" };
const statusHint: Record<RevisionStatus, string> = {
  replaced: "개정판에 대응하는 조문이 정해지지 않았습니다. 사례의 근거를 새 조문으로 다시 이어야 합니다",
  amended: "같은 조문이지만 내용이 바뀌었습니다. 사례는 개정 전 기준으로 처리된 것입니다",
  same: "개정됐지만 이 조문 내용은 그대로입니다",
};

export function RevisionImpactCard({ wsId, impact, limit = 6 }: { wsId: number; impact: RevisionImpact | null; limit?: number }) {
  if (!impact || impact.cases === 0) return null;
  const shown = impact.items.slice(0, limit); // 서버가 replaced → amended → same 순으로 준다
  return (
    <Card className="gap-4 border-warn-bg p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">규정 개정 영향 <span className="text-sm font-normal text-ink-muted">사례 {impact.cases}건</span></h2>
          <p className="mt-0.5 text-xs text-ink-muted">개정된 규정 조문을 근거로 적어 둔 이 부서의 해결 기록입니다. AI 답변은 이 사례를 &ldquo;당시 기준&rdquo;으로 인용합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["replaced", "amended", "same"] as RevisionStatus[]).map((k) => impact.summary[k] > 0 && (
            <Chip key={k} tone={statusTone[k]} className="h-6 text-xs" title={statusHint[k]}>{statusLabel[k]} {impact.summary[k]}</Chip>
          ))}
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {shown.map((it, i) => (
          <li key={`${it.node_id}-${it.policy}-${it.article}-${i}`} className="flex flex-col gap-1 py-2.5 text-sm md:flex-row md:items-center md:gap-4">
            <Link href={`/w/${wsId}/timeline?entry=${it.node_id}`} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
              <TypeBadge type={it.type} />
              <span className="truncate text-ink">{it.title}</span>
            </Link>
            <span className="min-w-0 truncate text-xs text-ink-muted md:max-w-[45%]" title={[it.from_label, it.current_label ?? it.suggested_label].filter(Boolean).join(" → ")}>
              {relationLabel[it.relation]} · {it.from_label ?? `${it.policy} ${it.article}`}
              {it.status !== "same" && <> → <b className="text-ink">{it.current_label ? `${it.current_title ?? ""} ${it.current_label}` : it.suggested_label ? `제안: ${it.suggested_label}` : "대응 조문 없음"}</b></>}
            </span>
            <Chip tone={statusTone[it.status]} className="h-5 w-fit shrink-0 text-xs">{statusLabel[it.status]}</Chip>
          </li>
        ))}
      </ul>
      {impact.items.length > shown.length && <p className="text-xs text-ink-muted">외 {impact.items.length - shown.length}건 — 다시 연결이 필요한 것부터 보여줍니다.</p>}
    </Card>
  );
}
