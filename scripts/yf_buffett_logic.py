"""
나스닥 100 + S&P 500 우량주 배치 평가 시스템

목적: 여러 종목을 한 번에 평가하고 결과를 CSV로 저장
- 진행바 표시
- 요약 결과 출력
- CSV 파일 저장
- 나스닥 100, S&P 500, 통합 평가 지원
"""

import yfinance as yf
from curl_cffi.requests import Session
import pandas as pd
from datetime import datetime
import math
from tqdm import tqdm
import warnings
import requests

warnings.filterwarnings("ignore")


def get_sp500_tickers():
    """
    S&P 500 티커 리스트를 가져옴 (GitHub 백업 소스 사용)

    Returns:
        list: S&P 500 티커 리스트
    """
    try:
        print("\n🔍 S&P 500 티커 리스트 가져오는 중...")

        # GitHub 공개 데이터셋 사용
        url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
        df = pd.read_csv(url)
        tickers = df["Symbol"].tolist()

        # 클린업
        tickers = [str(t).strip().replace(".", "-") for t in tickers if pd.notna(t)]

        print(f"✅ 총 {len(tickers)}개 종목 발견!")
        print(f"📋 샘플: {tickers[:10]}")

        return tickers

    except Exception as e:
        print(f"❌ S&P 500 가져오기 실패: {str(e)}")
        return None


def get_nasdaq100_tickers():
    """
    Wikipedia에서 나스닥 100 티커 리스트를 가져옴

    Returns:
        list: 나스닥 100 티커 리스트
    """
    try:
        print("\n🔍 나스닥 100 티커 리스트 가져오는 중...")
        url = "https://en.wikipedia.org/wiki/Nasdaq-100"

        # User-Agent 헤더 추가하여 403 우회
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

        # Wikipedia 테이블 읽기
        tables = pd.read_html(requests.get(url, headers=headers).content)

        # 나스닥 100 구성 종목 테이블 찾기
        nasdaq100_df = None
        for i, table in enumerate(tables):
            if "Ticker" in table.columns or "Symbol" in table.columns:
                nasdaq100_df = table
                print(f"✅ 테이블 #{i}에서 발견!")
                break

        if nasdaq100_df is None:
            print("❌ 나스닥 100 테이블을 찾을 수 없습니다.")
            print("⚠️ 대신 기본 리스트를 사용합니다...")
            return get_nasdaq100_fallback()

        # 티커 컬럼명 찾기
        ticker_column = "Ticker" if "Ticker" in nasdaq100_df.columns else "Symbol"

        # 티커 리스트 추출
        tickers = nasdaq100_df[ticker_column].tolist()

        # 클린업
        tickers = [str(t).strip() for t in tickers if pd.notna(t)]

        print(f"✅ 총 {len(tickers)}개 종목 발견!")
        print(f"📋 샘플: {tickers[:10]}")

        return tickers

    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        print("⚠️ 대신 기본 리스트를 사용합니다...")
        return get_nasdaq100_fallback()


def get_nasdaq100_fallback():
    """나스닥 100 기본 리스트 (백업용)"""
    return [
        # 메가캡 테크
        "AAPL",
        "MSFT",
        "GOOGL",
        "GOOG",
        "AMZN",
        "NVDA",
        "META",
        "TSLA",
        # 대형 테크
        "AVGO",
        "COST",
        "NFLX",
        "ADBE",
        "CSCO",
        "PEP",
        "AMD",
        "INTC",
        "TMUS",
        "INTU",
        "QCOM",
        "TXN",
        "AMGN",
        "HON",
        "AMAT",
        "SBUX",
        # 중형 테크 & 성장주
        "ADP",
        "GILD",
        "ISRG",
        "BKNG",
        "ADI",
        "VRTX",
        "REGN",
        "PANW",
        "MU",
        "LRCX",
        "MDLZ",
        "PYPL",
        "SNPS",
        "KLAC",
        "CDNS",
        "MRVL",
        "ASML",
        "NXPI",
        "ABNB",
        "MELI",
        "WDAY",
        "FTNT",
        "DASH",
        "TEAM",
        # 소형 테크 & 헬스케어
        "DXCM",
        "CHTR",
        "MNST",
        "ADSK",
        "CPRT",
        "AEP",
        "ORLY",
        "ROST",
        "PCAR",
        "PAYX",
        "ODFL",
        "FAST",
        "EA",
        "KDP",
        "VRSK",
        "XEL",
        "CTSH",
        "DDOG",
        "EXC",
        "CTAS",
        "GEHC",
        "IDXX",
        "LULU",
        "CCEP",
        # 추가 종목
        "KHC",
        "ZS",
        "BIIB",
        "TTWO",
        "ANSS",
        "ON",
        "CDW",
        "CRWD",
        "GFS",
        "WBD",
        "ILMN",
        "MDB",
        "MRNA",
        "WBA",
        "DLTR",
        "SIRI",
        # 추가 12개 (총 100개)
        "FANG",
        "CEG",
        "SMCI",
        "TTD",
        "ARM",
        "ROP",
        "CSGP",
        "AZN",
        "MCHP",
        "PDD",
        "MAR",
        "CSX",
    ]


