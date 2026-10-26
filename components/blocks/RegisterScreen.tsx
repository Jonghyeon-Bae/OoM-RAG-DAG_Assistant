"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LogForm } from "@/components/blocks/LogForm";
import { RefinePanel } from "@/components/blocks/RefinePanel";
import { fetchChain, fetchLogs } from "@/lib/api/client";
import type { Chain, LogNode } from "@/lib/types/domain";

function Toast({ message, href, onClose }: { message: string | null; href?: string; onClose: () => void }) {
  // 자동 닫힘 타이머 (외부 시스템 동기화)
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div role="status" className="fixed right-6 top-6 z-50 flex items-center gap-3 rounded-xl border border-success-bg bg-card px-4 py-3 text-sm shadow-lg">
      <CheckCircle2 className="size-5 text-success" />
      <span className="text-ink">{message}</span>
      {href && <Link href={href} className="rounded-md bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-200">타임라인에서 보기</Link>}
      <button type="button" onClick={onClose} className="ml-2 rounded p-1 text-ink-muted hover:bg-primary-100" aria-label="닫기"><X className="size-4" /></button>
    </div>
  );
}

export function RegisterScreen({ wsId, candidates: initialCandidates, initialRecent, initialParent, initialPreview }: { wsId: number; candidates: LogNode[]; initialRecent: LogNode[]; initialParent?: string; initialPreview?: Chain | null }) {
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; href: string } | null>(null);
  // 등록 직후: 후보 목록을 다시 받고(A2) 폼을 통째로 다시 마운트해 picker 내부 선택 상태까지 초기화(A1). 방금 만든 장애 건이 바로 후보에 보인다
  const [candidates, setCandidates] = useState(initialCandidates);
  const [formKey, setFormKey] = useState(0);
  const [nextParent, setNextParent] = useState<string | undefined>(initialParent);
  const [nextPreview, setNextPreview] = useState<Chain | null>(initialPreview ?? null);
  return (
    <main className="grid grid-cols-[440px_1fr] items-start gap-6 p-8">
      <Toast message={toast?.message ?? null} href={toast?.href} onClose={() => setToast(null)} />
      <Card className="p-6">
        <h2 className="mb-5 font-bold text-ink">마이크로 업무로그 간편 등록</h2>
        <LogForm
          key={formKey}
          wsId={wsId}
          candidates={candidates}
          onCreated={async (n) => {
            setCurrentId(n.id);
            setToast({ message: `"${n.title}" 등록됨 — AI가 정리를 시작합니다`, href: `/w/${wsId}/timeline?entry=${n.id}` });
            const [fresh, chain] = await Promise.all([fetchLogs(wsId), fetchChain(wsId, n.root_id)]);
            setCandidates(fresh);
            // 다음 로그는 같은 장애 건에 이어 적을 가능성이 높다 → 방금 등록한 로그의 장애 건을 미리 고른 상태(잠금 요약)로 시작
            setNextParent(String(n.root_id));
            setNextPreview(chain);
            setFormKey((k) => k + 1);
          }}
          initialParent={nextParent}
          initialPreview={nextPreview}
        />
      </Card>
      <RefinePanel wsId={wsId} currentId={currentId} initialRecent={initialRecent} />
    </main>
  );
}
