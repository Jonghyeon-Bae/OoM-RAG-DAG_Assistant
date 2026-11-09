"use client";
import { useEffect, useState } from "react";
import { Markdown } from "@/components/ui/Markdown";
import { privacyPolicy } from "@/lib/api/auth";

// 개인정보 처리방침 본문 — 동의 게이트와 같은 서버 문안(GET /auth/privacy-policy). 펼칠 때만 받는다
export function PrivacyText() {
  const [text, setText] = useState<string | null | undefined>(undefined);
  useEffect(() => { privacyPolicy().then(setText); }, []);
  if (text === undefined) return <p className="text-sm text-ink-muted">불러오는 중…</p>;
  if (text === null) return <p className="text-sm text-fail">처리방침을 불러오지 못했습니다.</p>;
  return <Markdown text={text} className="flex flex-col gap-3 text-sm text-ink-muted" />;
}