# SSL 인증서 에러 우회용 세션 생성
session = Session(impersonate="chrome")
session.verify = False


def calculate_roe(net_income, total_equity):
    """ROE 계산"""
    if total_equity == 0 or pd.isna(total_equity):
        return 0.0
    return (net_income / total_equity) * 100


def calculate_roic(ebit, tax_rate, total_equity, total_liabilities):
    """ROIC 계산"""
    if pd.isna(ebit) or pd.isna(tax_rate):
        return 0.0

    nopat = ebit * (1 - tax_rate / 100)
    invested_capital = total_equity + total_liabilities

    if invested_capital == 0:
        return 0.0

    return (nopat / invested_capital) * 100


def calculate_net_margin(net_income, revenue):
    """Net Margin 계산"""
    if revenue == 0 or pd.isna(revenue):
        return 0.0
    return (net_income / revenue) * 100


def calculate_fcf_margin(free_cash_flow, revenue):
    """FCF Margin 계산"""
    if revenue == 0 or pd.isna(revenue):
        return 0.0
    return (free_cash_flow / revenue) * 100


def calculate_cagr(start_value, end_value, years):
    """CAGR 계산"""
    if start_value <= 0 or pd.isna(start_value) or pd.isna(end_value):
        return 0.0

    ratio = end_value / start_value
    cagr = (math.pow(ratio, 1.0 / years) - 1) * 100
    return max(cagr, 0.0)


def get_trust_grade(years):
    """
    데이터 연수에 따른 신뢰등급 반환

    Args:
        years (int): 데이터 연수

    Returns:
        tuple: (등급 숫자, 등급 텍스트, 별점)
    """
    if years >= 4:
        return (1, "1등급", "★★★★★")
    elif years == 3:
        return (2, "2등급", "★★★★☆")
    else:  # 2년
        return (3, "3등급", "★★★☆☆")


