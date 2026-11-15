"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ListChecks, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LogForm } from "@/components/blocks/LogForm";
import { RefinePanel } from "@/components/blocks/RefinePanel";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/ui/ResponsiveSheet";
import { fetchChain, fetchLogs } from "@/lib/api/client";
import { LOG_CREATED_EVENT } from "@/components/shell/WeeklyChip";
import type { Chain, LogNode } from "@/lib/types/domain";

function Toast({ message, href, onClose, onResult }: { message: string | null; href?: string; onClose: () => void; onResult: () => void }) {
  // 자동 닫힘 타이머 (외부 시스템 동기화)
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-3 z-50 flex flex-wrap items-center gap-3 sm:inset-x-auto sm:right-6 sm:top-6 rounded-xl border border-success-bg bg-card px-4 py-3 text-sm shadow-lg">
      <CheckCircle2 className="size-5 text-success" />
      <span className="text-ink">{message}</span>
      {/* 폰: 정리 결과는 아래 창으로(UX-005 §3-2). PC 는 오른쪽 칸에 이미 보인다 */}
      <button type="button" onClick={() => { onResult(); onClose(); }} className="rounded-md bg-primary-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-800 lg:hidden pointer-coarse:min-h-11">정리 결과 보기</button>
      {href && <Link href={href} className="rounded-md bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-200 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">타임라인에서 보기</Link>}
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
  // 폰·태블릿: AI 정리 결과·최근 등록은 버튼으로 여는 창(UX-005 §3-2, #112). PC 는 오른쪽 칸 그대로
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <main className="grid items-start gap-4 p-3 sm:gap-6 md:p-6 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)] xl:p-8">
      <Toast message={toast?.message ?? null} href={toast?.href} onClose={() => setToast(null)} onResult={() => setSheetOpen(true)} />
      <Card className="min-w-0 overflow-visible p-4 sm:p-6">{/* overflow-visible: 고정 등록 바(sticky)가 카드 안에서 동작하도록 */}
        <div className="mb-4 flex items-center justify-between gap-2 sm:mb-5">
          <h2 className="font-bold text-ink">마이크로 업무로그 간편 등록</h2>
          <Button variant="outline" size="xs" className="shrink-0 lg:hidden" onClick={() => setSheetOpen(true)}><ListChecks className="size-3" /> {currentId ? "정리 결과 보기" : `최근 등록 ${initialRecent.length}`}</Button>
        </div>
        <LogForm
          key={formKey}
          wsId={wsId}
          candidates={candidates}
          onCreated={async (n) => {
            setCurrentId(n.id);
            window.dispatchEvent(new Event(LOG_CREATED_EVENT));
            setToast({ message: `"${n.title}" 등록됨 — AI가 정리를 시작합니다`, href: `/w/${wsId}/timeline?entry=${n.id}` });
            const [fresh, chain] = await Promise.all([fetchLogs(wsId), fetchChain(wsId, n.root_id, { summarize: false })]);
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
      <div className="hidden min-w-0 lg:block"><RefinePanel wsId={wsId} currentId={currentId} initialRecent={initialRecent} /></div>
      <ResponsiveSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={currentId ? "AI 정리 결과 · 최근 등록" : "최근 등록한 로그"} description="방금 등록한 로그의 정리 진행과 최근 기록">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{sheetOpen && <RefinePanel wsId={wsId} currentId={currentId} initialRecent={initialRecent} />}</div>
      </ResponsiveSheet>
    </main>
  );
}
