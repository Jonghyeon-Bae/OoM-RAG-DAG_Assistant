import { cn } from "@/components/ui";

// 조문 안의 표(별표 등). 글에 섞여 오는 "| 칸 | 칸 |" 줄을 표로 그린다.
// 칸이 많으면(4칸 이상) 표에 최소 폭을 두고 표만 옆으로 민다 — 좁은 화면에서 글자가 한 자씩 세로로 쪼개지지 않게.
// used: 답변에 쓰인 줄인가(근거 칸에서만 넘긴다). 그 줄은 답변 문장과 같은 색으로 칠한다
export function PolicyTable({ head, rows, used }: { head: string[] | null; rows: string[][]; used?: (row: number) => boolean }) {
  const cols = head?.length ?? rows[0]?.length ?? 1;
  const wide = cols > 3;
  const anyUsed = !!used && rows.some((_, i) => used(i));
  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse break-keep text-left text-sm leading-relaxed" style={wide ? { minWidth: `${Math.min(cols, 6) * 6}rem` } : undefined}>
          {head && (
            <thead>
              <tr>{head.map((c, j) => <th key={j} scope="col" className="border-b border-border bg-primary-100 px-3 py-2 font-semibold text-ink">{c}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {rows.map((r, i) => {
              const hit = !!used?.(i);
              return (
                <tr key={i} data-used={hit ? "" : undefined} className={cn("border-b border-border last:border-b-0", hit ? "bg-primary-200 text-ink" : anyUsed ? "text-ink-muted" : "text-ink")}>
                  {r.map((c, j) => <td key={j} className={cn("px-3 py-2 align-top", hit && j === 0 && "shadow-[inset_3px_0_0_var(--color-primary-700)]")}>{c}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* 오른쪽 칸이 넓은 화면(1280px~)에서는 다 보이므로 안내를 숨긴다 */}
      {wide && <p className="text-xs text-ink-muted xl:hidden">표를 옆으로 밀면 나머지 칸이 보입니다.</p>}
    </div>
  );
}