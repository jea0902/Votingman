/**
 * 코인 분위기 페이지 (구 고수 포지션)
 *
 * - 코인 선물 유튜버 실시간 포지션 카드
 *  * 서버 컴포넌트 → 클라이언트 컴포넌트로 위임
 */

import MarketSentimentClient from "./MarketSentimentClient";


export const metadata = {
  title: "코인 분위기 | 보팅맨",
  description: "바이낸스 공식 데이터 기반 실시간 코인 분위기 지표",
};

export default function CoinMarketSentimentPage() {
  return <MarketSentimentClient />;
}
