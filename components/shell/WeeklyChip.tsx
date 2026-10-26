"use client";
import { useEffect, useState } from "react";
import { Chip } from "@/components/ui";

export const LOG_CREATED_EVENT = "oom:log-created";

// 헤더 "이번 주 등록 N건" — 서버 초기값 + 등록 이벤트로 즉시 증가 (UX-003 B3). 실서버 전환 후에도 그대로 동작
export function WeeklyChip({ initial }: { initial: number }) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    const onCreated = () => setN((v) => v + 1);
    window.addEventListener(LOG_CREATED_EVENT, onCreated);
    return () => window.removeEventListener(LOG_CREATED_EVENT, onCreated);
  }, []);
  return <Chip>이번 주 등록 {n}건</Chip>;
}
