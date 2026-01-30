"""
yfinance 버핏 평가 스크립트

목적: Supabase Storage에서 데이터를 읽어 버핏 기준으로 평가
- 평가만 수행 (DB 저장 없음)
- yf_result.py에서 DB 저장 담당

신뢰등급 기준:
- 10년 이상: 5점 (★★★★★)
- 5~9년: 4점 (★★★★☆)
- 3~4년: 3점 (★★★☆☆)
- 2년: 2점 (★★☆☆☆)
- 1년 이하: 1점 (★☆☆☆☆)

실행 예시:
  python yf_evaluate.py --mode test --date 2026-01-30
  python yf_evaluate.py --mode full --date 2026-01-30
"""

import os
import sys
import json
import math
import argparse
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

import pandas as pd
from tqdm import tqdm
from dotenv import load_dotenv
from supabase import create_client, Client
import warnings

warnings.filterwarnings("ignore")

# 환경 변수 로드 (.env.local 지원, 프로젝트 루트에서 찾기)
from pathlib import Path

script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent.parent

env_local = project_root / ".env.local"
env_file = project_root / ".env"

if env_local.exists():
    load_dotenv(env_local)
elif env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv()

# ============================================================================
# 설정
# ============================================================================

BUCKET_NAME = "yf-raw-data"


# ============================================================================
# 환경 변수 및 Supabase 클라이언트
# ============================================================================

def validate_env():
    """환경 변수 검증"""
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    missing = []
    if not supabase_url:
        missing.append("SUPABASE_URL")
    if not service_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    
    if missing:
        print(f"❌ 필수 환경 변수가 없습니다: {', '.join(missing)}")
        print("   .env.local 파일을 확인해주세요.")
        sys.exit(1)
    
    print("✅ 환경 변수 확인 완료")


def get_supabase_client() -> Client:
    """Supabase 클라이언트 생성"""
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


# ============================================================================
# Storage 읽기 함수
# ============================================================================

def read_from_storage(file_path: str) -> Optional[Any]:
    """Supabase Storage에서 JSON 데이터 읽기"""
    try:
        supabase = get_supabase_client()
        data = supabase.storage.from_(BUCKET_NAME).download(file_path)
        return json.loads(data.decode('utf-8'))
    except Exception as e:
        return None


def get_financial_data(ticker: str, year: str) -> Optional[Dict]:
    """재무제표 데이터 읽기"""
    return read_from_storage(f"financials/{year}/{ticker}/data.json")


def get_price_data(ticker: str, date: str) -> Optional[Dict]:
    """현재가 데이터 읽기"""
    return read_from_storage(f"prices/{date}/{ticker}.json")


def list_tickers_from_prices(date: str) -> List[str]:
    """prices 폴더에서 티커 목록 추출 (페이지네이션 지원)"""
    try:
        supabase = get_supabase_client()
        all_files = []
        offset = 0
        limit = 1000  # 한 번에 최대 1000개
        
        # 페이지네이션으로 전체 파일 목록 가져오기
        while True:
            result = supabase.storage.from_(BUCKET_NAME).list(
                f"prices/{date}",
                {"limit": limit, "offset": offset}
            )
            
            if not result or len(result) == 0:
                break
            
            all_files.extend(result)
            
            # 더 이상 데이터가 없으면 종료
            if len(result) < limit:
                break
            
            offset += limit
        
        # .json 파일에서 티커 추출
        tickers = []
        for item in all_files:
            name = item.get("name", "")
            if name.endswith(".json"):
                ticker = name.replace(".json", "")
                tickers.append(ticker)
        
        return sorted(tickers)
    except Exception as e:
        print(f"⚠️ 티커 목록 조회 실패: {e}")
        return []


