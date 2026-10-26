"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LogForm } from "@/components/blocks/LogForm";
import { RefinePanel } from "@/components/blocks/RefinePanel";
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

export function RegisterScreen({ wsId, candidates, initialRecent, initialParent, initialPreview }: { wsId: number; candidates: LogNode[]; initialRecent: LogNode[]; initialParent?: string; initialPreview?: Chain | null }) {
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; href: string } | null>(null);
  return (
    <main className="grid grid-cols-[440px_1fr] items-start gap-6 p-8">
      <Toast message={toast?.message ?? null} href={toast?.href} onClose={() => setToast(null)} />
      <Card className="p-6">
        <h2 className="mb-5 font-bold text-ink">마이크로 업무로그 간편 등록</h2>
        <LogForm
          wsId={wsId}
          candidates={candidates}
          onCreated={(n) => {
            setCurrentId(n.id);
            setToast({ message: `"${n.title}" 등록됨 — AI가 정리를 시작합니다`, href: `/w/${wsId}/timeline?entry=${n.id}` });
          }}
          initialParent={initialParent}
          initialPreview={initialPreview}
        />
      </Card>
      <RefinePanel wsId={wsId} currentId={currentId} initialRecent={initialRecent} />
    </main>
  );
}
