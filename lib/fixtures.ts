// 1단계 정적 데이터. 2단계에서 mocks/ + 타입으로 대체한다.
export type LogType = "fail" | "success" | "ref";

export const workspaces = [
  { id: 1, name: "SW 개발", policy_enabled: false },
  { id: 2, name: "인사·총무", policy_enabled: true },
  { id: 3, name: "고객지원(CS)", policy_enabled: true },
];

export const demoUsers = [
  { id: 1, name: "배종현", title: "팀장", workspace_id: 1 },
  { id: 2, name: "장문경", title: "매니저", workspace_id: 1 },
  { id: 3, name: "신동준", title: "주임", workspace_id: 2 },
  { id: 4, name: "홍경표", title: "주임", workspace_id: 3 },
];

export const nav = [
  { href: "assistant", label: "AI 어시스턴트" },
  { href: "timeline", label: "트러블슈팅 타임라인" },
  { href: "logs/new", label: "업무로그 등록" },
  { href: "dashboard", label: "성과 대시보드" },
  { href: "documents", label: "규정 문서 관리", policyOnly: true },
];

export const typeLabel: Record<LogType, string> = { fail: "실패", success: "성공", ref: "참고" };

export const recentLogs: { id: number; type: LogType; title: string }[] = [
  { id: 101, type: "success", title: "NTP 동기화로 토큰 만료 오류 해소" },
  { id: 102, type: "ref", title: "게이트웨이 인증 로그 확인 방법" },
];

export const refineSample = {
  error_code: "E-403",
  keywords: ["VPN", "토큰 갱신", "배치 중단", "인증"],
  resolution_summary: "토큰 갱신 배치 주기를 30분으로 변경해 재발 방지",
  refine_status: "done" as const,
  elapsed_ms: 1800,
  parent_path: "root.e403.cause1",
};