def find_latest_financial_year() -> Optional[str]:
    """financials 폴더에서 가장 최근 연도 탐색"""
    try:
        supabase = get_supabase_client()
        result = supabase.storage.from_(BUCKET_NAME).list("financials")
        
        if not result:
            return None
        
        years = []
        for item in result:
            name = item.get("name", "")
            if item.get("id") is None and name.isdigit():
                years.append(name)
        
        if not years:
            return None
        
        years.sort(reverse=True)
        return years[0]
    except Exception as e:
        print(f"⚠️ 재무제표 연도 탐색 실패: {e}")
        return None


# ============================================================================
# 계산 함수
# ============================================================================

def calculate_roe(net_income: float, total_equity: float) -> float:
    """ROE 계산"""
    if total_equity == 0 or pd.isna(total_equity):
        return 0.0
    return (net_income / total_equity) * 100


def calculate_roic(ebit: float, tax_rate: float, total_equity: float, total_liabilities: float) -> float:
    """ROIC 계산"""
    if pd.isna(ebit) or pd.isna(tax_rate):
        return 0.0
    
    nopat = ebit * (1 - tax_rate / 100)
    invested_capital = total_equity + total_liabilities
    
    if invested_capital == 0:
        return 0.0
    
    return (nopat / invested_capital) * 100


def calculate_net_margin(net_income: float, revenue: float) -> float:
    """Net Margin 계산"""
    if revenue == 0 or pd.isna(revenue):
        return 0.0
    return (net_income / revenue) * 100


def calculate_fcf_margin(free_cash_flow: float, revenue: float) -> float:
    """FCF Margin 계산"""
    if revenue == 0 or pd.isna(revenue):
        return 0.0
    return (free_cash_flow / revenue) * 100


def calculate_cagr(start_value: float, end_value: float, years: int) -> float:
    """CAGR 계산"""
    if start_value <= 0 or pd.isna(start_value) or pd.isna(end_value) or years <= 0:
        return 0.0
    
    ratio = end_value / start_value
    cagr = (math.pow(ratio, 1.0 / years) - 1) * 100
    return max(cagr, 0.0)


# ============================================================================
# 신뢰등급 (수정된 기준)
# ============================================================================

def get_trust_grade(years: int) -> Tuple[int, str, str]:
    """
    데이터 연수에 따른 신뢰등급 반환
    
    기준:
    - 10년 이상: 5점 (★★★★★)
    - 5~9년: 4점 (★★★★☆)
    - 3~4년: 3점 (★★★☆☆)
    - 2년: 2점 (★★☆☆☆)
    - 1년 이하: 1점 (★☆☆☆☆)
    """
    if years >= 10:
        return (5, "5등급", "★★★★★")
    elif years >= 5:
        return (4, "4등급", "★★★★☆")
    elif years >= 3:
        return (3, "3등급", "★★★☆☆")
    elif years >= 2:
        return (2, "2등급", "★★☆☆☆")
    else:
        return (1, "1등급", "★☆☆☆☆")


# ============================================================================
# 요약문 생성
# ============================================================================

def generate_pass_reason(result_data: Dict) -> Optional[str]:
    """우량주 통과 이유 요약문 생성"""
    if result_data["total_score"] < 85:
        return None
    
    ticker = result_data["ticker"]
    total_score = result_data["total_score"]
    years = result_data["years_data"]
    
    grade_num, grade_text, grade_stars = get_trust_grade(years)
    
    summary = f"[{ticker} - 총점 {total_score:.0f}점 / 신뢰등급 {grade_text} {grade_stars}]\n"
    summary += f"✅ 우량주 통과 ({years}년 데이터 기준)\n"
    
    highlights = []
    if result_data.get("roe_score", 0) >= 20:
        highlights.append("지속적 고수익성")
    if result_data.get("roic_score", 0) >= 15:
        highlights.append("우수한 자본효율")
    if result_data.get("margin_score", 0) >= 13:
        highlights.append("안정적 수익구조")
    if result_data.get("health_score", 0) >= 13:
        highlights.append("건전한 재무")
    if result_data.get("cash_score", 0) >= 7:
        highlights.append("강한 현금창출")
    
    if highlights:
        summary += f"💡 {', '.join(highlights)}"
    
    return summary


