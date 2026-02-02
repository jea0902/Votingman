"""
buffett_calculate.py
역할: 원본 데이터 → 버핏 점수/적정가/요약문 계산
"""

import math
import pandas as pd


def calculate_roe(net_income, total_equity):
    if total_equity == 0 or pd.isna(total_equity):
        return 0.0
    return (net_income / total_equity) * 100


def calculate_roic(ebit, tax_rate, total_equity, total_liabilities):
    if pd.isna(ebit) or pd.isna(tax_rate):
        return 0.0
    nopat = ebit * (1 - tax_rate / 100)
    invested_capital = total_equity + total_liabilities
    if invested_capital == 0:
        return 0.0
    return (nopat / invested_capital) * 100


def calculate_net_margin(net_income, revenue):
    if revenue == 0 or pd.isna(revenue):
        return 0.0
    return (net_income / revenue) * 100


def calculate_fcf_margin(free_cash_flow, revenue):
    if revenue == 0 or pd.isna(revenue):
        return 0.0
    return (free_cash_flow / revenue) * 100


def calculate_cagr(start_value, end_value, years):
    if start_value <= 0 or pd.isna(start_value) or pd.isna(end_value):
        return 0.0
    ratio = end_value / start_value
    cagr = (math.pow(ratio, 1.0 / years) - 1) * 100
    return max(cagr, 0.0)


def get_trust_grade(years):
    if years >= 4:
        return (1, "1등급", "★★★★★")
    elif years == 3:
        return (2, "2등급", "★★★★☆")
    else:
        return (3, "3등급", "★★★☆☆")


def generate_pass_reason(result_data):
    if result_data["total_score"] < 85:
        return None

    ticker = result_data["ticker"]
    total_score = result_data["total_score"]
    years = result_data["years_data"]
    grade_num, grade_text, grade_stars = get_trust_grade(years)

    roe_score = result_data["roe_score"]
    roic_score = result_data["roic_score"]
    margin_score = result_data["margin_score"]
    trend_score = result_data["trend_score"]
    health_score = result_data["health_score"]
    cash_score = result_data["cash_score"]

    avg_roe = result_data["avg_roe"]
    avg_roic = result_data["avg_roic"]
    avg_margin = result_data["avg_net_margin"]
    avg_fcf = result_data["avg_fcf_margin"]
    debt_ratio = result_data["debt_ratio"]

    summary = f"[{ticker} - 총점 {total_score:.0f}점 / 신뢰등급 {grade_text} {grade_stars}]\n\n"
    summary += f"✅ 우량주 통과 이유 ({years}년 데이터 기준):\n\n"

    if roe_score >= 20:
        summary += f"- ROE 지속성: {roe_score}/25점 - {years}년 평균 ROE {avg_roe:.1f}%, 지속적 고수익성\n"
    elif roe_score >= 15:
        summary += f"- ROE 지속성: {roe_score}/25점 - {years}년 중 대부분 ROE 12% 이상 유지\n"
    else:
        summary += f"- ROE 지속성: {roe_score}/25점 - 평균 ROE {avg_roe:.1f}%\n"

    if roic_score >= 15:
        summary += f"- ROIC 지속성: {roic_score}/20점 - {years}년 평균 ROIC {avg_roic:.1f}%, 효율 우수\n"
    elif roic_score >= 10:
        summary += f"- ROIC 지속성: {roic_score}/20점 - 평균 ROIC {avg_roic:.1f}%, 양호\n"
    else:
        summary += f"- ROIC 지속성: {roic_score}/20점 - 평균 ROIC {avg_roic:.1f}%\n"

    if margin_score >= 13:
        summary += f"- Net Margin 안정: {margin_score}/15점 - 평균 {avg_margin:.1f}%, 안정적\n"
    elif margin_score >= 10:
        summary += f"- Net Margin 안정: {margin_score}/15점 - 평균 {avg_margin:.1f}%, 양호\n"
    else:
        summary += f"- Net Margin 안정: {margin_score}/15점 - 평균 {avg_margin:.1f}%\n"

    if trend_score >= 12:
        summary += f"- 수익성 추세: {trend_score}/15점 - 최근 개선\n"
    elif trend_score >= 6:
        summary += f"- 수익성 추세: {trend_score}/15점 - 유지 중\n"
    else:
        summary += f"- 수익성 추세: {trend_score}/15점 - 변동 있음\n"

    if health_score >= 13:
        summary += f"- 재무 건전성: {health_score}/15점 - 부채비율 {debt_ratio:.1f}%, 매우 건전\n"
    elif health_score >= 10:
        summary += f"- 재무 건전성: {health_score}/15점 - 부채비율 {debt_ratio:.1f}%, 건전\n"
    else:
        summary += f"- 재무 건전성: {health_score}/15점 - 부채비율 {debt_ratio:.1f}%\n"

    if cash_score >= 7:
        summary += f"- 현금창출력: {cash_score}/10점 - FCF Margin {avg_fcf:.1f}%, 우수\n"
    elif cash_score >= 4:
        summary += f"- 현금창출력: {cash_score}/10점 - FCF Margin {avg_fcf:.1f}%, 양호\n"
    else:
        summary += f"- 현금창출력: {cash_score}/10점 - FCF Margin {avg_fcf:.1f}%\n"

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

    summary += f"\n💡 투자 포인트: " + (", ".join(highlights) if highlights else "전반적 안정성")
    return summary