def generate_pass_reason(result_data):
    """
    우량주 통과 이유 요약문 생성 (통과 종목만)

    Args:
        result_data (dict): 평가 결과 데이터

    Returns:
        str: 통과 이유 요약문 또는 None
    """
    # 85점 미만은 요약문 생성 안 함
    if result_data["total_score"] < 85:
        return None

    ticker = result_data["ticker"]
    total_score = result_data["total_score"]
    years = result_data["years_data"]

    # 신뢰등급
    grade_num, grade_text, grade_stars = get_trust_grade(years)

    # 각 항목별 점수
    roe_score = result_data["roe_score"]
    roic_score = result_data["roic_score"]
    margin_score = result_data["margin_score"]
    trend_score = result_data["trend_score"]
    health_score = result_data["health_score"]
    cash_score = result_data["cash_score"]

    # 평균 지표들
    avg_roe = result_data["avg_roe"]
    avg_roic = result_data["avg_roic"]
    avg_margin = result_data["avg_net_margin"]
    avg_fcf = result_data["avg_fcf_margin"]
    debt_ratio = result_data["debt_ratio"]

    # 요약문 생성
    summary = f"[{ticker} - 총점 {total_score:.0f}점 / 신뢰등급 {grade_text} {grade_stars}]\n\n"
    summary += f"✅ 우량주 통과 이유 ({years}년 데이터 기준):\n\n"

    # ROE 평가
    if roe_score >= 20:
        summary += f"- ROE 지속성: {roe_score}/25점 - {years}년 평균 ROE {avg_roe:.1f}%, 지속적 고수익성 달성\n"
    elif roe_score >= 15:
        summary += (
            f"- ROE 지속성: {roe_score}/25점 - {years}년 중 대부분 ROE 12% 이상 유지\n"
        )
    else:
        summary += f"- ROE 지속성: {roe_score}/25점 - 평균 ROE {avg_roe:.1f}%\n"

    # ROIC 평가
    if roic_score >= 15:
        summary += f"- ROIC 지속성: {roic_score}/20점 - {years}년 평균 ROIC {avg_roic:.1f}%, 투자 효율성 우수\n"
    elif roic_score >= 10:
        summary += f"- ROIC 지속성: {roic_score}/20점 - 평균 ROIC {avg_roic:.1f}%, 양호한 자본 수익성\n"
    else:
        summary += f"- ROIC 지속성: {roic_score}/20점 - 평균 ROIC {avg_roic:.1f}%\n"

    # Net Margin 평가
    if margin_score >= 13:
        summary += f"- Net Margin 안정: {margin_score}/15점 - 평균 {avg_margin:.1f}%, 수익성 매우 안정적\n"
    elif margin_score >= 10:
        summary += f"- Net Margin 안정: {margin_score}/15점 - 평균 {avg_margin:.1f}%, 수익성 안정적\n"
    else:
        summary += f"- Net Margin 안정: {margin_score}/15점 - 평균 {avg_margin:.1f}%\n"

    # 추세 평가
    if trend_score >= 12:
        summary += f"- 수익성 추세: {trend_score}/15점 - 최근 수익성 지속 개선 중 (성장 중 📈)\n"
    elif trend_score >= 6:
        summary += f"- 수익성 추세: {trend_score}/15점 - 수익성 유지 중\n"
    else:
        summary += f"- 수익성 추세: {trend_score}/15점 - 추세 변동 있음\n"

    # 재무 건전성 평가
    if health_score >= 13:
        summary += f"- 재무 건전성: {health_score}/15점 - 부채비율 {debt_ratio:.1f}%, 매우 건전한 재무구조\n"
    elif health_score >= 10:
        summary += f"- 재무 건전성: {health_score}/15점 - 부채비율 {debt_ratio:.1f}%, 건전한 재무구조\n"
    else:
        summary += f"- 재무 건전성: {health_score}/15점 - 부채비율 {debt_ratio:.1f}%\n"

    # 현금창출력 평가
    if cash_score >= 7:
        summary += f"- 현금창출력: {cash_score}/10점 - FCF Margin {avg_fcf:.1f}%, 우수한 현금창출력 💰\n"
    elif cash_score >= 4:
        summary += f"- 현금창출력: {cash_score}/10점 - FCF Margin {avg_fcf:.1f}%, 양호한 현금흐름\n"
    else:
        summary += f"- 현금창출력: {cash_score}/10점 - FCF Margin {avg_fcf:.1f}%\n"

    # 투자 포인트
    summary += f"\n💡 투자 포인트: "

    highlights = []
    if roe_score >= 20:
        highlights.append("지속적 고수익성")
    if roic_score >= 15:
        highlights.append("우수한 자본효율")
    if margin_score >= 13:
        highlights.append("안정적 수익구조")
    if trend_score >= 12:
        highlights.append("성장 추세")
    if health_score >= 13:
        highlights.append("건전한 재무")
    if cash_score >= 7:
        highlights.append("강한 현금창출")

    if highlights:
        summary += ", ".join(highlights)
    else:
        summary += "전반적 안정성"

    return summary


