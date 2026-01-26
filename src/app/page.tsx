const stockCards = [
  {
    name: "Apple",
    logo: "A",
    ticker: "AAPL",
    qualityCriteria: "ROE 25%↑ / 부채비율 30%↓",
    undervalueCriteria: "적정가 대비 -22%",
    fairValue: "$210",
    status: "undervalued",
  },
  {
    name: "Microsoft",
    logo: "M",
    ticker: "MSFT",
    qualityCriteria: "영업이익률 30%↑ / 현금흐름 안정",
    undervalueCriteria: "적정가 대비 -6%",
    fairValue: "$395",
    status: "bluechip",
  },
  {
    name: "Berkshire Hathaway",
    logo: "B",
    ticker: "BRK.B",
    qualityCriteria: "안정적 보험 캐시플로우 / 부채비율 낮음",
    undervalueCriteria: "적정가 대비 -18%",
    fairValue: "$455",
    status: "undervalued",
  },
  {
    name: "Johnson & Johnson",
    logo: "J",
    ticker: "JNJ",
    qualityCriteria: "배당 지속 / ROE 15%↑",
    undervalueCriteria: "적정가 대비 -4%",
    fairValue: "$170",
    status: "bluechip",
  },
  {
    name: "Coca-Cola",
    logo: "C",
    ticker: "KO",
    qualityCriteria: "브랜드 파워 / 영업이익률 25%↑",
    undervalueCriteria: "적정가 대비 -3%",
    fairValue: "$66",
    status: "bluechip",
  },
  {
    name: "Visa",
    logo: "V",
    ticker: "V",
    qualityCriteria: "ROE 30%↑ / 현금흐름 견고",
    undervalueCriteria: "적정가 대비 -20%",
    fairValue: "$320",
    status: "undervalued",
  },
  {
    name: "Procter & Gamble",
    logo: "P",
    ticker: "PG",
    qualityCriteria: "경기 방어 / 배당 성장",
    undervalueCriteria: "적정가 대비 -5%",
    fairValue: "$175",
    status: "bluechip",
  },
  {
    name: "JPMorgan",
    logo: "JP",
    ticker: "JPM",
    qualityCriteria: "자본비율 우수 / 배당 안정",
    undervalueCriteria: "적정가 대비 -7%",
    fairValue: "$205",
    status: "bluechip",
  },
  {
    name: "Costco",
    logo: "C",
    ticker: "COST",
    qualityCriteria: "회원 모델 견고 / 매출 성장",
    undervalueCriteria: "적정가 대비 -15%",
    fairValue: "$830",
    status: "undervalued",
  },
  {
    name: "American Express",
    logo: "AX",
    ticker: "AXP",
    qualityCriteria: "우량 고객 기반 / ROE 25%↑",
    undervalueCriteria: "적정가 대비 -9%",
    fairValue: "$245",
    status: "bluechip",
  },
] as const;

const cardStyles = {
  bluechip: {
    card: "bg-[#b42318] text-white",
    label: "text-white/70",
    logo: "bg-white/15 text-white",
  },
  undervalued: {
    card: "bg-[#d4af37] text-[#1f1400]",
    label: "text-black/70",
    logo: "bg-black/15 text-[#1f1400]",
  },
} as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b0f14] text-zinc-100">
      <header className="mx-auto flex w-[90%] items-center justify-between py-6 sm:w-[80%] lg:w-[70%]">
        <div className="text-lg font-semibold tracking-wide text-white">
          Bitcos
        </div>
        <nav className="flex items-center gap-6 text-sm text-zinc-200">
          <a className="font-semibold text-white" href="/">
            홈
          </a>
          <span className="text-zinc-500">모의투자</span>
        </nav>
      </header>

      <main className="mx-auto w-[90%] pb-16 sm:w-[80%] lg:w-[70%]">
        <section className="mt-6">
          <h1 className="text-3xl font-semibold leading-tight text-[#3a7bff] sm:text-4xl">
            “워렌 버핏 기준 통과 종목과 적정가”
          </h1>
          <p className="mt-3 text-base text-[#f6c45d] sm:text-lg">
            감정 대신 숫자로 투자하세요. 바로 저평가 우량주를 떠먹여
            드립니다.
          </p>
        </section>

        <section className="mt-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {stockCards.map((item) => {
              const tone =
                item.status === "undervalued"
                  ? cardStyles.undervalued
                  : cardStyles.bluechip;

              return (
                <div
                  key={item.ticker}
                  className={`rounded-2xl p-3 shadow-lg ${tone.card}`}
                >
                  <div className="space-y-1 text-[11px] leading-4">
                    <div className="grid grid-cols-[72px,1fr] items-center gap-2">
                      <span className={tone.label}>회사 이름</span>
                      <span className="font-semibold">{item.name}</span>
                    </div>
                    <div className="grid grid-cols-[72px,1fr] items-center gap-2">
                      <span className={tone.label}>회사 로고</span>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${tone.logo}`}
                      >
                        {item.logo}
                      </span>
                    </div>
                    <div className="grid grid-cols-[72px,1fr] items-center gap-2">
                      <span className={tone.label}>티커</span>
                      <span className="font-semibold">{item.ticker}</span>
                    </div>
                    <div className="grid grid-cols-[72px,1fr] items-start gap-2">
                      <span className={tone.label}>우량주 기준</span>
                      <span>{item.qualityCriteria}</span>
                    </div>
                    <div className="grid grid-cols-[72px,1fr] items-start gap-2">
                      <span className={tone.label}>저평가 기준</span>
                      <span>{item.undervalueCriteria}</span>
                    </div>
                    <div className="grid grid-cols-[72px,1fr] items-center gap-2">
                      <span className={tone.label}>적정가</span>
                      <span className="font-semibold">{item.fairValue}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
