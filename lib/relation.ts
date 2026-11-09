import type { PolicyRelation } from "@/lib/types/domain";

// 근거 조문 관계 표기 — 서버 컴포넌트(RevisionImpactCard)와 클라이언트(ChainBlock·PolicyRefsInput) 공용
export const relationLabel: Record<PolicyRelation, string> = { follows: "규정 따름", exception: "규정 예외", gap: "규정 없음" };
