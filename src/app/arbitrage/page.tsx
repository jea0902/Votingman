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
                        펀딩비가 높은 거래소에서 선물 숏 1배 + 현물 매수로 방향성 리스크 없이 수익 기회를 찾아보세요
                    </p>
                </div>

                {/* 펀딩비 테이블 */}
                <FundingRateTable />
            </div>
        </main>
    );
}