def generate_valuation_reason(result_data):
    """
    적정가 산정 이유 요약문 생성 (우량주인 경우만)

    Args:
        result_data (dict): 평가 결과 데이터

    Returns:
        str: 적정가 이유 요약문 또는 None
    """
    # 우량주면 적정가 평가 근거를 요약해줌
    if result_data["total_score"] < 85:
        return None

    ticker = result_data["ticker"]
    current_price = result_data["current_price"]
    intrinsic_value = result_data["intrinsic_value"]
    gap_pct = result_data["gap_pct"]
    eps_cagr = result_data["eps_cagr"]
    years = result_data["years_data"]

    # 적정가 신뢰도 검증
    valuation_reliable = result_data.get("valuation_reliable", True)

    if not valuation_reliable:
        return None  # 적정가 계산이 신뢰할 수 없으면 생성 안 함

    # 요약문 생성
    summary = f"[{ticker} - 적정가 분석]\n\n"
    summary += f"📊 현재 상황:\n"
    summary += f"   • 현재가: ${current_price:.2f}\n"
    summary += f"   • 적정가: ${intrinsic_value:.2f}\n"
    summary += f"   • 상승여력: +{gap_pct:.1f}%\n\n"

    summary += f"💰 저평가 근거:\n\n"

    # EPS 성장률 분석
    if eps_cagr >= 15.0:
        summary += f"- 높은 성장성: 최근 {years}년간 EPS 연평균 {eps_cagr:.1f}% 성장\n"
        summary += f"- 성장주 프리미엄: PER 18배 적용 (고성장 기업)\n"
    elif eps_cagr >= 8.0:
        summary += f"- 안정적 성장: 최근 {years}년간 EPS 연평균 {eps_cagr:.1f}% 성장\n"
        summary += f"- 중성장주 평가: PER 12배 적용\n"
    elif eps_cagr >= 0.0:
        summary += f"- 완만한 성장: 최근 {years}년간 EPS 연평균 {eps_cagr:.1f}% 성장\n"
        summary += f"- 안정주 평가: PER 10배 적용\n"
    else:
        summary += f"- EPS 성장 둔화: 최근 {years}년간 EPS 연평균 {eps_cagr:.1f}%\n"
        summary += f"- 보수적 평가: PER 8배 적용\n"

    summary += f"- 보수적 추정: 과거 성장률의 70%만 반영하여 미래 5년 추정\n"
    summary += f"- 안전마진 20%: 이론적 가치의 80%를 적정가로 산정\n\n"

    # 투자 포인트
    summary += f"🎯 매수 포인트:\n"

    if gap_pct >= 100:
        summary += f"   • 현재 주가는 적정가 대비 {gap_pct:.0f}% 저평가 상태\n"
        summary += f"   • 강력한 매수 기회 (2배 이상 상승 여력)\n"
    elif gap_pct >= 50:
        summary += f"   • 현재 주가는 적정가 대비 {gap_pct:.0f}% 저평가 상태\n"
        summary += f"   • 우수한 매수 기회 (50% 이상 상승 여력)\n"
    elif gap_pct >= 20:
        summary += f"   • 현재 주가는 적정가 대비 {gap_pct:.0f}% 저평가 상태\n"
        summary += f"   • 양호한 매수 기회 (20% 이상 상승 여력)\n"
    else:
        summary += f"   • 현재 주가는 적정가 대비 {gap_pct:.0f}% 저평가 상태\n"
        summary += f"   • 적정가 근접 (상승 여력 제한적)\n"

    summary += f"   • 우량주 펀더멘털 + 저평가 = 황금 투자 기회 💰\n"

    return summary