def generate_valuation_reason(result_data):
    if result_data["total_score"] < 85:
        return None

    ticker = result_data["ticker"]
    current_price = result_data["current_price"]
    intrinsic_value = result_data["intrinsic_value"]
    gap_pct = result_data["gap_pct"]
    eps_cagr = result_data["eps_cagr"]
    years = result_data["years_data"]

    summary = f"[{ticker} - 적정가 분석]\n\n"
    summary += f"📊 현재 상황:\n"
    summary += f"   • 현재가: ${current_price:.2f}\n"
    summary += f"   • 적정가: ${intrinsic_value:.2f}\n"
    summary += f"   • 상승여력: +{gap_pct:.1f}%\n\n"

    summary += f"💰 저평가 근거:\n\n"
    if eps_cagr >= 15.0:
        summary += f"- 높은 성장성: 최근 {years}년 EPS 연평균 {eps_cagr:.1f}%\n"
        summary += f"- PER 18배 적용\n"
    elif eps_cagr >= 8.0:
        summary += f"- 안정적 성장: 최근 {years}년 EPS 연평균 {eps_cagr:.1f}%\n"
        summary += f"- PER 12배 적용\n"
    elif eps_cagr >= 0.0:
        summary += f"- 완만한 성장: 최근 {years}년 EPS 연평균 {eps_cagr:.1f}%\n"
        summary += f"- PER 10배 적용\n"
    else:
        summary += f"- 성장 둔화: 최근 {years}년 EPS 연평균 {eps_cagr:.1f}%\n"
        summary += f"- PER 8배 적용\n"

    summary += f"- 과거 성장률 70%만 반영\n"
    summary += f"- 안전마진 20% 적용\n\n"

    summary += f"🎯 매수 포인트:\n"
    if gap_pct >= 100:
        summary += f"   • 적정가 대비 {gap_pct:.0f}% 저평가 (강력 매수)\n"
    elif gap_pct >= 50:
        summary += f"   • 적정가 대비 {gap_pct:.0f}% 저평가 (우수 매수)\n"
    elif gap_pct >= 20:
        summary += f"   • 적정가 대비 {gap_pct:.0f}% 저평가 (매수)\n"
    else:
        summary += f"   • 적정가 근접 (상승 여력 제한)\n"

    return summary


