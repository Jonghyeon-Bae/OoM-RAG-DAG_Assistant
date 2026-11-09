// 워크스페이스 모드 = 규정 사용(policy_enabled) × 사례 사용(case_enabled). 표기·분기는 여기 한 곳에서만 정한다 (FE-012 P0-3)
// 둘 다 끈 상태는 없다 — DB CHECK (policy_enabled OR case_enabled) (백엔드 V8)
type Flags = { policy_enabled: boolean; case_enabled: boolean };
export type WsMode = "both" | "policy" | "case";

export const modeOf = (w: Flags): WsMode => (w.policy_enabled && w.case_enabled ? "both" : w.policy_enabled ? "policy" : "case");

export const modeLabel: Record<WsMode, string> = { both: "규정 + 해결 사례", policy: "규정만", case: "해결 사례만" };
export const modeShort: Record<WsMode, string> = { both: "규정 + 사례", policy: "규정만", case: "사례만" };
export const modeTone = (m: WsMode) => (m === "case" ? "neutral" : "primary") as "primary" | "neutral";

// 사례를 쓰지 않는 부서에서 타임라인·등록을 열었을 때의 안내 (D-1 기본안: 메뉴 비활성 + 안내)
export const caseOffNotice = "이 워크스페이스는 해결 사례를 쓰지 않습니다. 규정 질문은 AI 어시스턴트에서 할 수 있습니다.";
