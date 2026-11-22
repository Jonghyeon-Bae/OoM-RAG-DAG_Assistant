import type { Me } from "@/lib/types/domain";

// 화면 권한 판정 한 곳 (FE-013 §3.5). 백엔드 권한 모델이 바뀌면 여기만 고친다.
// wsAdmin = 이 워크스페이스의 admin(멤버 초대·잠금 해제), canConfigure = 이 부서 또는 상위의 admin(부서 설정)
export function accessOf(me: Me, wsId: number) {
  const m = me.workspaces.find((w) => w.id === wsId);
  // 멤버 관리 = 그 부서 admin 이거나 회사 관리자(백엔드 #54). 서버의 실제 확인과 같은 조건인 permissions 를 먼저 본다
  const wsAdmin = !!m && (m.permissions ? m.permissions.includes("admin.members") : m.role === "admin" || me.company_admin);
  const canConfigure = !!m?.can_configure || me.company_admin;
  return { wsAdmin, canConfigure, adminMenu: wsAdmin || canConfigure };
}
