"""
버핏원픽 평가 스크립트

설계 의도:
- Supabase Storage에 저장된 FMP 원본 데이터를 읽어 버핏 평가 수행
- 평가 결과만 반환 (DB 저장은 fmp_result.py에서 담당)
- test_nasAndSP.py의 평가 로직을 FMP 데이터 구조에 맞게 수정

실행 모드:
- --mode test     : 테스트 모드 (5개 종목만)
- --mode full     : 전체 평가 (Storage에 있는 모든 종목)
- --date          : 현재가 데이터 날짜 (기본값: 오늘)
- --year          : 재무제표 데이터 연도 (기본값: 올해)

사용법:
    python fmp_evaluate.py --mode test --date 2026-01-30 --year 2026
    
참고: DB 저장까지 하려면 fmp_result.py를 실행하세요.
"""

import os
import json
import math
import argparse
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from tqdm import tqdm
from dotenv import load_dotenv
from supabase import create_client, Client

# ============================================================================
# 환경 설정
# ============================================================================

# .env.local 파일 로드
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'))

# 환경 변수
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Storage 버킷 이름
BUCKET_NAME = "fmp-raw-data"


def validate_env():
    """환경 변수 검증"""
    missing = []
    
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    
    if missing:
        print("\n❌ 필수 환경 변수가 설정되지 않았습니다:")
        for var in missing:
            print(f"   - {var}")
        exit(1)
    
    print("✅ 환경 변수 검증 완료")


def get_supabase_client() -> Client:
    """Supabase 클라이언트 생성"""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ============================================================================
# Storage 데이터 읽기
# ============================================================================

def read_from_storage(file_path: str) -> Optional[Any]:
    """Storage에서 JSON 파일 읽기"""
    try:
        supabase = get_supabase_client()
        response = supabase.storage.from_(BUCKET_NAME).download(file_path)
        return json.loads(response.decode('utf-8'))
    except Exception as e:
        return None


def get_price_data(ticker: str, date: str) -> Optional[Dict]:
    """현재가 데이터 읽기"""
    data = read_from_storage(f"prices/{date}/{ticker}.json")
    if data and "profile" in data:
        return data["profile"]
    return None


def get_financial_data(ticker: str, year: str) -> Optional[Dict[str, List[Dict]]]:
    """
    재무제표 3종 읽기
    
    Returns:
        {
            "income_statement": [...],
            "balance_sheet": [...],
            "cash_flow": [...]
        }
    """
    income = read_from_storage(f"financials/{year}/{ticker}/income-statement.json")
    balance = read_from_storage(f"financials/{year}/{ticker}/balance-sheet.json")
    cashflow = read_from_storage(f"financials/{year}/{ticker}/cash-flow.json")
    
    if not income or not balance or not cashflow:
        return None
    
    return {
        "income_statement": income if isinstance(income, list) else [],
        "balance_sheet": balance if isinstance(balance, list) else [],
        "cash_flow": cashflow if isinstance(cashflow, list) else []
    }


def list_tickers_from_prices(date: str) -> List[str]:
    """prices 폴더에서 티커 목록 추출"""
    try:
        supabase = get_supabase_client()
        result = supabase.storage.from_(BUCKET_NAME).list(f"prices/{date}")
        
        if not result:
            return []
        
        # .json 파일에서 티커 추출
        tickers = []
        for item in result:
            if item.get("name", "").endswith(".json"):
                ticker = item["name"].replace(".json", "")
                tickers.append(ticker)
        
        return sorted(tickers)
    except Exception as e:
        print(f"⚠️ 티커 목록 조회 실패: {e}")
        return []


