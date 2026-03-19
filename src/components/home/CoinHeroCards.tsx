"use client";

type CoinKey = "btc" | "eth" | "xrp";

type CoinHeroCardsProps = {
  selectedCoin: CoinKey;
  onSelectCoin: (coin: CoinKey) => void;
};

const COIN_CARDS: Array<{
  key: CoinKey;
  title: string;
  subtitle: string;
  accent: string;
}> = [
  { key: "btc", title: "Bitcoin", subtitle: "BTC 시장 예측 보기", accent: "from-orange-500/40 to-amber-500/30" },
  { key: "eth", title: "Ethereum", subtitle: "ETH 시장 예측 보기", accent: "from-blue-500/40 to-indigo-500/30" },
  { key: "xrp", title: "XRP", subtitle: "XRP 시장 예측 보기", accent: "from-cyan-500/40 to-sky-500/30" },
];

export function CoinHeroCards({ selectedCoin, onSelectCoin }: CoinHeroCardsProps) {
  return (
    <section aria-label="코인 빠른 선택">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COIN_CARDS.map((coin) => {
          const active = selectedCoin === coin.key;
          return (
            <button
              key={coin.key}
              type="button"
              onClick={() => onSelectCoin(coin.key)}
              className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all ${
                active
                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]"
                  : "border-border bg-card hover:border-primary/40 hover:bg-card/80"
              }`}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${coin.accent} opacity-70`} />
              <div className="relative z-10">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {coin.key}
                </p>
                <h3 className="mt-1 text-2xl font-bold text-foreground">{coin.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{coin.subtitle}</p>
                <span
                  className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-foreground"
                  }`}
                >
                  {active ? "현재 선택됨" : "선택하기"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

