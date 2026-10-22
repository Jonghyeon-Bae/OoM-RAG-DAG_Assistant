"use client";
import { useState } from "react";
import { ArrowRight, ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { AnswerCard } from "@/components/blocks/AnswerCard";
import { SourceViewer } from "@/components/blocks/SourceViewer";
import type { MockAnswer } from "@/lib/api";
import type { Workspace } from "@/lib/types/domain";

// 화면 라벨 (데이터 아님). 훅 단계에서 PIPELINE 은 stage 이벤트로 교체
const PIPELINE = [
  { label: "Supervisor · 복합 질의", tone: "neutral" as const },
  { label: "Worker · 규정 RAG", tone: "primary" as const },
  { label: "Worker · 트러블슈팅 DAG", tone: "primary" as const },
  { label: "Critic · 출처 검증 통과", tone: "dark" as const },
];
const SUGGEST = ["재택근무 신청 기준은?", "E-504 오류 해결 사례", "최근 실패 로그 요약"];

export function AssistantScreen({ ws, answer }: { ws: Workspace; answer: MockAnswer }) {
  const [input, setInput] = useState("");
  const [activeRef, setActiveRef] = useState<string | null>(answer.policy[0]?.ref ?? null);
  const policyMode = ws.policy_enabled; // 규정 결합 모드에서만 근거 카드·출처 뷰어

  return (
    <main className={cn("grid flex-1 items-start gap-6 p-8", policyMode ? "grid-cols-[1fr_340px]" : "grid-cols-1")}>
      {/* 좌: 대화 영역 */}
      <section className="flex min-h-[calc(100vh-7rem)] flex-col">
        <div className="flex flex-1 flex-col gap-4">
          <div className="ml-auto max-w-[62%] rounded-2xl rounded-tr-sm bg-ink px-6 py-4 text-sm leading-relaxed text-white">{answer.query}</div>

          <div className="flex flex-wrap items-center gap-2">
            {PIPELINE.map((p, i) => (
              <span key={p.label} className="flex items-center gap-2">
                {(i === 1 || i === 3) && <ArrowRight className="size-4 text-ink-muted" />}
                <Chip tone={p.tone}>{p.label}</Chip>
              </span>
            ))}
          </div>

          <AnswerCard
            policy={answer.policy}
            policyText={answer.policy_text}
            chain={answer.chain}
            chainText={answer.chain_text}
            verified={answer.verified}
            unverified={answer.unverified}
            totalMs={answer.total_ms}
            onCite={setActiveRef}
          />
        </div>

        {/* 하단: 추천 질문 + 입력 */}
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGEST.map((s) => (
              <button key={s} type="button" onClick={() => setInput(s)} className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-ink transition-colors hover:border-primary-400 hover:bg-primary-50">
                {s}
              </button>
            ))}
          </div>
          <form className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 pl-5" onSubmit={(e) => e.preventDefault()}>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="규정이나 과거 장애 해결 사례를 자연어로 질문해 보세요" className="h-11 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
            <Button type="submit" size="lg" className="size-11 rounded-full p-0" disabled={!input.trim()} aria-label="질문 보내기">
              <ArrowUp className="size-5" />
            </Button>
          </form>
        </div>
      </section>

      {/* 우: 출처 원문 뷰어 (규정 결합 모드만) */}
      {policyMode && <SourceViewer sources={answer.policy} activeRef={activeRef} onSelect={setActiveRef} />}
    </main>
  );
}