"use client";

/**
 * 펀딩비 아비트라지 테이블
 *
 * - 숏 거래소(5개) + 현물 거래소(4개) 최적 조합 표시
 * - 양펀비 높은 순 정렬
 * - 30초마다 자동 갱신
 * - 코인/거래소 로고 표시
 * - 카운트다운 실시간 업데이트
 * - 거래소별 직접 거래 링크
 */

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { FundingRateRow, ExchangeName, SpotExchangeName } from "@/app/api/arbitrage/funding-rates/route";

// ────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────

const EXCHANGE_LABELS: Record<ExchangeName, string> = {
    binance: "Binance",
    bybit: "Bybit",
    okx: "OKX",
    bitget: "Bitget",
    hyperliquid: "Hyperliquid",
    gateio: "Gate.io",
    mexc: "MEXC",
};

const EXCHANGE_COLORS: Record<ExchangeName, string> = {
    binance: "#f0b90b",
    bybit: "#f7a600",
    okx: "#ffffff",
    bitget: "#00c4ff",
    hyperliquid: "#a78bfa",
    gateio: "#2354e6",
    mexc: "#18c99d",
};

const EXCHANGE_LOGOS: Record<ExchangeName, string> = {
    binance: "https://bin.bnbstatic.com/static/images/common/favicon.ico",
    bybit: "https://www.bybit.com/favicon.ico",
    okx: "https://www.okx.com/favicon.ico",
    bitget: "https://www.bitget.com/favicon.ico",
    hyperliquid: "https://hyperliquid.xyz/favicon.ico",
    gateio: "https://www.gate.io/favicon.ico",
    mexc: "https://www.mexc.com/favicon.ico",
};

function getSpotUrl(exchange: SpotExchangeName, symbol: string): string {
    const s = symbol.toUpperCase();
    const sl = symbol.toLowerCase();
    switch (exchange) {
        case "binance": return `https://www.binance.com/ko/trade/${s}_USDT`;
        case "bybit": return `https://www.bybit.com/ko-KR/trade/spot/${s}/USDT`;
        case "okx": return `https://www.okx.com/ko-kr/trade-spot/${sl}-usdt`;
        case "bitget": return `https://www.bitget.com/spot/${s}USDT`;
    }
}

function getFuturesUrl(exchange: ExchangeName, symbol: string): string {
    const s = symbol.toUpperCase();
    const sl = symbol.toLowerCase();
    switch (exchange) {
        case "binance": return `https://www.binance.com/ko/futures/${s}USDT`;
        case "bybit": return `https://www.bybit.com/ko-KR/trade/usdt/${s}USDT`;
        case "okx": return `https://www.okx.com/ko-kr/trade-swap/${sl}-usdt-swap`;
        case "bitget": return `https://www.bitget.com/futures/usdt/${s}USDT`;
        case "hyperliquid": return `https://app.hyperliquid.xyz/trade/${s}`;
        case "gateio": return `https://www.gate.io/ko/futures_trade/USDT/${s}_USDT`;
        case "mexc": return `https://futures.mexc.com/exchange/${s}_USDT`;
    }
}

const SPOT_EXCHANGE_ORDER: SpotExchangeName[] = ["binance", "bybit", "okx", "bitget"];
const EXCHANGES: ExchangeName[] = ["binance", "bybit", "okx", "bitget", "hyperliquid", "gateio", "mexc"];

const THEME = {
    bgCard: "#0f1629",
    bgRowHover: "#131d35",
    border: "rgba(255,255,255,0.06)",
    borderActive: "#2563eb",
    textPrimary: "rgba(255,255,255,0.85)",
    textMuted: "rgba(255,255,255,0.35)",
    textSub: "rgba(255,255,255,0.55)",
    positive: "#10b981",
    glowBlue: "rgba(37,99,235,0.5)",
    glowCyan: "rgba(96,165,250,0.35)",
};

// ────────────────────────────────────────────────
// 전략 가이드 내용
// ────────────────────────────────────────────────