def evaluate_stock_silent(ticker):
    """
    종목을 조용히 평가 (출력 최소화)

    Returns:
        dict: 평가 결과 또는 None
    """
    try:
        stock = yf.Ticker(ticker, session=session)

        # 데이터 가져오기
        financials = stock.financials
        balance_sheet = stock.balance_sheet
        cashflow = stock.cashflow
        info = stock.info

        if financials.empty or balance_sheet.empty or cashflow.empty:
            return None

        years_available = len(financials.columns)
        if years_available < 3:
            return None

        # ================================================================
        # 데이터 추출
        # ================================================================
        results = []

        for date in financials.columns:
            year = date.year

            # 2021년 데이터는 자동 필터링 (불완전한 데이터)
            if year == 2021:
                continue

            # 손익계산서
            revenue = (
                financials.loc["Total Revenue", date]
                if "Total Revenue" in financials.index
                else 0
            )
            net_income = (
                financials.loc["Net Income", date]
                if "Net Income" in financials.index
                else 0
            )
            ebit = financials.loc["EBIT", date] if "EBIT" in financials.index else 0
            pretax_income = (
                financials.loc["Pretax Income", date]
                if "Pretax Income" in financials.index
                else 0
            )
            tax_provision = (
                financials.loc["Tax Provision", date]
                if "Tax Provision" in financials.index
                else 0
            )

            # Interest Expense: NaN이면 0으로 처리
            interest_expense = (
                financials.loc["Interest Expense", date]
                if "Interest Expense" in financials.index
                else 0
            )
            if pd.isna(interest_expense):
                interest_expense = 0

            # 재무상태표
            total_equity = (
                balance_sheet.loc["Stockholders Equity", date]
                if "Stockholders Equity" in balance_sheet.index
                else 0
            )
            total_liabilities = (
                balance_sheet.loc["Total Liabilities Net Minority Interest", date]
                if "Total Liabilities Net Minority Interest" in balance_sheet.index
                else 0
            )

            # 현금흐름표
            free_cash_flow = (
                cashflow.loc["Free Cash Flow", date]
                if "Free Cash Flow" in cashflow.index
                else 0
            )

            # EPS
            diluted_eps = (
                financials.loc["Diluted EPS", date]
                if "Diluted EPS" in financials.index
                else 0
            )

            # 세율
            tax_rate = (
                (tax_provision / pretax_income * 100) if pretax_income != 0 else 0
            )

            # 지표 계산
            roe = calculate_roe(net_income, total_equity)
            roic = calculate_roic(ebit, tax_rate, total_equity, total_liabilities)
            net_margin = calculate_net_margin(net_income, revenue)
            fcf_margin = calculate_fcf_margin(free_cash_flow, revenue)
            debt_ratio = (
                (total_liabilities / total_equity * 100) if total_equity != 0 else 0
            )

            # 이자보상배율: interest_expense가 0이면 무차입(무한대)
            if interest_expense == 0:
                interest_coverage = float("inf")  # 무차입 경영
            else:
                interest_coverage = ebit / abs(interest_expense)

            results.append(
                {
                    "year": year,
                    "revenue": revenue,
                    "net_income": net_income,
                    "ebit": ebit,
                    "total_equity": total_equity,
                    "total_liabilities": total_liabilities,
                    "free_cash_flow": free_cash_flow,
                    "eps": diluted_eps,
                    "roe": roe,
                    "roic": roic,
                    "net_margin": net_margin,
                    "fcf_margin": fcf_margin,
                    "debt_ratio": debt_ratio,
                    "interest_coverage": interest_coverage,
                    "interest_expense": interest_expense,
                }
            )

        results.reverse()

        # 데이터 유효성 검증
        valid_results = [
            r
            for r in results
            if (
                r["net_income"] != 0
                and not pd.isna(r["net_income"])
                and r["total_equity"] != 0
                and not pd.isna(r["total_equity"])
                and r["revenue"] != 0
                and not pd.isna(r["revenue"])
                and not pd.isna(r["eps"])
            )
        ]

        if len(valid_results) < 3:
            return None

        results = valid_results
        years_available = len(results)

        # ================================================================
        # 점수 계산
        # ================================================================

        # [1] ROE 점수
        count_15_plus = sum(1 for r in results if r["roe"] >= 15.0)
        count_12_plus = sum(1 for r in results if r["roe"] >= 12.0)
        has_loss = any(r["roe"] < 0 for r in results)

        roe_score = 0
        if has_loss:
            roe_score = 0
        elif count_15_plus == years_available:
            roe_score = 25
        elif count_15_plus >= years_available * 0.8:
            roe_score = 20
        elif count_12_plus == years_available:
            roe_score = 15
        elif count_12_plus >= years_available * 0.8:
            roe_score = 10

        # [2] ROIC 점수
        count_12_plus_roic = sum(1 for r in results if r["roic"] >= 12.0)
        count_9_plus_roic = sum(1 for r in results if r["roic"] >= 9.0)

        roic_score = 0
        if count_12_plus_roic == years_available:
            roic_score = 20
        elif count_12_plus_roic >= years_available * 0.8:
            roic_score = 15
        elif count_9_plus_roic == years_available:
            roic_score = 10
        elif count_9_plus_roic >= years_available * 0.8:
            roic_score = 5

        # [3] Net Margin 점수
        margins = [r["net_margin"] for r in results]
        avg_margin = sum(margins) / len(margins)
        variance = sum((m - avg_margin) ** 2 for m in margins) / len(margins)
        std_dev = math.sqrt(variance)

        avg_score = 0
        if avg_margin >= 20.0:
            avg_score = 10
        elif avg_margin >= 15.0:
            avg_score = 7
        elif avg_margin >= 10.0:
            avg_score = 5

        stability_score = 0
        if std_dev <= 3.0:
            stability_score = 5
        elif std_dev <= 5.0:
            stability_score = 3
        elif std_dev <= 8.0:
            stability_score = 1

        margin_score = avg_score + stability_score

        # [4] 추세 점수
        trend_score = 0
        if years_available >= 4:
            recent_years = min(3, years_available - 1)
            past_years = years_available - recent_years

            recent_roe = sum(r["roe"] for r in results[-recent_years:]) / recent_years
            past_roe = sum(r["roe"] for r in results[:past_years]) / past_years

            improvement = (
                ((recent_roe - past_roe) / past_roe * 100) if past_roe != 0 else 0
            )

            if improvement >= 20.0:
                trend_score = 15
            elif improvement >= 10.0:
                trend_score = 12
            elif improvement >= 5.0:
                trend_score = 9
            elif improvement >= 0.0:
                trend_score = 6
            elif improvement >= -5.0:
                trend_score = 3

        # [5] 재무 건전성 점수
        latest = results[-1]

        debt_score = 0
        if latest["debt_ratio"] <= 50.0:
            debt_score = 10
        elif latest["debt_ratio"] <= 80.0:
            debt_score = 7
        elif latest["debt_ratio"] <= 120.0:
            debt_score = 4
        elif latest["debt_ratio"] <= 150.0:
            debt_score = 2

        # 이자보상배율 점수: NaN 체크 개선
        coverage_score = 0
        if latest["interest_expense"] == 0:
            # 무차입 경영 = 최고 점수
            coverage_score = 5
        elif not pd.isna(latest["interest_coverage"]) and latest[
            "interest_coverage"
        ] != float("inf"):
            if latest["interest_coverage"] >= 10.0:
                coverage_score = 5
            elif latest["interest_coverage"] >= 5.0:
                coverage_score = 3
            elif latest["interest_coverage"] >= 3.0:
                coverage_score = 1

        health_score = debt_score + coverage_score

        # [6] 현금창출력 점수
        fcf_margins = [r["fcf_margin"] for r in results]
        avg_fcf_margin = sum(fcf_margins) / len(fcf_margins)

        cash_score = 0
        if avg_fcf_margin >= 15.0:
            cash_score = 10
        elif avg_fcf_margin >= 10.0:
            cash_score = 7
        elif avg_fcf_margin >= 5.0:
            cash_score = 4
        elif avg_fcf_margin >= 0.0:
            cash_score = 2

        # 총점
        total_score = (
            roe_score
            + roic_score
            + margin_score
            + trend_score
            + health_score
            + cash_score
        )

        # ================================================================
        # 적정가 계산
        # ================================================================
        eps_list = [r["eps"] for r in results]
        oldest_eps = eps_list[0]
        latest_eps = eps_list[-1]

        eps_cagr = calculate_cagr(oldest_eps, latest_eps, years_available - 1)
        conservative_growth = eps_cagr * 0.7
        future_eps = latest_eps * math.pow(1 + conservative_growth / 100, 5)

        if eps_cagr >= 15.0:
            fair_per = 18.0
        elif eps_cagr >= 8.0:
            fair_per = 12.0
        elif eps_cagr >= 0.0:
            fair_per = 10.0
        else:
            fair_per = 8.0

        theoretical_value = future_eps * fair_per
        intrinsic_value = theoretical_value * 0.8

        current_price = info.get("currentPrice", 0)

        # 평가 결과
        if current_price > 0 and intrinsic_value > 0:
            gap_pct = (intrinsic_value - current_price) / current_price * 100
        else:
            gap_pct = 0

        # 최근 연도 평균 지표들
        avg_roe = sum(r["roe"] for r in results) / len(results)
        avg_roic = sum(r["roic"] for r in results) / len(results)

        # 신뢰등급 계산
        grade_num, grade_text, grade_stars = get_trust_grade(years_available)

        # 결과 딕셔너리
        result_dict = {
            "ticker": ticker,
            "total_score": total_score,
            "roe_score": roe_score,
            "roic_score": roic_score,
            "margin_score": margin_score,
            "trend_score": trend_score,
            "health_score": health_score,
            "cash_score": cash_score,
            "pass": "PASS" if total_score >= 85 else "FAIL",
            "current_price": current_price,
            "intrinsic_value": intrinsic_value,
            "gap_pct": gap_pct,
            "recommendation": "BUY" if gap_pct > 0 else "WAIT",
            "avg_roe": avg_roe,
            "avg_roic": avg_roic,
            "avg_net_margin": avg_margin,
            "avg_fcf_margin": avg_fcf_margin,
            "debt_ratio": latest["debt_ratio"],
            "eps_cagr": eps_cagr,
            "years_data": years_available,
            "trust_grade": grade_num,
            "trust_grade_text": grade_text,
            "trust_grade_stars": grade_stars,
        }

        # 우량주 통과 시에만 요약문 생성
        pass_reason = generate_pass_reason(result_dict)
        result_dict["pass_reason"] = pass_reason if pass_reason else ""

        # 적정가 평가 이유 생성 (우량주만)
        valuation_reason = generate_valuation_reason(result_dict)
        result_dict["valuation_reason"] = valuation_reason if valuation_reason else ""

        return result_dict

    except Exception as e:
        return None


