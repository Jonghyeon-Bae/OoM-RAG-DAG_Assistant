"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, TypeBadge, typeLabel, cn } from "@/components/ui";
import { ChainBlock } from "@/components/blocks/ChainBlock";
import { ParentPicker, ROOT } from "@/components/blocks/ParentPicker";
import { fetchChain, postLog } from "@/lib/api/client";
import type { Chain, LogNode, LogType } from "@/lib/types/domain";

// 유형별 입력 안내 — 거친 메모라도 정제 LLM이 뽑을 재료가 들어오게 유도
const guide: Record<LogType, { title: string; body: string }> = {
  fail: { title: "예: VPN 접속 시 E-403 반복 발생", body: "언제·어디서·어떤 에러가 났는지. 에러 코드가 있으면 그대로 적어 주세요." },
  success: { title: "예: 갱신 주기 30분 조정으로 E-403 해소", body: "무엇을 바꿨고 결과가 어땠는지. 재발 여부가 있으면 함께." },
  ref: { title: "예: 게이트웨이 인증 로그 확인 방법", body: "절차·명령어·링크 등 다음 사람이 그대로 따라 할 수 있는 내용." },
};

// 유형별 버튼 색: 성공 파랑 / 실패 빨강 / 참고 회색. 선택 시 채움, 미선택 시 옅은 바탕.
const toneBtn: Record<LogType, { on: string; off: string }> = {
  success: { on: "border-success bg-success text-white", off: "border-success-bg bg-success-bg text-success hover:bg-[#c9def5]" },
  fail: { on: "border-fail bg-fail text-white", off: "border-fail-bg bg-fail-bg text-fail hover:bg-[#f2c9c9]" },
  ref: { on: "border-ref bg-ref text-white", off: "border-ref-bg bg-ref-bg text-ref hover:bg-[#d9dce5]" },
};

export function LogForm({ wsId, candidates, onCreated, initialParent, initialPreview }: { wsId: number; candidates: LogNode[]; onCreated?: (n: LogNode) => void; initialParent?: string; initialPreview?: Chain | null }) {
  const [type, setType] = useState<LogType>("fail");
  const [parent, setParent] = useState<string>(initialParent && candidates.some((c) => String(c.id) === initialParent) ? initialParent : ROOT);
  const [title, setTitle] = useState("");
  const [resolveRoot, setResolveRoot] = useState(false);
  const [preview, setPreview] = useState<Chain | null>(initialPreview ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 등록 → 화면에 머물고 우측 정제 패널이 진행 상황을 보여준다. 폼은 초기화.
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget; // await 이후 currentTarget은 null이 되므로 먼저 보관
    const fd = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      const node = await postLog(wsId, {
        type,
        title: String(fd.get("title") ?? "").trim(),
        body: String(fd.get("body") ?? "").trim(),
        parent_id: parent === ROOT ? null : Number(parent),
        resolve_root: resolveRoot,
      });
      onCreated?.(node);
      form.reset();
      setTitle("");
      setType("fail");
      setParent(ROOT);
      setPreview(null);
      setResolveRoot(false);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 실패");
      setBusy(false);
    }
  };

  // 상위 로그 선택 → 그 체인을 미리 보여줘 잘못된 연결을 줄인다. 선택 핸들러에서 로드(effect 내 setState 금지 규칙).
  const choose = (value: string) => {
    setParent(value);
    if (value === ROOT) {
      setPreview(null);
      return;
    }
    fetchChain(wsId, Number(value)).then((c) => setPreview(c));
  };

  const parentNode = candidates.find((c) => String(c.id) === parent);

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <Field label="로그 유형 (원클릭 태깅)">
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {(["success", "fail", "ref"] as LogType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={t === type}
              onClick={() => setType(t)}
              className={cn("cursor-pointer flex h-12 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors", t === type ? toneBtn[t].on : toneBtn[t].off)}
            >
              <span className="size-2 rounded-full bg-current" />
              {typeLabel[t]}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />
        <p className="mt-2 text-xs text-ink-muted">
          <b className="text-success">성공</b> 해결했다 · <b className="text-fail">실패</b> 문제나 원인을 발견했다 · <b className="text-ref">참고</b> 절차·자료를 남긴다
        </p>
      </Field>

      <Field label="제목" htmlFor="log-title">
        <Input id="log-title" name="title" className="h-11" placeholder={guide[type].title} required value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="내용" htmlFor="log-body">
        <Textarea id="log-body" name="body" className="min-h-[120px]" placeholder={guide[type].body} required />
      </Field>

      <Field label="어디에 이어서 적나요?" hint={initialParent ? undefined : "새 문제면 '새 장애 건 시작', 이미 있는 문제면 그 장애 건을 고르세요."}>
        <ParentPicker candidates={candidates} value={parent} onChange={choose} titleHint={title} chain={preview} />
      </Field>

      {preview && parentNode && (
        <div className="rounded-xl bg-primary-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-ink-muted">
            <TypeBadge type={parentNode.type} />
            <span>이 흐름에 이어집니다 — 새 로그는 <b className="text-ink">{parentNode.title}</b> 다음에 들어갑니다</span>
          </div>
          <ChainBlock chain={preview} compact selectedId={parentNode.id} />
        </div>
      )}

      {type === "success" && parent !== ROOT && (
        <label className="flex items-start gap-3 rounded-lg border border-success-bg bg-success-bg/40 p-3 text-sm">
          <input type="checkbox" name="resolve_root" checked={resolveRoot} onChange={(e) => setResolveRoot(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-success)]" />
          <span>
            <span className="font-semibold text-success">이 성공으로 장애 건을 완료 처리</span>
            <span className="mt-0.5 block text-xs text-ink-muted">장애 건에 완료 표시가 붙습니다. 타임라인에서 언제든 되돌릴 수 있습니다.</span>
          </span>
        </label>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="reset" variant="outline" size="lg" className="h-11 flex-1" onClick={() => { setType("fail"); setTitle(""); setParent(ROOT); setPreview(null); setResolveRoot(false); }}>
          초기화
        </Button>
        <Button type="submit" size="lg" className="h-11 flex-[2]" disabled={busy}>{busy ? "등록 중…" : "등록하고 AI 정리"}</Button>
      </div>
      {error && <p className="text-sm text-fail">{error}</p>}
    </form>
  );
}