const STRATEGY_STEPS = [
    {
        step: "1",
        title: "진입 조건 확인",
        color: "#60a5fa",
        items: [
            "펀딩비가 충분히 높은지 확인 (최소 0.05% 이상 권장 — 수수료 감안)",
            "숏 거래소에서 해당 종목 선물 거래 가능한지 확인",
            "현물 거래소에서 해당 종목 현물 매수 가능한지 확인",
            "두 거래소 모두 충분한 유동성(오더북 두께) 확인",
        ],
    },
    {
        step: "2",
        title: "포지션 진입 (동시 체결 중요)",
        color: "#34d399",
        items: [
            "선물 거래소: 해당 종목 선물 숏 1배 진입 (격리 마진 권장)",
            "현물 거래소: 동일 수량 현물 매수",
            "⚠️ 반드시 거의 동시에 체결해야 함 — 한쪽만 들어가 있는 순간 방향성 리스크 발생",
            "시장가 주문 시 슬리피지 고려, 유동성 낮은 종목은 지정가 분할 진입 권장",
        ],
    },
    {
        step: "3",
        title: "포지션 유지 중 모니터링",
        color: "#fbbf24",
        items: [
            "선물 증거금 비율 상시 확인 — 가격 급등 시 청산 위험 (격리마진 기준 100% 상승 시 청산)",
            "펀딩비가 음수로 전환되면 즉시 청산 검토 — 양펀비일 때만 수익, 음펀비로 전환 시 오히려 지급",
            "선물 거래소와 현물 거래소의 가격 차이(베이시스) 모니터링",
            "증거금 부족 경고 시 추가 증거금 입금 또는 포지션 일부 청산",
        ],
    },
    {
        step: "4",
        title: "청산 시 주의사항",
        color: "#f87171",
        items: [
            "⚠️ 강제 청산(Liquidation) 발생 시 즉시 현물도 매도해야 함 — 선물만 청산되고 현물을 보유하면 일방적 롱 포지션이 됨",
            "정상 청산 시 선물 숏 청산과 현물 매도를 동시에 진행",
            "선물과 현물을 최대한 같은 가격대에서 체결해야 손익이 정확히 상쇄됨",
            "양쪽 거래소 수수료(메이커/테이커) 합산이 펀딩비 수익보다 크면 손해이므로 계산 필수",
        ],
    },
];

const RISK_ITEMS = [
    { icon: "⚡", text: "펀딩비 역전 리스크: 양펀비 → 음펀비 전환 시 내가 지급하는 쪽으로 바뀜. 정기적 확인 필수" },
    { icon: "💥", text: "강제 청산 리스크: 선물 가격이 급등하면 증거금 부족으로 청산. 증거금 여유를 충분히 유지 (최소 2배 이상 권장)" },
    { icon: "💸", text: "수수료 리스크: 진입+청산 왕복 수수료(선물+현물) 합산이 펀딩비 수익을 초과하는 경우 발생 가능" },
    { icon: "📉", text: "슬리피지 리스크: 유동성 낮은 종목은 시장가 주문 시 원하는 가격에 체결되지 않아 손실 발생" },
    { icon: "🔀", text: "베이시스 리스크: 선물과 현물 가격 차이(프리미엄)가 크면 청산 시 손익이 완전히 상쇄되지 않을 수 있음" },
    { icon: "⏱", text: "타이밍 리스크: 진입/청산 시 한쪽만 체결되면 방향성 리스크에 노출됨. 동시 체결 필수" },
];

// ────────────────────────────────────────────────
// 전략 가이드 컴포넌트
// ────────────────────────────────────────────────