def generate_valuation_reason(result_data: Dict) -> Optional[str]:
    """적정가 산정 이유 요약문 생성"""
    if result_data["total_score"] < 85:
        return None
    
    ticker = result_data["ticker"]
    current_price = result_data["current_price"]
    intrinsic_value = result_data["intrinsic_value"]
    gap_pct = result_data["gap_pct"]
    eps_cagr = result_data.get("eps_cagr", 0)
    
    summary = f"[{ticker} - 적정가 분석]\n"
    summary += f"• 현재가: ${current_price:.2f}\n"
    summary += f"• 적정가: ${intrinsic_value:.2f}\n"
    summary += f"• 상승여력: {gap_pct:+.1f}%\n"
    
    if gap_pct >= 50:
        summary += "🎯 강력한 매수 기회"
    elif gap_pct >= 20:
        summary += "🎯 양호한 매수 기회"
    elif gap_pct >= 0:
        summary += "🎯 적정가 근접"
    else:
        summary += "⚠️ 고평가 상태"
    
    return summary


# ============================================================================
# 평가 함수
# ============================================================================

def evaluate_ticker(ticker: str, date: str, year: str) -> Optional[Dict]:
    """
    단일 종목 버핏 기준 평가
    
    yfinance에서 수집한 데이터 구조로 평가
    """
    # 데이터 로드
    financial_data = get_financial_data(ticker, year)
    price_data = get_price_data(ticker, date)
    
    if not financial_data or not price_data:
        return None
    
    try:
        financials = financial_data.get("financials", {})
        balance_sheet = financial_data.get("balance_sheet", {})
        cashflow = financial_data.get("cashflow", {})
        
        if not financials or not balance_sheet or not cashflow:
            return None
        
        # 연도별 데이터 추출
        years_list = sorted(financials.keys(), reverse=True)
        
        if len(years_list) < 2:
            return None
        
        results = []
        
        for year_str in years_list:
            fin = financials.get(year_str, {})
            bal = balance_sheet.get(year_str, {})
            cf = cashflow.get(year_str, {})
            
            # 필수 데이터 추출
            revenue = fin.get("Total Revenue", 0) or 0
            net_income = fin.get("Net Income", 0) or 0
            ebit = fin.get("EBIT", 0) or 0
            pretax_income = fin.get("Pretax Income", 0) or 0
            tax_provision = fin.get("Tax Provision", 0) or 0
            
            total_equity = bal.get("Stockholders Equity", 0) or 0
            total_liabilities = bal.get("Total Liabilities Net Minority Interest", 0) or 0
            
            free_cash_flow = cf.get("Free Cash Flow", 0) or 0
            diluted_eps = fin.get("Diluted EPS", 0) or 0
            
            interest_expense = fin.get("Interest Expense", 0) or 0
            
            # 유효성 검사
            if net_income == 0 or total_equity == 0 or revenue == 0:
                continue
            
            # 세율 계산
            tax_rate = (tax_provision / pretax_income * 100) if pretax_income != 0 else 0
            
            # 지표 계산
            roe = calculate_roe(net_income, total_equity)
            roic = calculate_roic(ebit, tax_rate, total_equity, total_liabilities)
            net_margin = calculate_net_margin(net_income, revenue)
            fcf_margin = calculate_fcf_margin(free_cash_flow, revenue)
            debt_ratio = (total_liabilities / total_equity * 100) if total_equity != 0 else 0
            
            # 이자보상배율
            if interest_expense == 0:
                interest_coverage = float("inf")
            else:
                interest_coverage = ebit / abs(interest_expense) if interest_expense else float("inf")
            
            results.append({
                "year": year_str,
                "revenue": revenue,
                "net_income": net_income,
                "eps": diluted_eps,
                "roe": roe,
                "roic": roic,
                "net_margin": net_margin,
                "fcf_margin": fcf_margin,
                "debt_ratio": debt_ratio,
                "interest_coverage": interest_coverage,
                "interest_expense": interest_expense
            })
        
        if len(results) < 2:
            return None
        
        # 오래된 순서로 정렬
        results.sort(key=lambda x: x["year"])
        years_available = len(results)
        
        # ================================================================
        # 점수 계산
        # ================================================================
        
        # [1] ROE 점수 (25점)
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
        
        # [2] ROIC 점수 (20점)
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
        
        # [3] Net Margin 점수 (15점)
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
        
        # [4] 추세 점수 (15점)
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
        
        # [5] 재무 건전성 점수 (15점)
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
        elif latest["interest_coverage"] >= 10.0:
            coverage_score = 5
        elif latest["interest_coverage"] >= 5.0:
            coverage_score = 3
        elif latest["interest_coverage"] >= 3.0:
            coverage_score = 1
        
        health_score = debt_score + coverage_score
        
        # [6] 현금창출력 점수 (10점)
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
        total_score = roe_score + roic_score + margin_score + trend_score + health_score + cash_score
        
        # ================================================================
        # 적정가 계산
        # ================================================================
        eps_list = [r["eps"] for r in results if r["eps"] and r["eps"] > 0]
        
        if len(eps_list) >= 2:
            oldest_eps = eps_list[0]
            latest_eps = eps_list[-1]
            eps_cagr = calculate_cagr(oldest_eps, latest_eps, len(eps_list) - 1)
        else:
            eps_cagr = 0
            latest_eps = eps_list[-1] if eps_list else 0
        
        conservative_growth = eps_cagr * 0.7
        future_eps = latest_eps * math.pow(1 + conservative_growth / 100, 5) if latest_eps > 0 else 0
        
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
        
        current_price = price_data.get("current_price", 0)
        company_name = price_data.get("company_name", financial_data.get("company_name", ticker))
        
        # GAP 계산
        if current_price > 0 and intrinsic_value > 0:
            gap_pct = (intrinsic_value - current_price) / current_price * 100
        else:
            gap_pct = 0
        
        # 평균 지표
        avg_roe = sum(r["roe"] for r in results) / len(results)
        avg_roic = sum(r["roic"] for r in results) / len(results)
        
        # 신뢰등급
        grade_num, grade_text, grade_stars = get_trust_grade(years_available)
        
        # 결과 딕셔너리
        result_dict = {
            "ticker": ticker,
            "company_name": company_name,
            "exchange": price_data.get("exchange", "Unknown"),
            "industry": financial_data.get("industry", "Unknown"),
            "total_score": total_score,
            "roe_score": roe_score,
            "roic_score": roic_score,
            "margin_score": margin_score,
            "trend_score": trend_score,
            "health_score": health_score,
            "cash_score": cash_score,
            "pass_status": "PASS" if total_score >= 85 else "FAIL",
            "current_price": current_price,
            "intrinsic_value": round(intrinsic_value, 2),
            "gap_pct": round(gap_pct, 2),
            "recommendation": "BUY" if gap_pct > 0 else "WAIT",
            "is_undervalued": gap_pct > 0 and total_score >= 85,
            "avg_roe": round(avg_roe, 2),
            "avg_roic": round(avg_roic, 2),
            "avg_net_margin": round(avg_margin, 2),
            "avg_fcf_margin": round(avg_fcf_margin, 2),
            "debt_ratio": round(latest["debt_ratio"], 2),
            "eps_cagr": round(eps_cagr, 2),
            "years_data": years_available,
            "trust_grade": grade_num,
            "trust_grade_text": grade_text,
            "trust_grade_stars": grade_stars,
        }
        
        # 요약문 생성
        result_dict["pass_reason"] = generate_pass_reason(result_dict) or ""
        result_dict["valuation_reason"] = generate_valuation_reason(result_dict) or ""
        
        return result_dict
        
    except Exception as e:
        print(f"⚠️ {ticker} 평가 오류: {e}")
        return None