def find_latest_financial_year() -> Optional[str]:
    """
    financials 폴더에서 가장 최근 연도 자동 탐색
    
    Returns:
        가장 최근 연도 문자열 (예: "2026") 또는 None
    """
    try:
        supabase = get_supabase_client()
        result = supabase.storage.from_(BUCKET_NAME).list("financials")
        
        if not result:
            return None
        
        # 폴더명(연도)만 추출하고 내림차순 정렬
        years = []
        for item in result:
            name = item.get("name", "")
            # 폴더인지 확인 (id가 None이면 폴더)
            if item.get("id") is None and name.isdigit():
                years.append(name)
        
        if not years:
            return None
        
        # 가장 최근 연도 반환
        years.sort(reverse=True)
        return years[0]
    except Exception as e:
        print(f"⚠️ 재무제표 연도 탐색 실패: {e}")
        return None


def get_latest_fiscal_year_from_data(financials: Dict[str, List[Dict]]) -> Optional[str]:
    """
    재무제표 데이터에서 가장 최근 fiscalYear 추출
    
    Returns:
        가장 최근 fiscalYear (예: "2025") 또는 None
    """
    income_list = financials.get("income_statement", [])
    if not income_list:
        return None
    
    # fiscalYear 추출 및 정렬
    fiscal_years = [item.get("fiscalYear") for item in income_list if item.get("fiscalYear")]
    if not fiscal_years:
        return None
    
    # 가장 최근 연도 반환
    fiscal_years.sort(reverse=True)
    return str(fiscal_years[0])


# ============================================================================
# 버핏 평가 계산 함수
# ============================================================================

def calculate_roe(net_income: float, total_equity: float) -> float:
    """ROE (자기자본이익률) 계산"""
    if total_equity == 0 or total_equity is None:
        return 0.0
    return (net_income / total_equity) * 100


def calculate_roic(ebit: float, tax_rate: float, total_equity: float, total_liabilities: float) -> float:
    """ROIC (투하자본이익률) 계산"""
    if ebit is None or tax_rate is None:
        return 0.0
    nopat = ebit * (1 - tax_rate / 100)
    invested_capital = total_equity + total_liabilities
    if invested_capital == 0:
        return 0.0
    return (nopat / invested_capital) * 100


def calculate_net_margin(net_income: float, revenue: float) -> float:
    """순이익률 계산"""
    if revenue == 0 or revenue is None:
        return 0.0
    return (net_income / revenue) * 100


def calculate_fcf_margin(free_cash_flow: float, revenue: float) -> float:
    """FCF 마진 계산"""
    if revenue == 0 or revenue is None:
        return 0.0
    return (free_cash_flow / revenue) * 100


def calculate_cagr(start_value: float, end_value: float, years: int) -> float:
    """연평균 성장률 계산"""
    if start_value <= 0 or start_value is None or end_value is None or years <= 0:
        return 0.0
    ratio = end_value / start_value
    if ratio <= 0:
        return 0.0
    cagr = (math.pow(ratio, 1.0 / years) - 1) * 100
    return max(cagr, 0.0)


def get_trust_grade(years: int) -> Tuple[int, str, str]:
    """데이터 연수에 따른 신뢰등급"""
    if years >= 4:
        return (1, "1등급", "★★★★★")
    elif years == 3:
        return (2, "2등급", "★★★★☆")
    else:
        return (3, "3등급", "★★★☆☆")


def safe_get(data: Dict, key: str, default: float = 0) -> float:
    """딕셔너리에서 안전하게 값 추출"""
    value = data.get(key)
    if value is None:
        return default
    return float(value)


# ============================================================================
# FMP 데이터 → 연도별 지표 변환
# ============================================================================

