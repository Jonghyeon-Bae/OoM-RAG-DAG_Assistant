// 조문 표기에서 번호만 뽑는다 (근거 칩·규정 원문 탭 공용)
// "제24조 (매장 구입 상품의 교환·환불)" → "제24조", "[별표 1] 판매 경로…" → "[별표 1]", "Q9. 주문한…" → "Q9"
export function shortArticle(label: string): string {
  const m = /^(\[[^\]]+\]|제\s?\d+조(?:의\s?\d+)?|Q\d+)/.exec(label.trim());
  return m ? m[1] : label.trim().split(" ")[0];
}