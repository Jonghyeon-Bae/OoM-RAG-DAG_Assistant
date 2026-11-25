// 연구노트 사례 대응표(scripts/notebook_cases.json) 규칙 검사(드라이런). 서버로 보내지 않는다.
// 검사 기준 = 백엔드 LogBulkService(POST /logs/bulk): 500건 이하 · ref 중복 없음 · 제목 200/본문 5,000 ·
// 성공은 실패/참고 아래에만 · 상위 없는 성공은 problem_title 필요 · category 는 상위가 있을 때만(cause=실패, prevention=성공)
// 사용: node scripts/notebook_load.mjs            → 검사 결과와 요약 출력
//       node scripts/notebook_load.mjs --out f.json → 서버에 보낼 본문({items})을 파일로 저장
import { readFileSync, writeFileSync } from "node:fs";
const doc = JSON.parse(readFileSync(new URL("./notebook_cases.json", import.meta.url), "utf8"));
const items = doc.items, byRef = new Map(), errs = [];
const TYPES = ["fail", "success", "ref"];
if (!items.length || items.length > 500) errs.push(`건수 ${items.length} (1 ~ 500)`);
for (const it of items) {
  const e = (m) => errs.push(`${it.ref}: ${m}`);
  if (byRef.has(it.ref)) e("ref 중복");
  if (!TYPES.includes(it.type)) e("type 은 fail|success|ref");
  if (!it.title?.trim() || !it.body?.trim()) e("제목·본문 필수");
  if ((it.title ?? "").length > 200) e(`제목 ${it.title.length}자 > 200`);
  if ((it.body ?? "").length > 5000) e(`본문 ${it.body.length}자 > 5000`);
  if (!it.source_ref) e("source_ref 없음(다시 돌릴 때 중복 방지에 필요)");
  if (Number.isNaN(Date.parse(it.created_at))) e("created_at 형식");
  const parents = [it.parent_ref, ...(it.parent_refs ?? [])].filter(Boolean);
  for (const p of parents) {
    const pt = byRef.get(p);
    if (!pt) e(`상위 ${p} 가 앞에 없음`);
    else {
      if (it.type === "success" && pt.type === "success") e("성공은 실패·참고 아래에만 붙는다(EDGE_PARENT_TYPE)");
      if (Date.parse(it.created_at) < Date.parse(pt.created_at)) e(`상위(${p})보다 시각이 이르다`);
    }
  }
  if (!parents.length && it.type === "success" && !it.problem_title) e("상위 없는 성공은 problem_title 필요");
  if (it.category && !parents.length) e("category 는 상위가 있어야 한다");
  if (it.category === "cause" && it.type !== "fail") e("cause 는 실패 기록에만");
  if (it.category === "prevention" && it.type !== "success") e("prevention 은 성공 기록에만(CATEGORY_INVALID)");
  if (it.resolves && it.type !== "success") e("resolves 는 성공 기록에만");
  byRef.set(it.ref, it);
}
const roots = items.filter((i) => !i.parent_ref && !(i.parent_refs ?? []).length);
console.log(`기록 ${items.length}건 · 장애 건 ${roots.length}건 · 실패 ${items.filter((i) => i.type === "fail").length} / 성공 ${items.filter((i) => i.type === "success").length} / 참고 ${items.filter((i) => i.type === "ref").length}`);
for (const r of roots) console.log(` - ${r.source_ref.split("-")[0]}  ${r.title}`);
if (errs.length) { console.error(`\n규칙 위반 ${errs.length}건`); for (const m of errs) console.error(" ✗ " + m); process.exit(1); }
console.log("\n규칙 검사 통과 — 서버로 보내지 않았습니다.");
const out = process.argv.indexOf("--out");
if (out > 0 && process.argv[out + 1]) { writeFileSync(process.argv[out + 1], JSON.stringify({ items }, null, 1)); console.log(`보낼 본문 저장: ${process.argv[out + 1]}`); }
