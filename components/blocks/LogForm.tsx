"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, TypeBadge, typeLabel, cn } from "@/components/ui";
import { ChainBlock } from "@/components/blocks/ChainBlock";
import { fetchChain, postLog } from "@/lib/api/client";
import type { Chain, LogNode, LogType } from "@/lib/types/domain";

// 유형별 입력 안내 — 거친 메모라도 정제 LLM이 뽑을 재료가 들어오게 유도
const guide: Record<LogType, { title: string; body: string }> = {
  fail: { title: "예: VPN 접속 시 E-403 반복 발생", body: "언제·어디서·어떤 에러가 났는지. 에러 코드가 있으면 그대로 적어 주세요." },
  success: { title: "예: 갱신 주기 30분 조정으로 E-403 해소", body: "무엇을 바꿨고 결과가 어땠는지. 재발 여부가 있으면 함께." },
  ref: { title: "예: 게이트웨이 인증 로그 확인 방법", body: "절차·명령어·링크 등 다음 사람이 그대로 따라 할 수 있는 내용." },
};

const ROOT = "root";

// 유형별 버튼 색: 성공 파랑 / 실패 빨강 / 참고 회색. 선택 시 채움, 미선택 시 옅은 바탕.
const toneBtn: Record<LogType, { on: string; off: string }> = {
  success: { on: "border-primary-700 bg-primary-700 text-white", off: "border-primary-200 bg-primary-100 text-primary-700 hover:bg-primary-200" },
  fail: { on: "border-fail bg-fail text-white", off: "border-fail-bg bg-fail-bg text-fail hover:bg-[#f2c9c9]" },
  ref: { on: "border-ref bg-ref text-white", off: "border-ref-bg bg-ref-bg text-ref hover:bg-[#d9dce5]" },
};

export function LogForm({ wsId, candidates }: { wsId: number; candidates: LogNode[] }) {
  const [type, setType] = useState<LogType>("fail");
  const [parent, setParent] = useState<string>(ROOT);
  const [resolveRoot, setResolveRoot] = useState(false);
  const [preview, setPreview] = useState<Chain | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 등록 → 타임라인으로 이동하며 방금 등록한 노드를 선택 상태로 연다 (URL ?entry= 가 선택 상태의 단일 출처)
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
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
      router.push(`/w/${wsId}/timeline?entry=${node.id}`);
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
      </Field>

      <Field label="제목">
        <Input name="title" className="h-11" placeholder={guide[type].title} required />
      </Field>
      <Field label="내용">
        <Textarea name="body" className="min-h-[120px]" placeholder={guide[type].body} required />
      </Field>

      <Field label="상위 로그 연결 (DAG 부모)" hint="목록에서만 선택합니다. 새 장애의 시작이면 '최초 등록'을 그대로 두세요.">
        <select
          name="parent_id"
          value={parent}
          onChange={(e) => choose(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value={ROOT}>최초 등록 — 새 장애 시작점 (상위 없음)</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id} disabled={c.status === "deprecated"}>
              [{typeLabel[c.type]}] {c.title} · {c.path_label}
              {c.status === "deprecated" ? " (폐기)" : ""}
            </option>
          ))}
        </select>
      </Field>

      {preview && parentNode && (
        <div className="rounded-xl bg-primary-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-ink-muted">
            <TypeBadge type={parentNode.type} />
            <span>이 로그가 연결될 체인 미리보기 — 새 로그는 <b className="text-ink">{parentNode.title}</b> 아래에 들어갑니다</span>
          </div>
          <ChainBlock chain={preview} compact selectedId={parentNode.id} />
        </div>
      )}

      {type === "success" && parent !== ROOT && (
        <label className="flex items-start gap-3 rounded-lg border border-success-bg bg-success-bg/40 p-3 text-sm">
          <input type="checkbox" name="resolve_root" checked={resolveRoot} onChange={(e) => setResolveRoot(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-success)]" />
          <span>
            <span className="font-semibold text-success">이 성공 로그로 루트 장애를 완료 처리</span>
            <span className="mt-0.5 block text-xs text-ink-muted">체인의 시작 노드에 완료 표시가 붙고, 타임라인에서 &ldquo;완료&rdquo; 필터로 볼 수 있습니다. 나중에 타임라인에서도 바꿀 수 있습니다.</span>
          </span>
        </label>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="reset" variant="outline" size="lg" className="h-11 flex-1" onClick={() => { setType("fail"); setParent(ROOT); setPreview(null); setResolveRoot(false); }}>
          초기화
        </Button>
        <Button type="submit" size="lg" className="h-11 flex-[2]" disabled={busy}>{busy ? "등록 중…" : "등록하고 AI 정제"}</Button>
      </div>
      {error && <p className="text-sm text-fail">{error}</p>}
    </form>
  );
}