def evaluate_stock_from_raw(ticker, raw):
    """
    원본 데이터(raw)로부터 버핏 결과 계산
    """
    try:
        financials = raw["financials"]
        balance_sheet = raw["balance_sheet"]
        cashflow = raw["cashflow"]
        info = raw["info"]

        if financials.empty or balance_sheet.empty or cashflow.empty:
            return None

        years_available = len(financials.columns)
        if years_available < 3:
            return None

        results = []

        for date in financials.columns:
            year = date.year
            if year == 2021:
                continue

            revenue = financials.loc["Total Revenue", date] if "Total Revenue" in financials.index else 0
            net_income = financials.loc["Net Income", date] if "Net Income" in financials.index else 0
            ebit = financials.loc["EBIT", date] if "EBIT" in financials.index else 0
            pretax_income = financials.loc["Pretax Income", date] if "Pretax Income" in financials.index else 0
            tax_provision = financials.loc["Tax Provision", date] if "Tax Provision" in financials.index else 0

            interest_expense = financials.loc["Interest Expense", date] if "Interest Expense" in financials.index else 0
            if pd.isna(interest_expense):
                interest_expense = 0

            total_equity = balance_sheet.loc["Stockholders Equity", date] if "Stockholders Equity" in balance_sheet.index else 0
            total_liabilities = balance_sheet.loc["Total Liabilities Net Minority Interest", date] if "Total Liabilities Net Minority Interest" in balance_sheet.index else 0

            free_cash_flow = cashflow.loc["Free Cash Flow", date] if "Free Cash Flow" in cashflow.index else 0

            diluted_eps = financials.loc["Diluted EPS", date] if "Diluted EPS" in financials.index else 0

            tax_rate = (tax_provision / pretax_income * 100) if pretax_income != 0 else 0

            roe = calculate_roe(net_income, total_equity)
            roic = calculate_roic(ebit, tax_rate, total_equity, total_liabilities)
            net_margin = calculate_net_margin(net_income, revenue)
            fcf_margin = calculate_fcf_margin(free_cash_flow, revenue)
            debt_ratio = (total_liabilities / total_equity * 100) if total_equity != 0 else 0

            if interest_expense == 0:
                interest_coverage = float("inf")
            else:
                interest_coverage = ebit / abs(interest_expense)

            results.append({
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
            })

        results.reverse()
        valid_results = [
            r for r in results
            if r["net_income"] != 0 and not pd.isna(r["net_income"])
            and r["total_equity"] != 0 and not pd.isna(r["total_equity"])
            and r["revenue"] != 0 and not pd.isna(r["revenue"])
            and not pd.isna(r["eps"])
        ]

        if len(valid_results) < 3:
            return None

        results = valid_results
        years_available = len(results)

        # 점수 계산
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

        trend_score = 0
        if years_available >= 4:
            recent_years = min(3, years_available - 1)
            past_years = years_available - recent_years
            recent_roe = sum(r["roe"] for r in results[-recent_years:]) / recent_years
            past_roe = sum(r["roe"] for r in results[:past_years]) / past_years
            improvement = ((recent_roe - past_roe) / past_roe * 100) if past_roe != 0 else 0

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

        coverage_score = 0
        if latest["interest_expense"] == 0:
            coverage_score = 5
        elif not pd.isna(latest["interest_coverage"]) and latest["interest_coverage"] != float("inf"):
            if latest["interest_coverage"] >= 10.0:
                coverage_score = 5
            elif latest["interest_coverage"] >= 5.0:
                coverage_score = 3
            elif latest["interest_coverage"] >= 3.0:
                coverage_score = 1

        health_score = debt_score + coverage_score

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

        total_score = roe_score + roic_score + margin_score + trend_score + health_score + cash_score

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

        gap_pct = (intrinsic_value - current_price) / current_price * 100 if current_price > 0 else 0

        avg_roe = sum(r["roe"] for r in results) / len(results)
        avg_roic = sum(r["roic"] for r in results) / len(results)

        grade_num, grade_text, grade_stars = get_trust_grade(years_available)

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

        result_dict["pass_reason"] = generate_pass_reason(result_dict) or ""
        result_dict["valuation_reason"] = generate_valuation_reason(result_dict) or ""

        return result_dict

    except Exception:
        return None