def run_evaluation(tickers: List[str], date: str, year: str) -> List[Dict]:
    """
    여러 종목 평가 실행 (DB 저장 없음)
    """
    print(f"\n🎯 버핏 평가 시작")
    print(f"   현재가 날짜: {date}")
    print(f"   재무제표 연도: {year}")
    print(f"   평가 종목 수: {len(tickers)}개\n")
    
    results = []
    passed = []
    undervalued = []
    
    for ticker in tqdm(tickers, desc="평가 진행"):
        result = evaluate_ticker(ticker, date, year)
        if result:
            results.append(result)
            if result["pass_status"] == "PASS":
                passed.append(result)
                if result["is_undervalued"]:
                    undervalued.append(result)
    
    # 결과 정렬 (총점 내림차순)
    results.sort(key=lambda x: x["total_score"], reverse=True)
    passed.sort(key=lambda x: x["total_score"], reverse=True)
    undervalued.sort(key=lambda x: x["gap_pct"], reverse=True)
    
    # 결과 출력
    print("\n" + "=" * 70)
    print(f"📊 평가 완료: 총 {len(results)}개 종목")
    print(f"   ✅ 우량주 (PASS): {len(passed)}개")
    print(f"   🔥 저평가 우량주: {len(undervalued)}개")
    print("=" * 70)
    
    if undervalued:
        print("\n🔥 저평가 우량주 TOP 10:")
        for i, r in enumerate(undervalued[:10], 1):
            print(f"   {i}. {r['ticker']}: 총점 {r['total_score']}점, "
                  f"상승여력 {r['gap_pct']:+.1f}%, 신뢰 {r['trust_grade_stars']}")
    
    return results


