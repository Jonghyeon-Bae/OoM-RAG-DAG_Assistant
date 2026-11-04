"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { me, logout, nextPathFor } from "@/lib/api/auth";
import type { Me } from "@/lib/types/domain";

// 어느 게이트인지는 문자열로 받는다 — 함수를 prop 으로 받으면 렌더마다 새 참조라 effect 가 반복된다
const NEED: Record<GateKind, (m: Me) => boolean> = { consent: (m) => m.consent_required, password: (m) => m.must_change_password };
export type GateKind = "consent" | "password";

// 게이트 공용: 로그인 확인 → 이 게이트가 아직 필요한지 판단(아니면 다음 단계로) → 자식에 me 전달
export function GateFrame({ gate, children }: { gate: GateKind; children: (m: Me, done: () => Promise<void>) => React.ReactNode }) {
  const router = useRouter();
  const [m, setM] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    me().then((x) => {
      if (!alive) return;
      if (!x) { router.replace("/"); return; }
      if (!NEED[gate](x)) { router.replace(nextPathFor(x)); return; }
      setM(x);
    });
    return () => { alive = false; };
  }, [router, gate]);
  if (!m) return <p className="text-sm text-ink-muted">확인 중…</p>;
  const done = async () => { const x = await me(); router.replace(x ? nextPathFor(x) : "/"); };
  return (
    <div className="flex flex-col gap-5">
      {children(m, done)}
      <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-ink-muted">
        <span>{m.name} · {m.employee_no}</span>
        <Button type="button" variant="ghost" size="xs" onClick={() => logout()}>다른 계정으로 로그인</Button>
      </div>
    </div>
  );
}
