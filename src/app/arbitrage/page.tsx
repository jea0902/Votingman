import { FundingRateTable } from "@/components/arbitrage/FundingRateTable";

export const metadata = {
    title: "아비트라지 | Votingman",
    description: "거래소별 펀딩비 현황 및 아비트라지 기회",
};

export default function ArbitragePage() {
    return (
        <main className="min-h-screen px-4 py-8 md:px-8">
            <div className="mx-auto max-w-[1600px]">
                {/* 페이지 타이틀 */}
                <div className="mb-6">
                    <h1 className="text-xl font-bold text-foreground">아비트라지</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        바이낸스 거래량 상위 200종 기준, 펀딩비가 +0.1% 이상이면 숏·현물 롱, -0.1% 이하면 롱·현물 숏 등
                        거래소별 펀딩만 모아 봅니다. ±0.1% 안쪽은 목록·셀에서 제외합니다.
                    </p>
                </div>

                {/* 펀딩비 테이블 */}
                <FundingRateTable />
            </div>
        </main>
    );
}