# ============================================================================
# 메인 실행
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="yfinance 버핏 평가 스크립트 (평가만)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
실행 예시:
  python yf_evaluate.py --mode test --date 2026-01-30
  python yf_evaluate.py --mode full --date 2026-01-30
        """
    )
    
    parser.add_argument(
        "--mode",
        type=str,
        default="test",
        choices=["test", "full"],
        help="실행 모드 (test: 5종목, full: 전체)"
    )
    
    parser.add_argument(
        "--date",
        type=str,
        default=datetime.now().strftime("%Y-%m-%d"),
        help="현재가 데이터 날짜 (YYYY-MM-DD)"
    )
    
    parser.add_argument(
        "--year",
        type=str,
        default="auto",
        help="재무제표 데이터 연도 (YYYY 또는 'auto')"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 70)
    print("🎯 yfinance 버핏 평가 스크립트 (평가만)")
    print("=" * 70)
    print(f"📅 실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔧 모드: {args.mode}")
    print("=" * 70)
    
    # 환경 변수 검증
    validate_env()
    
    # 재무제표 연도 결정
    if args.year == "auto":
        year = find_latest_financial_year()
        if not year:
            print("\n❌ financials/ 폴더에서 연도를 찾을 수 없습니다.")
            return
        print(f"📊 재무제표 연도 자동 탐색: {year}")
    else:
        year = args.year
    
    # 티커 목록 결정
    if args.mode == "test":
        tickers = ["AAPL", "MSFT", "GOOGL", "NVDA", "META"]
    else:
        tickers = list_tickers_from_prices(args.date)
        if not tickers:
            print(f"\n❌ prices/{args.date}/ 폴더에 데이터가 없습니다.")
            return
    
    print(f"\n📋 평가 대상 종목: {len(tickers)}개")
    if len(tickers) <= 10:
        print(f"   {', '.join(tickers)}")
    
    # 평가 실행
    run_evaluation(tickers, args.date, year)


if __name__ == "__main__":
    main()
