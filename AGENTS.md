<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:oom-working-rules (canonical — CLAUDE.md, .agent/rules 가 이 섹션을 참조) -->

## OoM 작업 지침 (Claude Code / Antigravity 공통)

메인 디렉토리: `C:\Users\Admin\Desktop\KTCS_어시스턴트\Project\project-oom`

1. **요청 범위 엄수** — 사용자가 요구하지 않은 작업은 실행하지 않는다. 필요하거나 권장되는 기능은 실행 대신 *제안*으로만 남긴다.
2. **대화 톤** — 저변동·고정밀(temperature 0.1~0.2 상당). 수식어·추측 최소화, 근거 중심. 사용자와 대등 이상의 개발 파트너로서 이견이 있으면 근거와 함께 명시한다.
3. **연구노트 기록 의무** — 사용자가 진행/요청한 모든 작업을 성공·실패 무관하게 `docs/LAB_NOTEBOOK.md` 에 타임라인으로 누적 기록한다. 기존 항목은 수정하지 않고 추가만 한다(정정은 새 항목으로).
4. **점진적 개발 단위** — 기능(함수) → 블럭 → 컴포넌트 순으로 쌓아 올린다. 사용자 요청 없이 전체 코드 검수를 하지 않으며, 요청된 검토와 직접 연관된 범위만 확인한다.
5. **코드 프리징** — 완성된 기능은 `docs/FROZEN.md` 에 등록하고 이후 수정하지 않는다. 수정이 필요하면 사용자에게 해제(Unfreeze) 승인을 먼저 받고, 해제/재프리징 모두 연구노트에 기록한다.
6. **도구 연동** — 사용자는 Antigravity와 Claude Code를 병행한다. 지침의 원본은 이 섹션 하나이며, 두 도구 모두 이 파일과 `docs/` 를 공유 상태로 사용한다.
7. **포트폴리오 기록** — 사용자가 수행한 모든 작업은 포트폴리오 소재다. 연구노트 항목을 쓸 때마다 `docs/private/portfolio/log.md`에 같은 ID로 항목을 추가하고, 성격에 따라 `decisions.md`(결정) / `problems.md`(문제 해결) / `metrics.md`(수치)에 함께 기록한다. `PORTFOLIO.md`(조립본)는 주 1회·큰 결정 직후 갱신. 구조·규칙은 `docs/private/portfolio/README.md`. 발생 시점에 기록하고 사후 재구성하지 않는다.

8. **오버엔지니어링 금지** — 시연 시나리오(A~D), 검증 계획, 또는 사용자가 명시한 운영 요구에 직접 연결되지 않는 기능·계층·추상화는 구현하지 않고 제안에만 둔다. 제안할 때는 ① 비용(PD) ② 근거 시나리오·요구 ③ 빼면 생기는 결과를 함께 적는다. 같은 목적을 이미 달성하는 장치가 있으면 중복 장치를 두지 않는다. 확장 지점·추상화는 두 번째 사용처가 실제로 생길 때 만든다. "나중에 필요할 것"은 v1.1 목록에 적고 지금 만들지 않는다. 자기 제안도 이 규칙으로 재검토해 제거 항목을 명시한다.

9. **버전·후속 항목 관리** — 버전은 `대규모.중규모.소규모.버그픽스`(예 1.0.0.0). 현재 버전은 `VERSION`, 이력은 `CHANGELOG.md`에 상시 갱신한다. MVP 1.0 범위 밖으로 판정된 기능·조치는 판정 시점에 `docs/ROADMAP.md`에 사유·근거·추정 비용과 함께 등록한다. "나중에"라고 말만 하고 등록하지 않는 것을 금지한다.

<!-- END:oom-working-rules -->
