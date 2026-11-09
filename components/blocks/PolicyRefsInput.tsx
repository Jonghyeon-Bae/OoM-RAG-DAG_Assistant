"use client";
import { useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui";
import { relationLabel } from "@/components/blocks/ChainBlock";
import { fetchPolicyArticles } from "@/lib/api/client";
import type { PolicyArticleOption, PolicyRefInput, PolicyRelation } from "@/lib/types/domain";

// 등록 폼의 "근거 조문 (선택)" — 이 조치가 사내 규정과 어떤 관계인지 (요청 J, D-2).
// 규칙(백엔드 PolicyRefService): 최대 5건, 따름·예외는 이 부서에서 검색되는 활성 규정 조문만, 규정 없음은 topic 필수
export const MAX_REFS = 5;
export type RefDraft = { relation: PolicyRelation; option: PolicyArticleOption | null; topic: string; note: string };
export const emptyRef = (): RefDraft => ({ relation: "follows", option: null, topic: "", note: "" });
export const refReady = (r: RefDraft) => (r.relation === "gap" ? r.topic.trim().length > 0 : r.option !== null);
export const toInput = (r: RefDraft): PolicyRefInput => ({
  relation: r.relation,
  ...(r.relation === "gap" ? { topic: r.topic.trim() } : { policy: r.option!.policy, article: r.option!.article }),
  ...(r.note.trim() ? { note: r.note.trim() } : {}),
});
const relationHint: Record<PolicyRelation, string> = {
  follows: "규정에 적힌 대로 처리했다",
  exception: "규정과 다르게 처리했다(예외 승인 등)",
  gap: "이 상황을 다루는 규정이 없다",
};

function ArticlePicker({ wsId, value, onPick }: { wsId: number; value: PolicyArticleOption | null; onPick: (o: PolicyArticleOption | null) => void }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<PolicyArticleOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const search = (text: string) => {
    setQ(text); setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => { setLoading(true); setOpts(await fetchPolicyArticles(wsId, text.trim())); setLoading(false); }, 250);
  };
  if (value) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-white px-2 py-1.5 text-sm">
        <span className="min-w-0 flex-1 truncate text-ink" title={`${value.doc_title} ${value.article_label}`}>{value.doc_title} <b>{value.article_label}</b></span>
        <button type="button" onClick={() => onPick(null)} className="rounded p-0.5 text-ink-muted hover:bg-primary-100" aria-label="조문 다시 고르기"><X className="size-3.5" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
      <Input value={q} onChange={(e) => search(e.target.value)} onFocus={() => (q ? setOpen(true) : search(""))} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="규정 이름이나 조문으로 찾기 (예: 환불 7조)" className="h-9 pl-8 text-sm" aria-autocomplete="list" />
      {open && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          {loading ? <li className="px-2 py-1.5 text-xs text-ink-muted">찾는 중…</li> : opts.length === 0 ? <li className="px-2 py-1.5 text-xs text-ink-muted">이 부서에서 검색되는 조문 중 맞는 것이 없습니다</li> :
            opts.map((o) => (
              <li key={`${o.policy}|${o.article}`} role="option" aria-selected={false}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(o); setOpen(false); setQ(""); }} className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-primary-50">
                  <span className="text-ink-muted">{o.doc_title}</span> <b className="text-ink">{o.article_label}</b>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export function PolicyRefsInput({ wsId, value, onChange }: { wsId: number; value: RefDraft[]; onChange: (v: RefDraft[]) => void }) {
  const set = (i: number, patch: Partial<RefDraft>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-3">
      {value.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-primary-50/60 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["follows", "exception", "gap"] as PolicyRelation[]).map((rel) => (
              <button key={rel} type="button" onClick={() => set(i, { relation: rel })} title={relationHint[rel]} aria-pressed={r.relation === rel}
                className={cn("h-7 rounded-md border px-2.5 text-xs font-semibold", r.relation === rel ? "border-primary-700 bg-primary-700 text-white" : "border-border bg-white text-ink-muted hover:bg-primary-100")}>{relationLabel[rel]}</button>
            ))}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="ml-auto rounded p-1 text-ink-muted hover:bg-primary-100" aria-label="이 근거 빼기"><X className="size-3.5" /></button>
          </div>
          {r.relation === "gap"
            ? <Input value={r.topic} onChange={(e) => set(i, { topic: e.target.value })} placeholder="어떤 기준이 없었나요? (예: 야간 긴급 배포 승인 절차)" className="h-9 text-sm" required />
            : <ArticlePicker wsId={wsId} value={r.option} onPick={(o) => set(i, { option: o })} />}
          <Input value={r.note} onChange={(e) => set(i, { note: e.target.value })} placeholder="메모 (선택) — 예: 팀장 승인으로 3일 연장" className="h-8 text-xs" />
        </div>
      ))}
      {value.length < MAX_REFS && (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...value, emptyRef()])}><Plus className="size-3.5" /> 근거 조문 추가</Button>
      )}
    </div>
  );
}