def extract_yearly_metrics(financials: Dict[str, List[Dict]]) -> List[Dict]:
    """
    FMP 재무제표 데이터에서 연도별 지표 추출
    
    FMP 필드 매핑:
    - revenue → Total Revenue
    - netIncome → Net Income
    - ebit → EBIT
    - incomeBeforeTax → Pretax Income
    - incomeTaxExpense → Tax Provision
    - interestExpense → Interest Expense
    - epsDiluted → Diluted EPS
    - totalStockholdersEquity → Stockholders Equity
    - totalLiabilities → Total Liabilities
    - freeCashFlow → Free Cash Flow
    """
    income_list = financials.get("income_statement", [])
    balance_list = financials.get("balance_sheet", [])
    cashflow_list = financials.get("cash_flow", [])
    
    if not income_list:
        return []
    
    # fiscalYear 기준으로 데이터 매칭
    results = []
    
    for income in income_list:
        fiscal_year = income.get("fiscalYear")
        if not fiscal_year:
            continue
        
        # 같은 연도의 balance sheet 찾기
        balance = next(
            (b for b in balance_list if b.get("fiscalYear") == fiscal_year),
            {}
        )
        
        # 같은 연도의 cash flow 찾기
        cashflow = next(
            (c for c in cashflow_list if c.get("fiscalYear") == fiscal_year),
            {}
        )
        
        # 필드 추출
        revenue = safe_get(income, "revenue")
        net_income = safe_get(income, "netIncome")
        ebit = safe_get(income, "ebit")
        pretax_income = safe_get(income, "incomeBeforeTax")
        tax_expense = safe_get(income, "incomeTaxExpense")
        interest_expense = safe_get(income, "interestExpense")
        diluted_eps = safe_get(income, "epsDiluted")
        
        total_equity = safe_get(balance, "totalStockholdersEquity")
        total_liabilities = safe_get(balance, "totalLiabilities")
        
        free_cash_flow = safe_get(cashflow, "freeCashFlow")
        
        # 세율 계산
        tax_rate = (tax_expense / pretax_income * 100) if pretax_income != 0 else 0
        
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
            interest_coverage = ebit / abs(interest_expense) if interest_expense != 0 else float("inf")
        
        results.append({
            "year": int(fiscal_year),
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
    
    # 연도순 정렬 (오래된 순)
    results.sort(key=lambda x: x["year"])
    
    return results


# ============================================================================
# 버핏 점수 계산
# ============================================================================

def calculate_buffett_score(yearly_metrics: List[Dict]) -> Optional[Dict]:
    """
    연도별 지표로부터 버핏 점수 계산
    
    test_nasAndSP.py의 점수 계산 로직을 그대로 사용
    """
    # 유효한 데이터만 필터링
    valid_results = [
        r for r in yearly_metrics
        if r["net_income"] != 0 and r["total_equity"] != 0 
        and r["revenue"] != 0 and r["eps"] != 0
    ]
    
    if len(valid_results) < 3:
        return None
    
    years_available = len(valid_results)
    
    # [1] ROE 점수 (25점 만점)
    count_15_plus = sum(1 for r in valid_results if r["roe"] >= 15.0)
    count_12_plus = sum(1 for r in valid_results if r["roe"] >= 12.0)
    has_loss = any(r["roe"] < 0 for r in valid_results)
    
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
    
    # [2] ROIC 점수 (20점 만점)
    count_12_plus_roic = sum(1 for r in valid_results if r["roic"] >= 12.0)
    count_9_plus_roic = sum(1 for r in valid_results if r["roic"] >= 9.0)
    
    roic_score = 0
    if count_12_plus_roic == years_available:
        roic_score = 20
    elif count_12_plus_roic >= years_available * 0.8:
        roic_score = 15
    elif count_9_plus_roic == years_available:
        roic_score = 10
    elif count_9_plus_roic >= years_available * 0.8:
        roic_score = 5
    
    # [3] Net Margin 점수 (15점 만점)
    margins = [r["net_margin"] for r in valid_results]
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
    
    # [4] 추세 점수 (15점 만점)
    trend_score = 0
    if years_available >= 4:
        recent_years = min(3, years_available - 1)
        past_years = years_available - recent_years
        recent_roe = sum(r["roe"] for r in valid_results[-recent_years:]) / recent_years
        past_roe = sum(r["roe"] for r in valid_results[:past_years]) / past_years
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
    
    # [5] 재무 건전성 점수 (15점 만점)
    latest = valid_results[-1]
    
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
    elif latest["interest_coverage"] != float("inf"):
        if latest["interest_coverage"] >= 10.0:
            coverage_score = 5
        elif latest["interest_coverage"] >= 5.0:
            coverage_score = 3
        elif latest["interest_coverage"] >= 3.0:
            coverage_score = 1
    
    health_score = debt_score + coverage_score
    
    # [6] 현금창출력 점수 (10점 만점)
    fcf_margins = [r["fcf_margin"] for r in valid_results]
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
    
    # EPS CAGR 및 적정가 계산
    eps_list = [r["eps"] for r in valid_results]
    oldest_eps = eps_list[0]
    latest_eps = eps_list[-1]
    
    eps_cagr = calculate_cagr(oldest_eps, latest_eps, years_available - 1)
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
    
    # 평균 지표
    avg_roe = sum(r["roe"] for r in valid_results) / len(valid_results)
    avg_roic = sum(r["roic"] for r in valid_results) / len(valid_results)
    
    return {
        "total_score": total_score,
        "roe_score": roe_score,
        "roic_score": roic_score,
        "margin_score": margin_score,
        "trend_score": trend_score,
        "health_score": health_score,
        "cash_score": cash_score,
        "intrinsic_value": intrinsic_value,
        "eps_cagr": eps_cagr,
        "avg_roe": avg_roe,
        "avg_roic": avg_roic,
        "avg_net_margin": avg_margin,
        "avg_fcf_margin": avg_fcf_margin,
        "debt_ratio": latest["debt_ratio"],
        "years_data": years_available,
    }


# ============================================================================
# 요약문 생성
# ============================================================================

def generate_pass_reason(ticker: str, score_data: Dict, years: int) -> Optional[str]:
    """우량주 통과 이유 요약문 생성"""
    if score_data["total_score"] < 85:
        return None
    
    grade_num, grade_text, grade_stars = get_trust_grade(years)
    
    summary = f"[{ticker} - 총점 {score_data['total_score']:.0f}점 / 신뢰등급 {grade_text} {grade_stars}]\n\n"
    summary += f"✅ 우량주 통과 이유 ({years}년 데이터 기준):\n\n"
    
    # ROE
    if score_data["roe_score"] >= 20:
        summary += f"- ROE 지속성: {score_data['roe_score']}/25점 - 평균 ROE {score_data['avg_roe']:.1f}%, 지속적 고수익성\n"
    else:
        summary += f"- ROE 지속성: {score_data['roe_score']}/25점 - 평균 ROE {score_data['avg_roe']:.1f}%\n"
    
    # ROIC
    if score_data["roic_score"] >= 15:
        summary += f"- ROIC 지속성: {score_data['roic_score']}/20점 - 평균 ROIC {score_data['avg_roic']:.1f}%, 효율 우수\n"
    else:
        summary += f"- ROIC 지속성: {score_data['roic_score']}/20점 - 평균 ROIC {score_data['avg_roic']:.1f}%\n"
    
    # Margin
    summary += f"- Net Margin 안정: {score_data['margin_score']}/15점 - 평균 {score_data['avg_net_margin']:.1f}%\n"
    
    # Trend
    summary += f"- 수익성 추세: {score_data['trend_score']}/15점\n"
    
    # Health
    summary += f"- 재무 건전성: {score_data['health_score']}/15점 - 부채비율 {score_data['debt_ratio']:.1f}%\n"
    
    # Cash
    summary += f"- 현금창출력: {score_data['cash_score']}/10점 - FCF Margin {score_data['avg_fcf_margin']:.1f}%\n"
    
    # 투자 포인트
    highlights = []
    if score_data["roe_score"] >= 20:
        highlights.append("지속적 고수익성")
    if score_data["roic_score"] >= 15:
        highlights.append("우수한 자본효율")
    if score_data["margin_score"] >= 13:
        highlights.append("안정적 수익구조")
    if score_data["health_score"] >= 13:
        highlights.append("건전한 재무")
    if score_data["cash_score"] >= 7:
        highlights.append("강한 현금창출")
    
    summary += f"\n💡 투자 포인트: " + (", ".join(highlights) if highlights else "전반적 안정성")
    
    return summary


def generate_valuation_reason(ticker: str, score_data: Dict, current_price: float, gap_pct: float, years: int) -> Optional[str]:
    """적정가 산정 이유 요약문 생성"""
    if score_data["total_score"] < 85:
        return None
    
    intrinsic_value = score_data["intrinsic_value"]
    eps_cagr = score_data["eps_cagr"]
    
    summary = f"[{ticker} - 적정가 분석]\n\n"
    summary += f"📊 현재 상황:\n"
    summary += f"   • 현재가: ${current_price:.2f}\n"
    summary += f"   • 적정가: ${intrinsic_value:.2f}\n"
    summary += f"   • 상승여력: {gap_pct:+.1f}%\n\n"
    
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
    summary += f"- 안전마진 20% 적용\n"
    
    return summary


# ============================================================================
# 메인 평가 함수 (DB 저장 없음)
# ============================================================================

def evaluate_ticker(ticker: str, date: str, year: str) -> Optional[Dict]:
    """
    단일 종목 평가 (DB 저장 없음, 평가 결과만 반환)
    
    Returns:
        평가 결과 딕셔너리 또는 None
    """
    # 1. 현재가 데이터 읽기
    profile = get_price_data(ticker, date)
    if not profile:
        return None
    
    current_price = profile.get("price", 0)
    company_name = profile.get("companyName", ticker)
    exchange = profile.get("exchange")
    industry = profile.get("industry")
    
    if current_price <= 0:
        return None
    
    # 2. 재무제표 데이터 읽기
    financials = get_financial_data(ticker, year)
    if not financials:
        return None
    
    # 3. 연도별 지표 추출
    yearly_metrics = extract_yearly_metrics(financials)
    if len(yearly_metrics) < 3:
        return None
    
    # 4. 버핏 점수 계산
    score_data = calculate_buffett_score(yearly_metrics)
    if not score_data:
        return None
    
    # 5. 결과 계산
    intrinsic_value = score_data["intrinsic_value"]
    gap_pct = ((intrinsic_value - current_price) / current_price * 100) if current_price > 0 else 0
    years = score_data["years_data"]
    
    grade_num, grade_text, grade_stars = get_trust_grade(years)
    
    pass_status = "PASS" if score_data["total_score"] >= 85 else "FAIL"
    recommendation = "BUY" if gap_pct > 0 and pass_status == "PASS" else "WAIT"
    is_undervalued = gap_pct > 0
    
    pass_reason = generate_pass_reason(ticker, score_data, years)
    valuation_reason = generate_valuation_reason(ticker, score_data, current_price, gap_pct, years)
    
    return {
        # 기본 정보
        "ticker": ticker,
        "company_name": company_name,
        "exchange": exchange,
        "industry": industry,
        "current_price": current_price,
        "price_date": date,
        
        # 평가 결과
        "total_score": score_data["total_score"],
        "pass_status": pass_status,
        "intrinsic_value": intrinsic_value,
        "gap_pct": gap_pct,
        "recommendation": recommendation,
        "is_undervalued": is_undervalued,
        "years_data": years,
        
        # 신뢰등급
        "trust_grade": grade_num,
        "trust_grade_text": grade_text,
        "trust_grade_stars": grade_stars,
        
        # 요약문
        "pass_reason": pass_reason,
        "valuation_reason": valuation_reason,
        
        # 상세 점수 (fmp_result.py에서 필요 시 사용)
        "score_data": score_data,
    }


def run_evaluation(tickers: List[str], date: str, year: str) -> List[Dict]:
    """
    전체 평가 실행 (DB 저장 없음)
    
    Args:
        tickers: 평가할 티커 목록
        date: 현재가 데이터 날짜
        year: 재무제표 데이터 연도
    
    Returns:
        평가 결과 리스트 (총점 내림차순 정렬)
    """
    print("\n" + "=" * 70)
    print("🚀 버핏원픽 평가 시작")
    print("=" * 70)
    print(f"📅 현재가 날짜: {date}")
    print(f"📊 재무제표 연도: {year}")
    print(f"🎯 평가 종목 수: {len(tickers)}개")
    print("-" * 70)
    
    results = []
    failed = []
    
    for ticker in tqdm(tickers, desc="평가 진행", ncols=80):
        result = evaluate_ticker(ticker, date, year)
        if result:
            results.append(result)
        else:
            failed.append(ticker)
    
    # 결과 정렬 (총점 내림차순)
    results.sort(key=lambda x: x["total_score"], reverse=True)
    
    # 요약 출력
    print("\n" + "=" * 70)
    print("📋 평가 완료!")
    print("=" * 70)
    print(f"✅ 성공: {len(results)}개")
    print(f"❌ 실패: {len(failed)}개")
    
    if failed:
        print(f"\n⚠️ 평가 실패 종목: {', '.join(failed[:20])}")
        if len(failed) > 20:
            print(f"   ... 외 {len(failed) - 20}개")
    
    # 우량주 통과 종목
    pass_count = sum(1 for r in results if r["pass_status"] == "PASS")
    buy_count = sum(1 for r in results if r["recommendation"] == "BUY")
    
    print(f"\n🏆 우량주 통과: {pass_count}/{len(results)}개")
    print(f"💰 매수 추천: {buy_count}/{len(results)}개")
    
    if results:
        print(f"\n📊 평균 점수: {sum(r['total_score'] for r in results) / len(results):.1f}점")
        print(f"🔝 최고 점수: {results[0]['total_score']:.0f}점 ({results[0]['ticker']})")
    
    # 상위 10개 출력
    if results:
        print("\n" + "-" * 70)
        print("🏆 상위 10개 종목")
        print("-" * 70)
        print(f"{'순위':<4} {'티커':<8} {'기업명':<20} {'점수':<6} {'등급':<6} {'현재가':>10} {'적정가':>10} {'GAP':>8}")
        print("-" * 70)
        
        for i, r in enumerate(results[:10], 1):
            name = r["company_name"][:18] if len(r["company_name"]) > 18 else r["company_name"]
            print(f"{i:<4} {r['ticker']:<8} {name:<20} {r['total_score']:<6.0f} {r['pass_status']:<6} "
                  f"${r['current_price']:>9.2f} ${r['intrinsic_value']:>9.2f} {r['gap_pct']:>+7.1f}%")
    
    print("\n" + "=" * 70)
    print("ℹ️  DB 저장을 하려면 fmp_result.py를 실행하세요.")
    print("=" * 70 + "\n")
    
    return results


# ============================================================================
# 메인 실행
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="버핏원픽 평가 스크립트 (평가만, DB 저장 X)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
실행 예시:
  python fmp_evaluate.py --mode test --date 2026-01-30 --year 2026
  
DB 저장까지 하려면:
  python fmp_result.py --mode test --date 2026-01-30 --year 2026
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
        help="재무제표 데이터 연도 (YYYY 또는 'auto'로 자동 탐색)"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 70)
    print("🎯 버핏원픽 평가 스크립트 (평가만)")
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
            print("   먼저 fmp_data_collect.py --mode financials를 실행해주세요.")
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
            print("   먼저 fmp_data_collect.py --mode prices를 실행해주세요.")
            return
    
    print(f"\n📋 평가 대상 종목: {len(tickers)}개")
    if len(tickers) <= 10:
        print(f"   {', '.join(tickers)}")
    
    # 평가 실행 (DB 저장 없음)
    run_evaluation(tickers, args.date, year)


if __name__ == "__main__":
    main()
