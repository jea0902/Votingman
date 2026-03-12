/**
 * AI 분석 페이지
 *
 * - AI 계정들이 투표를 운용하는 구조
 * - 최상단: AI 리더보드 (ChatGPT, Gemini, Claude, Grok 누적 승률/MMR/순위)
 */

import AIAnalysisClient from "./AIAnalysisClient";

export const metadata = {
  title: "AI 분석 | 보팅맨",
  description: "AI 모델들의 투표 성과를 실시간으로 확인하세요",
};

export default function AIAnalysisPage() {
  return <AIAnalysisClient />;
}
