// 날짜·시각 표기 한 곳 (#130, 백엔드 11/20 "날짜 표기" 안내).
// 서버(Node)와 브라우저가 같은 글자를 내도록: 시간대는 한국(Asia/Seoul) 고정, 24시간 표기, 숫자만 뽑아 직접 이어 붙인다.
// toLocaleString("ko-KR") 는 Node 가 "AM", 크롬이 "오전"을 찍어 Hydration 오류가 났고, 시간대를 적지 않아 UTC 서버에서는 9시간 어긋난다.
const KST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** pattern 의 YYYY · YY · MM · M · DD · D · HH · mm · ss 를 한국 시각의 값으로 바꾼다. 예: fmtKst(iso, "M. D. HH:mm") → "11. 20. 03:13" */
export function fmtKst(iso: string | null | undefined, pattern: string, empty = "-"): string {
  if (!iso) return empty;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return empty;
  const p = Object.fromEntries(KST.formatToParts(d).map((x) => [x.type, x.value])) as Record<string, string>;
  const v: Record<string, string> = { YYYY: p.year, YY: p.year.slice(2), MM: p.month, M: String(Number(p.month)), DD: p.day, D: String(Number(p.day)), HH: p.hour, mm: p.minute, ss: p.second };
  return pattern.replace(/YYYY|YY|MM|M|DD|D|HH|mm|ss/g, (t) => v[t]);
}
