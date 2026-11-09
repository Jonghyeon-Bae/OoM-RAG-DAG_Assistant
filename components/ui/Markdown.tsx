// 서버가 주는 짧은 문안(개인정보 처리방침 등)용 최소 마크다운 렌더러.
// 지원: # 제목, > 인용, **굵게**, - 목록, | 표 |, 빈 줄 문단. HTML 은 해석하지 않는다(dangerouslySetInnerHTML 없음).
// 문안이 이보다 복잡해지면 react-markdown 도입을 검토한다 — 지금은 문서 1종이라 의존성을 늘리지 않는다 (지침 8)
import { Fragment } from "react";

function inline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={`${key}-${i}`} className="font-semibold text-ink">{p.slice(2, -2)}</strong> : <Fragment key={`${key}-${i}`}>{p}</Fragment>));
}
const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    const k = `b${i}`;
    if (!l.trim()) { i++; continue; }
    if (/^#{1,6}\s/.test(l)) { out.push(<p key={k} className="text-base font-bold text-ink">{inline(l.replace(/^#+\s/, ""), k)}</p>); i++; continue; }
    if (l.startsWith(">")) { out.push(<p key={k} className="border-l-2 border-primary-200 pl-3 text-xs">{inline(l.replace(/^>\s?/, ""), k)}</p>); i++; continue; }
    if (l.trim().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++]);
      const [head, , ...body] = rows; // 둘째 줄은 |---| 구분선
      out.push(
        <div key={k} className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-xs">
            <thead><tr>{cells(head).map((c, j) => <th key={j} className="border border-border bg-primary-100 px-2 py-1 text-left font-semibold text-ink">{inline(c, `${k}h${j}`)}</th>)}</tr></thead>
            <tbody>{body.map((r, ri) => <tr key={ri}>{cells(r).map((c, j) => <td key={j} className="border border-border px-2 py-1 align-top">{inline(c, `${k}r${ri}c${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^[-*]\s/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s/, ""));
      out.push(<ul key={k} className="list-disc pl-5">{items.map((t, j) => <li key={j}>{inline(t, `${k}l${j}`)}</li>)}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|>|\||[-*]\s)/.test(lines[i].trim())) para.push(lines[i++]);
    out.push(<p key={k}>{inline(para.join(" "), k)}</p>);
  }
  return <div className={className}>{out}</div>;
}