def batch_evaluate(tickers):
    """
    여러 종목을 배치로 평가

    Args:
        tickers (list): 티커 리스트

    Returns:
        pd.DataFrame: 결과 데이터프레임
    """
    print("\n" + "=" * 80)
    print("🚀 우량주 배치 평가 시작")
    print("=" * 80)
    print(f"📊 평가 대상: {len(tickers)}개 종목")
    print(f"⏰ 시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    results = []
    failed = []

    # 진행바와 함께 평가
    for ticker in tqdm(tickers, desc="평가 진행", ncols=80):
        result = evaluate_stock_silent(ticker)
        if result:
            results.append(result)
        else:
            failed.append(ticker)

    # 결과를 DataFrame으로 변환
    df = pd.DataFrame(results)

    if not df.empty:
        # 총점 기준 내림차순 정렬
        df = df.sort_values("total_score", ascending=False)

    print("\n" + "=" * 80)
    print("📋 평가 완료!")
    print("=" * 80)
    print(f"✅ 성공: {len(results)}개")
    print(f"❌ 실패: {len(failed)}개")

    if failed:
        print(f"\n⚠️ 평가 실패 종목: {', '.join(failed[:20])}")
        if len(failed) > 20:
            print(f"   ... 외 {len(failed) - 20}개 더")
        print("   (데이터 부족 또는 가져오기 실패)")

    return df, failed


def save_to_csv(df, filename=None):
    """결과를 CSV로 저장"""
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"buffett_evaluation_{timestamp}.csv"

    df.to_csv(filename, index=False, encoding="utf-8-sig")
    print(f"\n💾 결과 저장: {filename}")
    return filename


def print_summary(df):
    """요약 결과 출력"""
    if df.empty:
        print("\n❌ 평가 결과가 없습니다.")
        return

    print("\n" + "=" * 100)
    print("📊 종목별 요약")
    print("=" * 100)
    print(
        f"\n{'순위':<4} {'티커':<8} {'총점':<6} {'등급':<6} {'신뢰':<12} {'현재가':<10} {'적정가':<10} {'GAP':<8} {'추천':<6}"
    )
    print("-" * 100)

    for idx, row in df.iterrows():
        rank = idx + 1 if isinstance(idx, int) else list(df.index).index(idx) + 1
        trust_display = f"{row['trust_grade_text']} {row['trust_grade_stars']}"
        print(
            f"{rank:<4} {row['ticker']:<8} {row['total_score']:<6.0f} {row['pass']:<6} "
            f"{trust_display:<12} ${row['current_price']:<9.2f} ${row['intrinsic_value']:<9.2f} "
            f"{row['gap_pct']:>6.1f}% {row['recommendation']:<6}"
        )

    # 통계
    print("\n" + "=" * 100)
    print("📈 통계 요약")
    print("=" * 100)

    pass_count = len(df[df["pass"] == "PASS"])
    buy_count = len(df[df["recommendation"] == "BUY"])

    print(
        f"\n🏆 우량주 통과: {pass_count}/{len(df)}개 ({pass_count / len(df) * 100:.1f}%)"
    )
    print(f"💰 매수 추천: {buy_count}/{len(df)}개 ({buy_count / len(df) * 100:.1f}%)")
    print(f"\n📊 평균 점수: {df['total_score'].mean():.1f}점")
    print(f"🔝 최고 점수: {df['total_score'].max():.0f}점 ({df.iloc[0]['ticker']})")
    print(f"📉 최저 점수: {df['total_score'].min():.0f}점")

    # 신뢰등급 분포
    print(f"\n⭐ 신뢰등급 분포:")
    grade_counts = df["trust_grade"].value_counts().sort_index()
    for grade in [1, 2, 3]:
        count = grade_counts.get(grade, 0)
        if count > 0:
            pct = count / len(df) * 100
            stars = "★★★★★" if grade == 1 else "★★★★☆" if grade == 2 else "★★★☆☆"
            print(f"   {grade}등급 {stars}: {count}개 ({pct:.1f}%)")

    # 우량주 통과 종목 상세
    if pass_count > 0:
        print("\n" + "=" * 100)
        print("🏆 우량주 통과 종목 상세 분석")
        print("=" * 100)

        pass_stocks = df[df["pass"] == "PASS"]
        for idx, row in pass_stocks.iterrows():
            print("\n" + "-" * 100)
            print(row["pass_reason"])

            print(f"\n📊 현재 투자 정보:")
            print(f"   현재가: ${row['current_price']:.2f}")
            print(f"   적정가: ${row['intrinsic_value']:.2f}")

            # 적정가 평가 이유 출력 추가
            if row.get("valuation_reason") and row["valuation_reason"]:
                print(f"\n💡 적정가 산정 근거:")
                for line in row["valuation_reason"].split("\n"):
                    if line.strip():
                        print(f"   {line}")

            if row["gap_pct"] > 0:
                print(f"   평가: 저평가 (상승여력 +{row['gap_pct']:.1f}%) 💰")
            else:
                print(f"   평가: 고평가 (하락위험 {row['gap_pct']:.1f}%) ⚠️")

    # 매수 추천 요약
    if buy_count > 0:
        print("\n" + "=" * 100)
        print("💡 매수 추천 종목 (저평가 구간)")
        print("=" * 100)
        buy_stocks = df[df["recommendation"] == "BUY"].head(10)
        for idx, row in buy_stocks.iterrows():
            print(
                f"   • {row['ticker']}: ${row['current_price']:.2f} → ${row['intrinsic_value']:.2f} "
                f"(+{row['gap_pct']:.1f}% 상승여력) [{row['trust_grade_text']} {row['trust_grade_stars']}]"
            )


def main():
    """메인 실행 함수"""

    print("\n" + "=" * 80)
    print("🚀 미국 우량주 평가 시스템")
    print("=" * 80)

    # 사용자 선택
    print("\n평가 모드를 선택하세요:")
    print("1. 테스트 모드 (5개 종목)")
    print("2. 나스닥 100 평가")
    print("3. S&P 500 평가")
    print("4. 나스닥 100 + S&P 500 통합 평가")
    print("-" * 80)

    # input 강제 대기
    choice = input("\n👉 선택 (1/2/3/4): ").strip()
    print(f"\n[선택됨] 모드 {choice}")

    if choice == "1":
        # 테스트 모드
        print("\n📊 테스트 모드: 5개 종목 평가")
        test_tickers = ["AAPL", "MSFT", "GOOGL", "NVDA", "META"]
        df, failed = batch_evaluate(test_tickers)

    elif choice == "2":
        # 나스닥 100
        print("\n📊 나스닥 100 평가")
        tickers = get_nasdaq100_tickers()

        if tickers is None or len(tickers) == 0:
            print("❌ 티커 리스트를 가져올 수 없습니다.")
            return

        print(f"\n⚠️ 주의: 총 {len(tickers)}개 종목을 평가합니다.")
        print("⏱️ 예상 소요 시간: 약 10-15분")
        confirm = input("\n👉 계속 진행하시겠습니까? (y/n): ").strip().lower()

        if confirm != "y":
            print("❌ 평가를 취소했습니다.")
            return

        df, failed = batch_evaluate(tickers)

    elif choice == "3":
        # S&P 500
        print("\n📊 S&P 500 평가")
        tickers = get_sp500_tickers()

        if tickers is None or len(tickers) == 0:
            print("❌ 티커 리스트를 가져올 수 없습니다.")
            return

        print(f"\n⚠️ 주의: 총 {len(tickers)}개 종목을 평가합니다.")
        print("⏱️ 예상 소요 시간: 약 40-60분")
        confirm = input("\n👉 계속 진행하시겠습니까? (y/n): ").strip().lower()

        if confirm != "y":
            print("❌ 평가를 취소했습니다.")
            return

        df, failed = batch_evaluate(tickers)

    elif choice == "4":
        # 통합 평가
        print("\n📊 나스닥 100 + S&P 500 통합 평가")

        nasdaq_tickers = get_nasdaq100_tickers()
        sp500_tickers = get_sp500_tickers()

        if not nasdaq_tickers or not sp500_tickers:
            print("❌ 티커 리스트를 가져올 수 없습니다.")
            return

        # 중복 제거
        all_tickers = list(set(nasdaq_tickers + sp500_tickers))

        print(f"\n📊 통합 종목 수:")
        print(f"   - 나스닥 100: {len(nasdaq_tickers)}개")
        print(f"   - S&P 500: {len(sp500_tickers)}개")
        print(f"   - 중복 제거 후: {len(all_tickers)}개")
        print(f"\n⚠️ 주의: 총 {len(all_tickers)}개 종목을 평가합니다.")
        print("⏱️ 예상 소요 시간: 약 50-70분")
        confirm = input("\n👉 계속 진행하시겠습니까? (y/n): ").strip().lower()

        if confirm != "y":
            print("❌ 평가를 취소했습니다.")
            return

        df, failed = batch_evaluate(all_tickers)

    else:
        print(f"❌ 잘못된 선택입니다: '{choice}'")
        print("프로그램을 종료합니다.")
        return

    # 요약 출력
    print_summary(df)

    # CSV 저장
    if not df.empty:
        filename = save_to_csv(df)
        print(f"\n✅ 모든 작업 완료!")
        print(f"📄 상세 결과는 {filename} 파일을 확인하세요.")

    print(f"\n⏰ 종료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")


if __name__ == "__main__":
    main()
