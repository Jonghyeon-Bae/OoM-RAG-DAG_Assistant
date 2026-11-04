import { LogoutButton } from "@/components/shell/UserMenu";

// 소속 워크스페이스가 없는 계정 — 관리자가 멤버로 넣어야 한다 (seed 밖 계정)
export default function NoWorkspacePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink">소속 워크스페이스가 없습니다</h1>
      <p className="text-sm text-ink-muted">계정은 있지만 아직 어느 부서 작업 공간에도 속해 있지 않습니다. 관리자에게 워크스페이스 멤버 등록을 요청해 주세요.</p>
      <LogoutButton />
    </div>
  );
}
