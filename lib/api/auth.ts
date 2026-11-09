// 인증(세션) API — 브라우저 전용. 작업지시 C-3 / FE-008 §1 A.
// 쿠키는 Spring Session 이 발급·만료한다. 여기서는 요청만 보내고 결과를 {ok, ...} 로 돌려준다 — 실패를 삼키지 않는다.
// 요청·응답 모두 snake_case (application.yml property-naming-strategy).
import axios from "axios";
import type { Me } from "@/lib/types/domain";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";
const api = axios.create({ baseURL: BASE, withCredentials: true, headers: { "Content-Type": "application/json" } });
// 주의: client.ts 의 401 인터셉터를 붙이지 않는다 — 로그인 실패 401 을 그대로 받아야 문구를 보여줄 수 있다

export type AuthFail = { ok: false; status?: number; code?: string; message: string };
const fail = (e: unknown, fallback: string): AuthFail => {
  if (axios.isAxiosError(e)) {
    const b = e.response?.data as { code?: string; message?: string } | undefined;
    return { ok: false, status: e.response?.status, code: b?.code, message: b?.message ?? fallback };
  }
  return { ok: false, message: fallback };
};

export interface PasswordPolicy { rule: string; max_age_days: number; lock_after_failures: number; lock_minutes: number }

/** 사번+비밀번호. 401 은 계정 존재 여부를 숨기는 고정 문구, 423 ACCOUNT_LOCKED 는 서버 문구 그대로 */
export async function login(employeeNo: string, password: string): Promise<{ ok: true; me: Me } | AuthFail> {
  try {
    const { data } = await api.post<Me>("/auth/login", { employee_no: employeeNo.trim(), password });
    return { ok: true, me: data };
  } catch (e) {
    const f = fail(e, "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요");
    if (f.status === 401) f.message = "사번 또는 비밀번호가 올바르지 않습니다";
    return f;
  }
}

export async function me(): Promise<Me | null> {
  try {
    const { data } = await api.get<Me>("/me");
    return data;
  } catch {
    return null; // 로그인 안 됨 — 호출자가 "없음"으로 처리하는 조회라 null 이 맞다
  }
}

export async function logout(): Promise<void> {
  try { await api.post("/auth/logout"); } catch { /* 이미 만료된 세션이어도 첫 화면으로 간다 */ }
  // 의도적 전체 새로고침: 로그아웃 뒤 클라이언트 상태(검색 내역·대화 캐시)를 메모리에서 지운다
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (typeof window !== "undefined") window.location.assign("/login");
}

export async function consent(): Promise<{ ok: true } | AuthFail> {
  try { await api.post("/auth/consent"); return { ok: true }; } catch (e) { return fail(e, "동의 처리에 실패했습니다"); }
}

/** 400 PASSWORD_POLICY: message 가 " / " 로 이어진 위반 목록. 403: 현재 비밀번호 불일치 */
export async function changePassword(current: string, next: string): Promise<{ ok: true } | AuthFail> {
  try {
    await api.patch("/auth/password", { current_password: current, new_password: next });
    return { ok: true };
  } catch (e) {
    const f = fail(e, "비밀번호 변경에 실패했습니다");
    if (f.status === 403) f.message = "현재 비밀번호가 올바르지 않습니다";
    return f;
  }
}

/** 공개 API. 로그인·변경 화면 안내문 */
export async function passwordPolicy(): Promise<PasswordPolicy | null> {
  try { const { data } = await api.get<PasswordPolicy>("/auth/password-policy"); return data; } catch { return null; }
}

/** 개인정보 처리방침 문안(markdown). 공개 API. 서버 파일이 없으면 404 → null (운영은 data/legal 마운트 필요) */
export async function privacyPolicy(): Promise<string | null> {
  try { const { data } = await api.get<string>("/auth/privacy-policy", { responseType: "text", transformResponse: (x) => x }); return data; } catch { return null; }
}

/** 로그인 뒤 어디로 가는지 한 곳에서 결정 (FE-008 §1 B·D 공용) */
export function nextPathFor(m: Me, section = "timeline"): string {
  if (m.consent_required) return "/gate/consent";
  if (m.must_change_password) return "/gate/password";
  const wsId = m.workspace_id ?? m.workspaces[0]?.id;
  return wsId ? `/w/${wsId}/${section}` : "/gate/no-workspace";
}
