// 조문 글을 화면에 그릴 덩이로 나누고(①②③ 항 · 표), 답변 문장과 글이 겹치는 덩이를 고른다.
// 어시스턴트의 근거 칸(SourceViewer)과 원문 창(PolicyDocDialog)이 같이 쓴다.

// at = 이 덩이의 첫 조각 번호. 조각 = 항 하나 또는 표의 한 줄(머리글 제외) — partsOf() 가 돌려주는 배열의 자리와 같다
export type PolicyBlock =
  | { kind: "clause"; at: number; text: string }
  | { kind: "table"; at: number; head: string[] | null; rows: string[][] };

const isRow = (line: string) => line.trim().startsWith("|");
const isRule = (line: string) => /^[\s|:-]*-[\s|:-]*$/.test(line); // |---|---| 구분선
const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

// 긴 표는 여러 조각으로 나뉘어 온다. 조각 id 끝 번호가 1 이 아니면 이어지는 조각 — 머리글 없이 내용 줄부터 시작한다
export function isFirstPiece(chunkId: string): boolean {
  const m = /-(\d+)$/.exec(chunkId);
  return !m || m[1] === "1";
}

export function policyBlocks(text: string, firstPiece = true): PolicyBlock[] {
  const out: PolicyBlock[] = [];
  let at = 0;
  let prose: string[] = [];
  const flush = () => {
    for (const c of prose.join("\n").split(/(?=[①-⑮])/)) if (c.trim()) out.push({ kind: "clause", at: at++, text: c.trim() });
    prose = [];
  };
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    if (!isRow(lines[i])) { prose.push(lines[i++]); continue; }
    const opensChunk = out.length === 0 && !prose.join("").trim(); // 이 표가 조각의 맨 앞인가
    flush();
    const raw: string[] = [];
    while (i < lines.length && isRow(lines[i])) raw.push(lines[i++]);
    const all = raw.filter((l) => !isRule(l)).map(cells);
    if (all.length === 0) continue;
    const width = Math.max(...all.map((r) => r.length));
    const even = all.map((r) => [...r, ...Array<string>(width - r.length).fill("")]); // 칸 수가 모자란 줄은 빈칸으로 채운다
    // 첫 줄을 머리글로 보는 경우: 구분선이 따라오거나, 이어지는 조각의 맨 앞이 아닐 때
    const hasHead = even.length > 1 && ((raw.length > 1 && isRule(raw[1])) || firstPiece || !opensChunk);
    const rows = hasHead ? even.slice(1) : even;
    out.push({ kind: "table", at, head: hasHead ? even[0] : null, rows });
    at += rows.length;
  }
  flush();
  return out;
}

// 조각 글 목록: 항은 그 글, 표는 한 줄씩(칸을 이어 붙여)
export const partsOf = (blocks: PolicyBlock[]): string[] => blocks.flatMap((b) => (b.kind === "clause" ? [b.text] : b.rows.map((r) => r.join(" "))));

const MARK = /^\[[PN]\d+\]$/;
// 답변 한 줄을 번호([P1]·[N2]) 기준으로 자른 것
export const splitMarks = (line: string): string[] => line.split(/(\[[PN]\d+\])/g);
// segs[j](글)가 ref 번호의 문장인가 — 바로 뒤에 붙은 번호들 가운데 ref 가 있으면 그렇다. [P1][P2] 처럼 연달아 붙으면 둘 다 같은 문장을 가리킨다
export function citesRef(segs: string[], j: number, ref: string | null): boolean {
  if (!ref || !segs[j].trim()) return false;
  for (let k = j + 1; k < segs.length; k++) {
    if (segs[k] === `[${ref}]`) return true;
    if (segs[k].trim() && !MARK.test(segs[k])) return false;
  }
  return false;
}
// 답변에서 ref 번호가 붙은 문장들
export function citedSentences(answer: string, ref: string): string[] {
  return answer.split("\n").flatMap((line) => { const segs = splitMarks(line); return segs.filter((s, j) => !MARK.test(s) && citesRef(segs, j, ref)); });
}

// ── 답변에 쓰인 조각 고르기 ──────────────────────────────────────────────────
// 서버는 "몇 번째 항을 썼는지"를 알려 주지 않는다. 그래서 글자가 얼마나 겹치는지로 추정한다(틀릴 수 있다 — 화면에 그렇게 적는다).
// 방법: 문장과 조각을 두 글자씩 묶어, 문장의 묶음 가운데 조각에도 있는 비율을 잰다.
const MIN_SHARE = 0.3; // 이 비율보다 낮으면 겹친다고 보지 않는다
const NEAR_BEST = 0.6; // 가장 많이 겹친 조각의 이 배수 이상이면 함께 고른다(한 문장이 두 항을 묶어 쓴 경우)
const MIN_PAIRS = 5;   // 겹친 묶음이 이보다 적으면 우연으로 본다("합니다" 같은 흔한 말)
const pairs = (s: string): Set<string> => {
  const t = s.replace(/[^0-9a-zA-Z가-힣]/g, "");
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
};
export function usedParts(sentences: string[], parts: string[]): Set<number> {
  const used = new Set<number>();
  if (parts.length < 2) return used; // 조각이 하나뿐이면 고를 것이 없다
  const partPairs = parts.map(pairs);
  for (const sentence of sentences) {
    const sp = pairs(sentence);
    if (sp.size === 0) continue;
    // 겹친 묶음 수, 그리고 문장·조각 중 짧은 쪽에서 차지하는 비율(표의 한 줄처럼 조각이 짧으면 조각 쪽을 기준으로)
    const hits = partPairs.map((pp) => { let n = 0; for (const g of sp) if (pp.has(g)) n++; return { n, share: n / Math.max(1, Math.min(sp.size, pp.size)) }; });
    const ok = hits.map((h) => h.n >= MIN_PAIRS && h.share >= MIN_SHARE);
    const best = Math.max(0, ...hits.filter((_, i) => ok[i]).map((h) => h.n));
    hits.forEach((h, i) => { if (ok[i] && h.n >= best * NEAR_BEST) used.add(i); });
  }
  return used;
}