function StrategyGuide() {
    const [open, setOpen] = useState(false);

    return (
        <div style={{ borderBottom: `1px solid ${THEME.border}` }}>
            {/* 토글 버튼 */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.02]"
            >
                <span className="flex items-center gap-2">
                    <span style={{ fontSize: "12px", color: "#60a5fa" }}>📖</span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: THEME.textPrimary }}>
                        전략 가이드 & 주의사항
                    </span>
                    <span
                        className="rounded px-1.5 py-0.5"
                        style={{ fontSize: "10px", color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}
                    >
                        필독
                    </span>
                </span>
                <span style={{ fontSize: "11px", color: THEME.textMuted }}>
                    {open ? "▲ 접기" : "▼ 펼치기"}
                </span>
            </button>

            {open && (
                <div className="px-5 pb-5">

                    {/* 전략 개요 */}
                    <div
                        className="mb-4 rounded-xl p-4"
                        style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}
                    >
                        <p style={{ fontSize: "12px", color: "rgba(147,197,253,0.9)", lineHeight: 1.7 }}>
                            <strong style={{ color: "#93c5fd" }}>펀딩비 중립 전략(Funding Rate Arbitrage)</strong>이란,
                            선물 시장의 펀딩비가 양수일 때 <strong style={{ color: "#34d399" }}>선물 숏 1배 + 현물 매수</strong>를 동시에 보유해
                            가격 방향에 무관하게 펀딩비만 수취하는 전략입니다.
                            가격이 오르면 현물 수익 + 선물 손실이 상쇄되고, 가격이 내리면 현물 손실 + 선물 수익이 상쇄됩니다.
                        </p>
                    </div>

                    {/* 단계별 가이드 */}
                    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {STRATEGY_STEPS.map((s) => (
                            <div
                                key={s.step}
                                className="rounded-xl p-4"
                                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.06)` }}
                            >
                                <div className="mb-2 flex items-center gap-2">
                                    <span
                                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                                        style={{ background: s.color, color: "#000" }}
                                    >
                                        {s.step}
                                    </span>
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: s.color }}>
                                        {s.title}
                                    </span>
                                </div>
                                <ul className="space-y-1.5">
                                    {s.items.map((item, i) => (
                                        <li key={i} style={{ fontSize: "11px", color: THEME.textSub, lineHeight: 1.6 }}>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* 리스크 목록 */}
                    <div
                        className="rounded-xl p-4"
                        style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)" }}
                    >
                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#f87171", marginBottom: 10 }}>
                            ⚠️ 리스크 및 주의사항
                        </p>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {RISK_ITEMS.map((item, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <span style={{ fontSize: "13px", flexShrink: 0 }}>{item.icon}</span>
                                    <span style={{ fontSize: "11px", color: THEME.textSub, lineHeight: 1.6 }}>{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 면책 고지 */}
                    <p className="mt-3" style={{ fontSize: "10px", color: THEME.textMuted }}>
                        * 본 정보는 참고용이며 투자 권유가 아닙니다. 실제 거래 시 수수료, 슬리피지, 세금 등을 반드시 직접 계산하세요.
                    </p>
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────
// 수수료 계산기 데이터
// ────────────────────────────────────────────────

const EXCHANGE_FEE_INFO = [
    {
        exchange: "binance" as SpotExchangeName,
        label: "Binance",
        color: "#f0b90b",
        logo: "https://bin.bnbstatic.com/static/images/common/favicon.ico",
        referralUrl: "https://www.binance.com/referral/earn-together/refer2earn-usdc/claim?hl=en&ref=GRO_28502_Q1OT5&utm_source=default",
        referralNote: "가입 후 최대 $1,000 바우처",
        spot: { maker: 0.1, taker: 0.1, discountPct: 20 },
        futures: { maker: 0.02, taker: 0.05, discountPct: 10 },
    },
    {
        exchange: "bybit" as SpotExchangeName,
        label: "Bybit",
        color: "#f7a600",
        logo: "https://www.bybit.com/favicon.ico",
        referralUrl: "https://www.bybit.com/invite?ref=WZ8DVE",
        referralNote: "레퍼럴 가입 시 20% 할인",
        spot: { maker: 0.1, taker: 0.1, discountPct: 20 },
        futures: { maker: 0.02, taker: 0.055, discountPct: 20 },
    },
    {
        exchange: "okx" as SpotExchangeName,
        label: "OKX",
        color: "#ffffff",
        logo: "https://www.okx.com/favicon.ico",
        referralUrl: "https://okx.com/join/67597579",
        referralNote: "레퍼럴 가입 시 30% 할인",
        spot: { maker: 0.08, taker: 0.1, discountPct: 30 },
        futures: { maker: 0.02, taker: 0.05, discountPct: 30 },
    },
    {
        exchange: "bitget" as SpotExchangeName,
        label: "Bitget",
        color: "#00c4ff",
        logo: "https://www.bitget.com/favicon.ico",
        referralUrl: "https://share.bitget.com/u/BEYYZSD7",
        referralNote: "레퍼럴 가입 시 20% 할인",
        spot: { maker: 0.1, taker: 0.1, discountPct: 20 },
        futures: { maker: 0.02, taker: 0.04, discountPct: 20 },
    },
];

// ────────────────────────────────────────────────
// 수수료 계산기 컴포넌트
// ────────────────────────────────────────────────

function FeeCalculator() {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState("10000"); // 원금 (USDT)
    const [fundingRate, setFundingRate] = useState("0.1"); // 펀딩비 %
    const [intervalHours, setIntervalHours] = useState("8"); // 정산 주기
    const [useReferral, setUseReferral] = useState(true);

    const amountNum = parseFloat(amount.replace(/,/g, "")) || 0;
    const rateNum = parseFloat(fundingRate) / 100 || 0;
    const intervalNum = parseFloat(intervalHours) || 8;
    const timesPerDay = 24 / intervalNum;

    return (
        <div style={{ borderBottom: `1px solid ${THEME.border}` }}>
            {/* 토글 버튼 */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.02]"
            >
                <span className="flex items-center gap-2">
                    <span style={{ fontSize: "12px", color: "#34d399" }}>🧮</span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: THEME.textPrimary }}>
                        수수료 포함 실질 수익 계산기
                    </span>
                    <span
                        className="rounded px-1.5 py-0.5"
                        style={{ fontSize: "10px", color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}
                    >
                        거래소별 비교
                    </span>
                </span>
                <span style={{ fontSize: "11px", color: THEME.textMuted }}>
                    {open ? "▲ 접기" : "▼ 펼치기"}
                </span>
            </button>

            {open && (
                <div className="px-5 pb-6">

                    {/* 입력 영역 */}
                    <div
                        className="mb-5 rounded-xl p-4"
                        style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)" }}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <p style={{ fontSize: "11px", fontWeight: 600, color: "#34d399" }}>
                                📊 조건 입력
                            </p>
                            <span
                                className="rounded-lg px-2.5 py-1"
                                style={{ fontSize: "10px", color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}
                            >
                                ⚡ 권장 최소 펀딩비: <strong>0.1%</strong> 이상 — 그 이하는 수수료 대비 수익이 낮아 비효율적
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            {/* 투자 금액 */}
                            <div>
                                <label style={{ fontSize: "10px", color: THEME.textMuted, display: "block", marginBottom: 4 }}>
                                    투자 금액 (USDT)
                                </label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full rounded-lg px-3 py-2 text-right text-sm tabular-nums outline-none"
                                    style={{
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: THEME.textPrimary,
                                        fontSize: "12px",
                                    }}
                                    placeholder="1000"
                                />
                            </div>
                            {/* 펀딩비 */}
                            <div>
                                <label style={{ fontSize: "10px", color: THEME.textMuted, display: "block", marginBottom: 4 }}>
                                    펀딩비 (%)
                                </label>
                                <input
                                    type="number"
                                    value={fundingRate}
                                    onChange={(e) => setFundingRate(e.target.value)}
                                    step="0.001"
                                    className="w-full rounded-lg px-3 py-2 text-right text-sm tabular-nums outline-none"
                                    style={{
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: THEME.textPrimary,
                                        fontSize: "12px",
                                    }}
                                    placeholder="0.1"
                                />
                            </div>
                            {/* 정산 주기 */}
                            <div>
                                <label style={{ fontSize: "10px", color: THEME.textMuted, display: "block", marginBottom: 4 }}>
                                    정산 주기 (시간)
                                </label>
                                <select
                                    value={intervalHours}
                                    onChange={(e) => setIntervalHours(e.target.value)}
                                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                                    style={{
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: THEME.textPrimary,
                                        fontSize: "12px",
                                    }}
                                >
                                    <option value="1" style={{ background: "#0f1629" }}>1시간</option>
                                    <option value="4" style={{ background: "#0f1629" }}>4시간</option>
                                    <option value="8" style={{ background: "#0f1629" }}>8시간</option>
                                </select>
                            </div>
                            {/* 레퍼럴 할인 적용 */}
                            <div className="flex flex-col justify-end">
                                <label style={{ fontSize: "10px", color: THEME.textMuted, display: "block", marginBottom: 4 }}>
                                    레퍼럴 수수료 할인
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setUseReferral((v) => !v)}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
                                    style={{
                                        background: useReferral ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.05)",
                                        border: `1px solid ${useReferral ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.1)"}`,
                                        color: useReferral ? "#34d399" : THEME.textMuted,
                                        fontSize: "12px",
                                        fontWeight: 600,
                                    }}
                                >
                                    <span>{useReferral ? "✓" : "○"}</span>
                                    <span>{useReferral ? "적용 중" : "미적용"}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 거래소별 수수료 카드 */}
                    <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {EXCHANGE_FEE_INFO.map((ex) => {
                            // 수수료 계산 (투자금액 기준, 선물+현물 왕복)
                            const spotTaker = ex.spot.taker / 100;
                            const futuresTaker = ex.futures.taker / 100;
                            const discountMultiplier = useReferral ? (1 - ex.spot.discountPct / 100) : 1;
                            const futuresDiscount = useReferral ? (1 - ex.futures.discountPct / 100) : 1;

                            // 왕복 수수료: 현물(진입+청산) + 선물(진입+청산)
                            const spotFeePct = spotTaker * discountMultiplier * 2;    // 현물 왕복
                            const futuresFeePct = futuresTaker * futuresDiscount * 2;    // 선물 왕복
                            const totalFeePct = spotFeePct + futuresFeePct;

                            const spotFee = amountNum * spotFeePct;
                            const futuresFee = amountNum * futuresFeePct;
                            const totalFee = amountNum * totalFeePct;

                            // 펀딩비 수익 (1회)
                            const fundingIncome = amountNum * rateNum;
                            // 일 펀딩비 수익
                            const dailyFunding = fundingIncome * timesPerDay;
                            // 수수료 회수 기간 (일) - 수수료는 진입 시 딱 1번만 발생
                            const breakEvenDays = totalFee / dailyFunding;
                            // 일 순수익 = 일 펀딩비 수익 그대로 (수수료는 1회성으로 별도 표시)
                            const dailyNet = dailyFunding;

                            const isProfit = dailyNet > 0;

                            return (
                                <div
                                    key={ex.exchange}
                                    className="rounded-xl p-4"
                                    style={{
                                        background: "rgba(255,255,255,0.02)",
                                        border: `1px solid ${ex.color}20`,
                                        position: "relative",
                                        overflow: "hidden",
                                    }}
                                >
                                    {/* 상단 글로우 */}
                                    <div
                                        className="absolute left-0 right-0 top-0"
                                        style={{ height: "1px", background: `linear-gradient(90deg, transparent, ${ex.color}60, transparent)` }}
                                    />

                                    {/* 거래소 헤더 */}
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <img src={ex.logo} alt={ex.label} width={16} height={16} className="rounded-sm" style={{ objectFit: "contain" }} />
                                            <span style={{ fontSize: "13px", fontWeight: 700, color: ex.color }}>{ex.label}</span>
                                        </div>
                                        <a
                                            href={ex.referralUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="rounded-lg px-2.5 py-1 text-[10px] font-bold transition-opacity hover:opacity-80"
                                            style={{
                                                background: `${ex.color}20`,
                                                border: `1px solid ${ex.color}50`,
                                                color: ex.color,
                                            }}
                                        >
                                            가입 ↗
                                        </a>
                                    </div>

                                    {/* 수수료 테이블 */}
                                    <div className="mb-3 space-y-1.5">
                                        {/* 현물 수수료 */}
                                        <div className="flex items-center justify-between">
                                            <span style={{ fontSize: "10px", color: THEME.textMuted }}>현물 테이커</span>
                                            <div className="flex items-center gap-1.5">
                                                {useReferral && (
                                                    <span style={{ fontSize: "9px", color: THEME.textMuted, textDecoration: "line-through" }}>
                                                        {ex.spot.taker.toFixed(2)}%
                                                    </span>
                                                )}
                                                <span style={{ fontSize: "11px", fontWeight: 600, color: useReferral ? "#34d399" : THEME.textSub }}>
                                                    {(ex.spot.taker * (useReferral ? (1 - ex.spot.discountPct / 100) : 1)).toFixed(3)}%
                                                </span>
                                                {useReferral && (
                                                    <span style={{ fontSize: "9px", color: "#34d399" }}>-{ex.spot.discountPct}%</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* 선물 수수료 */}
                                        <div className="flex items-center justify-between">
                                            <span style={{ fontSize: "10px", color: THEME.textMuted }}>선물 테이커</span>
                                            <div className="flex items-center gap-1.5">
                                                {useReferral && (
                                                    <span style={{ fontSize: "9px", color: THEME.textMuted, textDecoration: "line-through" }}>
                                                        {ex.futures.taker.toFixed(3)}%
                                                    </span>
                                                )}
                                                <span style={{ fontSize: "11px", fontWeight: 600, color: useReferral ? "#34d399" : THEME.textSub }}>
                                                    {(ex.futures.taker * (useReferral ? (1 - ex.futures.discountPct / 100) : 1)).toFixed(4)}%
                                                </span>
                                                {useReferral && (
                                                    <span style={{ fontSize: "9px", color: "#34d399" }}>-{ex.futures.discountPct}%</span>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ height: "1px", background: THEME.border, margin: "6px 0" }} />

                                        {/* 왕복 수수료 합계 */}
                                        <div className="flex items-center justify-between">
                                            <span style={{ fontSize: "10px", color: THEME.textMuted }}>왕복 수수료 합계</span>
                                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#f87171" }}>
                                                -{totalFee.toFixed(2)} USDT
                                            </span>
                                        </div>
                                        {/* 펀딩비 수익 (1일) */}
                                        <div className="flex items-center justify-between">
                                            <span style={{ fontSize: "10px", color: THEME.textMuted }}>펀딩비 수익 (1일)</span>
                                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#10b981" }}>
                                                +{dailyFunding.toFixed(2)} USDT
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ height: "1px", background: THEME.border, margin: "8px 0" }} />

                                    {/* 핵심 결과 */}
                                    <div className="space-y-2">
                                        {/* 수수료 회수 기간 */}
                                        <div className="flex items-center justify-between">
                                            <span style={{ fontSize: "10px", color: THEME.textMuted }}>수수료 회수</span>
                                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24" }}>
                                                {isFinite(breakEvenDays) ? `${breakEvenDays.toFixed(1)}일` : "-"}
                                            </span>
                                        </div>
                                        {/* 일 순수익 */}
                                        <div
                                            className="flex items-center justify-between rounded-lg px-3 py-2"
                                            style={{ background: isProfit ? "rgba(16,185,129,0.08)" : "rgba(248,113,113,0.08)" }}
                                        >
                                            <span style={{ fontSize: "11px", fontWeight: 600, color: THEME.textSub }}>일 순수익</span>
                                            <span style={{ fontSize: "14px", fontWeight: 800, color: isProfit ? "#10b981" : "#f87171" }}>
                                                {isProfit ? "+" : ""}{dailyNet.toFixed(2)} USDT
                                            </span>
                                        </div>
                                    </div>

                                    {/* 레퍼럴 안내 */}
                                    <p className="mt-3" style={{ fontSize: "9px", color: THEME.textMuted, lineHeight: 1.5 }}>
                                        {ex.referralNote}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* 계산 기준 안내 */}
                    <div
                        className="rounded-xl p-3"
                        style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${THEME.border}` }}
                    >
                        <p style={{ fontSize: "10px", color: THEME.textMuted, lineHeight: 1.7 }}>
                            💡 <strong style={{ color: THEME.textSub }}>계산 기준</strong>: 테이커 수수료 기준 / 왕복(진입+청산) 합산 / 현물+선물 각 1회씩 /
                            슬리피지 미포함 / 메이커 주문 시 실제 수수료 더 낮아짐 /
                            바이낸스 할인율은 공식 미공개 추정치(현물 20%, 선물 10%) 기준
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────

function formatRate(rate: number): string {
    return `${rate >= 0 ? "+" : ""}${(rate * 100).toFixed(4)}%`;
}

function formatApr(apr: number): string {
    return `${apr >= 0 ? "+" : ""}${apr.toFixed(3)}%`;
}

function getRateColor(rate: number): string {
    if (rate >= 0.001) return "#10b981";
    if (rate >= 0.0003) return "#34d399";
    if (rate >= 0) return "rgba(52,211,153,0.6)";
    return "#f87171";
}

function msToCountdown(ms: number): string {
    if (ms <= 0) return "정산 중";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function getHlNextFundingMs(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(now.getHours() + 1, 0, 0, 0);
    return next.getTime() - now.getTime();
}

// ────────────────────────────────────────────────
// 코인 로고
// ────────────────────────────────────────────────

function CoinLogo({ symbol }: { symbol: string }) {
    const [errored, setErrored] = useState(false);
    if (errored) {
        return (
            <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold"
                style={{ background: "rgba(255,255,255,0.1)", color: THEME.textSub }}
            >
                {symbol.slice(0, 2)}
            </span>
        );
    }
    return (
        <img
            src={`https://coinicons-api.vercel.app/api/icon/${symbol.toLowerCase()}`}
            alt={symbol}
            width={20}
            height={20}
            className="rounded-full"
            onError={() => setErrored(true)}
            style={{ objectFit: "contain" }}
        />
    );
}

// ────────────────────────────────────────────────
// 거래소 로고
// ────────────────────────────────────────────────

function ExchangeLogo({ exchange }: { exchange: ExchangeName }) {
    const [errored, setErrored] = useState(false);
    if (errored) {
        return <span className="text-[9px]" style={{ color: EXCHANGE_COLORS[exchange] }}>{EXCHANGE_LABELS[exchange].slice(0, 2)}</span>;
    }
    return (
        <img
            src={EXCHANGE_LOGOS[exchange]}
            alt={exchange}
            width={14}
            height={14}
            className="rounded-sm"
            onError={() => setErrored(true)}
            style={{ objectFit: "contain" }}
        />
    );
}

// ────────────────────────────────────────────────
// 거래소 뱃지
// ────────────────────────────────────────────────

function ExchangeBadge({ exchange, href }: { exchange: ExchangeName; href?: string }) {
    const inner = (
        <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-80"
            style={{
                background: `${EXCHANGE_COLORS[exchange]}18`,
                border: `1px solid ${EXCHANGE_COLORS[exchange]}40`,
                color: EXCHANGE_COLORS[exchange],
            }}
        >
            <ExchangeLogo exchange={exchange} />
            {EXCHANGE_LABELS[exchange]}
            {href && <span style={{ fontSize: "8px", opacity: 0.6 }}>↗</span>}
        </span>
    );
    if (href) {
        return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
    }
    return inner;
}

// ────────────────────────────────────────────────
// 카운트다운 셀
// ────────────────────────────────────────────────

function CountdownCell({ nextFundingTime, intervalHours, exchange }: {
    nextFundingTime: number | null;
    intervalHours: number;
    exchange: ExchangeName;
}) {
    const [countdown, setCountdown] = useState("");

    useEffect(() => {
        const calc = () => {
            let ms: number;
            if (exchange === "hyperliquid" || !nextFundingTime || nextFundingTime === 0) {
                ms = getHlNextFundingMs();
            } else {
                ms = nextFundingTime - Date.now();
            }
            setCountdown(msToCountdown(ms));
        };
        calc();
        const t = setInterval(calc, 1000);
        return () => clearInterval(t);
    }, [nextFundingTime, exchange]);

    return (
        <span style={{ color: "#fbbf24", fontSize: "11px", fontVariantNumeric: "tabular-nums" }}>
            {countdown}
        </span>
    );
}

// ────────────────────────────────────────────────
// 펀딩비 셀
// ────────────────────────────────────────────────

function FundingCell({ row, exchange }: { row: FundingRateRow; exchange: ExchangeName }) {
    const data = row.funding[exchange];
    // 선물 전용 거래소(현물 없음)는 spotAvailable 체크 불필요
    const FUTURES_ONLY_EXCHANGES = ["hyperliquid", "gateio", "mexc"];
    const isSpotAvailable = FUTURES_ONLY_EXCHANGES.includes(exchange)
        ? true
        : row.spotAvailable[exchange as SpotExchangeName];

    if (!data || data.rate === null) {
        return <span style={{ color: THEME.textMuted, fontSize: "11px" }}>-</span>;
    }
    if (exchange !== "hyperliquid" && !isSpotAvailable) {
        return (
            <span style={{ color: THEME.textMuted, fontSize: "11px" }}>
                - <span style={{ fontSize: "9px" }}>(현물 없음)</span>
            </span>
        );
    }

    const isBest = row.bestShortExchange === exchange;
    return (
        <span className="flex flex-col gap-0.5">
            <span
                className={cn("tabular-nums font-semibold", isBest && "underline underline-offset-2")}
                style={{ fontSize: "12px", color: getRateColor(data.rate) }}
            >
                {formatRate(data.rate)}
            </span>
            {data.intervalHours && data.intervalHours !== 8 && (
                <span style={{ fontSize: "9px", color: THEME.textMuted }}>{data.intervalHours}h 정산</span>
            )}
        </span>
    );
}

// ────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────

export function FundingRateTable({ className }: { className?: string }) {
    const [rows, setRows] = useState<FundingRateRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<number | null>(null);
    const [lastUpdated, setLastUpdated] = useState("");

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/arbitrage/funding-rates");
            if (!res.ok) throw new Error("데이터 로드 실패");
            const json = await res.json();
            setRows(json.data ?? []);
            setUpdatedAt(json.updatedAt);
            setError(null);
        } catch {
            setError("데이터를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30_000);
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => {
        if (!updatedAt) return;
        const update = () => {
            const diff = Math.floor((Date.now() - updatedAt) / 1000);
            if (diff < 60) setLastUpdated(`${diff}초 전`);
            else setLastUpdated(`${Math.floor(diff / 60)}분 전`);
        };
        update();
        const t = setInterval(update, 5000);
        return () => clearInterval(t);
    }, [updatedAt]);

    if (error) {
        return (
            <div
                className={cn("flex h-40 items-center justify-center rounded-2xl", className)}
                style={{ background: THEME.bgCard, border: `1px solid ${THEME.border}` }}
            >
                <p style={{ color: THEME.textMuted, fontSize: "13px" }}>{error}</p>
            </div>
        );
    }

    return (
        <div
            className={cn("relative w-full overflow-hidden rounded-2xl", className)}
            style={{
                background: THEME.bgCard,
                border: `1px solid ${THEME.border}`,
                boxShadow: "0 0 0 1px rgba(37,99,235,0.08), 0 8px 40px rgba(4,7,18,0.7)",
            }}
        >
            {/* 상단 글로우 라인 */}
            <div
                className="pointer-events-none absolute left-0 right-0 top-0 z-10"
                style={{
                    height: "1px",
                    background: `linear-gradient(90deg, transparent, ${THEME.glowBlue}, ${THEME.glowCyan}, ${THEME.glowBlue}, transparent)`,
                }}
            />

            {/* 헤더 */}
            <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: `1px solid ${THEME.border}`, background: "#0b1020" }}
            >
                <div className="flex items-center gap-3">
                    <span style={{ fontSize: "13px", fontWeight: 700, color: THEME.textPrimary }}>
                        펀딩비 아비트라지
                    </span>
                    {!loading && (
                        <span
                            className="rounded px-2 py-0.5"
                            style={{ fontSize: "10px", color: THEME.textMuted, background: "rgba(255,255,255,0.04)" }}
                        >
                            총 {rows.length}개 종목
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span style={{ fontSize: "10px", color: THEME.textMuted }}>{lastUpdated} 업데이트</span>
                    )}
                    <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: THEME.positive }} />
                        <span style={{ fontSize: "10px", color: THEME.textMuted }}>30초 갱신</span>
                    </span>
                </div>
            </div>

            {/* 전략 가이드 (접기/펼치기) */}
            <StrategyGuide />

            {/* 수수료 계산기 (접기/펼치기) */}
            <FeeCalculator />

            {/* 로딩 */}
            {loading && (
                <div className="flex h-60 flex-col items-center justify-center gap-3">
                    <div
                        className="h-6 w-6 animate-spin rounded-full border-2"
                        style={{ borderColor: `${THEME.borderActive} transparent transparent transparent` }}
                    />
                    <span style={{ fontSize: "12px", color: THEME.textMuted }}>데이터 불러오는 중…</span>
                </div>
            )}

            {/* 테이블 */}
            {!loading && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize: "12px" }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${THEME.border}` }}>
                                <th className="px-5 py-2.5 text-left" style={{ color: THEME.textMuted, fontWeight: 500, whiteSpace: "nowrap" }}>종목</th>
                                <th className="px-3 py-2.5 text-right" style={{ color: THEME.textMuted, fontWeight: 500, whiteSpace: "nowrap" }}>펀딩비</th>
                                <th className="px-3 py-2.5 text-right" style={{ color: THEME.textMuted, fontWeight: 500, whiteSpace: "nowrap" }}>일 APR</th>
                                <th className="px-3 py-2.5 text-right" style={{ color: THEME.textMuted, fontWeight: 500, whiteSpace: "nowrap" }}>정산 주기</th>
                                <th className="px-3 py-2.5 text-right" style={{ color: THEME.textMuted, fontWeight: 500, whiteSpace: "nowrap" }}>다음 정산</th>
                                {/* 숏 거래소 → 현물 거래소 순서 */}
                                <th className="px-3 py-2.5 text-center" style={{ color: THEME.textMuted, fontWeight: 500, whiteSpace: "nowrap" }}>숏 거래소</th>
                                <th className="px-3 py-2.5 text-center" style={{ color: THEME.textMuted, fontWeight: 500, whiteSpace: "nowrap" }}>현물 거래소</th>
                                {/* 거래소별 펀딩비 상세 */}
                                {EXCHANGES.map((ex) => (
                                    <th
                                        key={ex}
                                        className="px-3 py-2.5 text-right"
                                        style={{ color: EXCHANGE_COLORS[ex], fontWeight: 500, whiteSpace: "nowrap", opacity: 0.8 }}
                                    >
                                        <span className="flex flex-col items-end gap-0.5">
                                            <span className="inline-flex items-center gap-1">
                                                <ExchangeLogo exchange={ex} />
                                                {EXCHANGE_LABELS[ex]}
                                            </span>
                                            <span style={{ fontSize: "9px", color: THEME.textMuted, fontWeight: 400 }}>
                                                펀딩비
                                            </span>
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => {
                                const bestData = row.funding[row.bestShortExchange];
                                return (
                                    <tr
                                        key={row.symbol}
                                        style={{
                                            borderBottom: `1px solid ${THEME.border}`,
                                            background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                                            transition: "background 0.1s",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = THEME.bgRowHover)}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)")}
                                    >
                                        {/* 종목 */}
                                        <td className="px-5 py-3">
                                            <span className="flex items-center gap-2">
                                                <CoinLogo symbol={row.symbol} />
                                                <span>
                                                    <span style={{ fontWeight: 700, color: THEME.textPrimary }}>{row.symbol}</span>
                                                    <span style={{ color: THEME.textMuted, fontSize: "10px" }}>/USDT</span>
                                                </span>
                                            </span>
                                        </td>

                                        {/* 펀딩비 */}
                                        <td className="px-3 py-3 text-right tabular-nums">
                                            <span style={{ fontWeight: 700, fontSize: "13px", color: getRateColor(row.bestShortRate) }}>
                                                {formatRate(row.bestShortRate)}
                                            </span>
                                        </td>

                                        {/* 일 APR */}
                                        <td className="px-3 py-3 text-right tabular-nums">
                                            <span style={{ fontWeight: 600, color: getRateColor(row.bestShortRate) }}>
                                                {formatApr(row.dailyApr)}
                                            </span>
                                        </td>

                                        {/* 정산 주기 */}
                                        <td className="px-3 py-3 text-right">
                                            <span style={{
                                                color: row.intervalHours === 1 ? "#a78bfa" : THEME.textSub,
                                                fontWeight: row.intervalHours === 1 ? 600 : 400,
                                            }}>
                                                {row.intervalHours}시간
                                            </span>
                                        </td>

                                        {/* 다음 정산 카운트다운 */}
                                        <td className="px-3 py-3 text-right">
                                            <CountdownCell
                                                nextFundingTime={bestData?.nextFundingTime ?? null}
                                                intervalHours={row.intervalHours}
                                                exchange={row.bestShortExchange}
                                            />
                                        </td>

                                        {/* 숏 거래소 (왼쪽) */}
                                        <td className="px-3 py-3 text-center">
                                            <ExchangeBadge
                                                exchange={row.bestShortExchange}
                                                href={getFuturesUrl(row.bestShortExchange, row.symbol)}
                                            />
                                        </td>

                                        {/* 현물 거래소 (오른쪽) */}
                                        <td className="px-3 py-3">
                                            <div className="flex flex-wrap justify-center gap-1">
                                                {SPOT_EXCHANGE_ORDER.filter((ex) => row.spotAvailable[ex]).map((ex) => (
                                                    <ExchangeBadge
                                                        key={ex}
                                                        exchange={ex}
                                                        href={getSpotUrl(ex, row.symbol)}
                                                    />
                                                ))}
                                            </div>
                                        </td>

                                        {/* 거래소별 펀딩비 상세 */}
                                        {EXCHANGES.map((ex) => (
                                            <td key={ex} className="px-3 py-3 text-right">
                                                <FundingCell row={row} exchange={ex} />
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 하단 안내 */}
            <div className="px-5 py-2.5" style={{ borderTop: `1px solid ${THEME.border}` }}>
                <p style={{ fontSize: "10px", color: THEME.textMuted }}>
                    * 하이퍼리퀴드 1시간 정산 · 현물 거래소는 Binance/Bybit/OKX/Bitget만 (유동성 검증) · 실제 수익은 수수료/슬리피지 차감 필요
                </p>
            </div>
        </div>
    );
}