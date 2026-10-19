"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { LogForm } from "@/components/blocks/LogForm";
import { RefinePanel } from "@/components/blocks/RefinePanel";
import type { LogNode } from "@/lib/types/domain";

export function RegisterScreen({ wsId, candidates, initialRecent }: { wsId: number; candidates: LogNode[]; initialRecent: LogNode[] }) {
  const [currentId, setCurrentId] = useState<number | null>(null);
  return (
    <main className="grid grid-cols-[440px_1fr] items-start gap-6 p-8">
      <Card className="p-6">
        <h2 className="mb-5 font-bold text-ink">마이크로 업무로그 간편 등록</h2>
        <LogForm wsId={wsId} candidates={candidates} onCreated={(n) => setCurrentId(n.id)} />
      </Card>
      <RefinePanel wsId={wsId} currentId={currentId} initialRecent={initialRecent} />
    </main>
  );
}
