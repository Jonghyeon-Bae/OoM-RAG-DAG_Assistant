<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:oom-working-rules (canonical — CLAUDE.md, .agent/rules 가 이 섹션을 참조) -->

## OoM 작업 지침 (Claude Code / Antigravity 공통)


1. **요청 범위 엄수** — 사용자가 요구하지 않은 작업은 실행하지 않는다. 필요하거나 권장되는 기능은 실행 대신 *제안*으로만 남긴다.
2. **대화 톤** — 저변동·고정밀(temperature 0.1~0.2 상당). 수식어·추측 최소화, 근거 중심. 사용자와 대등 이상의 개발 파트너로서 이견이 있으면 근거와 함께 명시한다.
3. **연구노트 기록 의무** — 사용자가 진행/요청한 모든 작업을 성공·실패 무관하게 `docs/LAB_NOTEBOOK.md` 에 타임라인으로 누적 기록한다. 기존 항목은 수정하지 않고 추가만 한다(정정은 새 항목으로). **코드 변경이 없어도 문제 해결 1건(환경·기동·대화로 푼 것)은 항목 1건이다.** 필드는 고정: `도구 / 상위: #NNN / 요청 / 수행 / 결과(✅❌⚠️⏸) / 원인·관찰 / 교훈·다음 단계 / 관련` — 완성 후 DAG 샘플데이터(설계 §4-1)로 변환하므로 필드를 빼거나 이름을 바꾸지 않는다.
4. **점진적 개발 단위** — 기능(함수) → 블럭 → 컴포넌트 순으로 쌓아 올린다. 사용자 요청 없이 전체 코드 검수를 하지 않으며, 요청된 검토와 직접 연관된 범위만 확인한다.
5. **코드 프리징** — 완성된 기능은 `docs/FROZEN.md` 에 등록하고 이후 수정하지 않는다. 수정이 필요하면 사용자에게 해제(Unfreeze) 승인을 먼저 받고, 해제/재프리징 모두 연구노트에 기록한다.
6. **도구 연동** — 사용자는 Antigravity와 Claude Code를 병행한다. 지침의 원본은 이 섹션 하나이며, 두 도구 모두 이 파일과 `docs/` 를 공유 상태로 사용한다.
7. **포트폴리오 기록** — 사용자가 수행한 모든 작업은 포트폴리오 소재다. 연구노트 항목을 쓸 때마다 `docs/private/portfolio/log.md`에 같은 ID로 항목을 추가하고, 성격에 따라 `decisions.md`(결정) / `problems.md`(문제 해결) / `metrics.md`(수치)에 함께 기록한다. `PORTFOLIO.md`(조립본)는 주 1회·큰 결정 직후 갱신. 구조·규칙은 `docs/private/portfolio/README.md`. 발생 시점에 기록하고 사후 재구성하지 않는다.

8. **오버엔지니어링 금지** — 시연 시나리오(A~D), 검증 계획, 또는 사용자가 명시한 운영 요구에 직접 연결되지 않는 기능·계층·추상화는 구현하지 않고 제안에만 둔다. 제안할 때는 ① 비용(PD) ② 근거 시나리오·요구 ③ 빼면 생기는 결과를 함께 적는다. 같은 목적을 이미 달성하는 장치가 있으면 중복 장치를 두지 않는다. 확장 지점·추상화는 두 번째 사용처가 실제로 생길 때 만든다. "나중에 필요할 것"은 v1.1 목록에 적고 지금 만들지 않는다. 자기 제안도 이 규칙으로 재검토해 제거 항목을 명시한다.

9. **버전·후속 항목 관리** — 버전은 `대규모.중규모.소규모.버그픽스`(예 1.0.0.0). 현재 버전은 `VERSION`, 이력은 `CHANGELOG.md`에 상시 갱신한다. MVP 1.0 범위 밖으로 판정된 기능·조치는 판정 시점에 `docs/ROADMAP.md`에 사유·근거·추정 비용과 함께 등록한다. "나중에"라고 말만 하고 등록하지 않는 것을 금지한다.

10. **커밋 문장 제안** — 작업 단위가 끝날 때마다 답변 말미에 그 변경분의 git 커밋 메시지를 정리해 준다. 형식: 제목 1줄(`type(scope): 요약`, 한국어 가능) + 본문 3~6줄(무엇을·왜, 관련 연구노트 번호·문서 ID). 커밋 실행은 사용자가 한다(지침 1). 변경이 여러 성격이면 커밋을 나누어 제안한다.

11. **증상 → 원인은 코드로 확인한 뒤 말한다** — "인증 문제 같다", "라우팅이 풀린 듯"은 가설이다. 해당 코드·서버 응답·DB 값 중 하나를 읽어 원인을 특정한 뒤에 답하고, 확인하지 못한 부분은 "추정"이라 표기한다. 사용자의 해석도 같은 기준으로 맞음/보정을 항목별로 답한다(#075 방식).

12. **타 파트 결함은 우회하지 않는다** — 백엔드 응답·동작이 계약과 다르거나 결함이면 프론트에서 우회 코드를 넣지 않고 원인·수정 위치·운영 영향을 적어 전달한다. 수정이 1줄이어도 백엔드 레포는 `main` 직접 커밋 금지, 브랜치 → PR. 로컬에서 먼저 적용해 검증하는 것은 허용(#080).

13. **기동·환경 가이드 유지** — `docs/guide/RUN_BACKEND.md`·`RUN_FRONTEND.md`는 "담당자가 없어도 상대 파트를 띄울 수 있다"가 기준이다. 사용자가 막힌 지점은 그날 **에러 첫 줄 → 원인 → 조치** 행으로 §막힘 표에 추가한다. 첫 줄에 "어느 셸(Git Bash/PowerShell)에서"를 명시한다.

14. **실서버 확인이 완료의 기준** — FROZEN 등록은 로컬 실서버(또는 운영)에서 동작을 본 시점에, FE-009 항목 번호를 근거로 적는다. 코드만 보고 쓴 문서(USER_GUIDE 등)는 "코드 기준 초안"이라 표기하고 실서버 통과 후 갱신한다. 목업 통과는 완료가 아니다.

15. **범위 재배정은 즉시 기록·통보** — 다른 팀원 범위를 선진행했거나 범위가 바뀌면 담당표(FE-008류)를 같은 턴에 갱신하고, 당사자에게 전할 한 줄("A~E 완료 → H·J1로")을 답변에 포함한다. 선진행 사유는 연구노트에 남긴다.

16. **테스트는 ISTQB CTFL v4.0.1 기법으로, 산출물은 `docs/qa/`에** — 테스트 요청은 대상 성격에 맞는 기법(동등 분할·경계값·결정 테이블·상태 전이·분기 커버리지·탐색·체크리스트·인수 조건)을 골라 커버리지 항목과 실행 비율을 적는다. 계획·설계·세션·체크리스트·결함·보고는 `docs/qa/` 하위 폴더에 ID(TP/TD/ES/CL/D/TR)로 보관하고, 결함은 `docs/qa/defects/DEFECTS.md` 한 대장에 상태·심각도·우선순위와 함께 누적한다. 실행 못 한 항목은 ⏸로 남기며 측정 없는 "통과"는 쓰지 않는다. 결함 원인이 반복되면 체크리스트·지침에 반영(QA 환류). 기준·폴더 규칙은 `docs/qa/README.md`.

<!-- END:oom-working-rules -->
