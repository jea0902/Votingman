"""
yfinance 버핏 평가 + DB 저장 스크립트

목적: yf_evaluate.py의 평가 결과를 Supabase DB에 저장
- buffett_run: 실행 기록
- stocks: 종목 정보
- buffett_result: 평가 결과
- latest_price: 최신 가격

실행 예시:
  python yf_result.py --mode test --date 2026-01-30
  python yf_result.py --mode full --date 2026-01-30
"""

import os
import sys
import argparse
from datetime import datetime
from typing import List, Dict, Optional

from tqdm import tqdm
from dotenv import load_dotenv
from supabase import Client

# yf_evaluate.py에서 평가 함수 import
from yf_evaluate import (
    validate_env,
    get_supabase_client,
    evaluate_ticker,
    list_tickers_from_prices,
    find_latest_financial_year,
    get_trust_grade,
)

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
# DB 저장 함수
# ============================================================================

def ensure_stock_exists(supabase: Client, ticker: str, company_name: str, 
                        exchange: str = None, industry: str = None) -> int:
    """
    stocks 테이블에 종목이 없으면 추가, 있으면 stock_id 반환
    """
    try:
        # 기존 종목 조회
        result = supabase.table("stocks").select("stock_id").eq("ticker", ticker).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]["stock_id"]
        
        # 새 종목 추가
        insert_result = supabase.table("stocks").insert({
            "ticker": ticker,
            "company_name": company_name,
            "exchange": exchange,
            "industry": industry
        }).execute()
        
        if insert_result.data and len(insert_result.data) > 0:
            return insert_result.data[0]["stock_id"]
        
        return None
    except Exception as e:
        print(f"⚠️ 종목 저장 실패 ({ticker}): {e}")
        return None


def create_buffett_run(supabase: Client, universe: str, data_source: str, 
                       data_version: str) -> int:
    """
    buffett_run 테이블에 실행 기록 추가
    """
    try:
        result = supabase.table("buffett_run").insert({
            "universe": universe,
            "data_source": data_source,
            "data_version": data_version
        }).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]["run_id"]
        
        return None
    except Exception as e:
        print(f"⚠️ 실행 기록 저장 실패: {e}")
        return None


def save_buffett_result(supabase: Client, run_id: int, stock_id: int, 
                        eval_result: Dict) -> bool:
    """
    buffett_result 테이블에 평가 결과 저장
    
    저장 필드:
    - 기본 정보: run_id, stock_id, total_score, pass_status 등
    - 개별 점수: roe_score, roic_score, margin_score, trend_score, health_score, cash_score
    - 실제 지표: avg_roe, avg_roic, avg_net_margin, avg_fcf_margin, debt_ratio, eps_cagr
    """
    try:
        result = supabase.table("buffett_result").insert({
            # 기본 정보
            "run_id": run_id,
            "stock_id": stock_id,
            "total_score": eval_result.get("total_score"),
            "pass_status": eval_result.get("pass_status"),
            "current_price": eval_result.get("current_price"),
            "intrinsic_value": eval_result.get("intrinsic_value"),
            "gap_pct": eval_result.get("gap_pct"),
            "recommendation": eval_result.get("recommendation"),
            "is_undervalued": eval_result.get("is_undervalued"),
            "years_data": eval_result.get("years_data"),
            "trust_grade": eval_result.get("trust_grade"),
            "trust_grade_text": eval_result.get("trust_grade_text"),
            "trust_grade_stars": eval_result.get("trust_grade_stars"),
            "pass_reason": eval_result.get("pass_reason"),
            "valuation_reason": eval_result.get("valuation_reason"),
            # 개별 점수 (총점 세부 내역)
            "roe_score": eval_result.get("roe_score"),
            "roic_score": eval_result.get("roic_score"),
            "margin_score": eval_result.get("margin_score"),
            "trend_score": eval_result.get("trend_score"),
            "health_score": eval_result.get("health_score"),
            "cash_score": eval_result.get("cash_score"),
            # 실제 지표 값
            "avg_roe": eval_result.get("avg_roe"),
            "avg_roic": eval_result.get("avg_roic"),
            "avg_net_margin": eval_result.get("avg_net_margin"),
            "avg_fcf_margin": eval_result.get("avg_fcf_margin"),
            "debt_ratio": eval_result.get("debt_ratio"),
            "eps_cagr": eval_result.get("eps_cagr"),
        }).execute()
        
        return True
    except Exception as e:
        print(f"⚠️ 평가 결과 저장 실패: {e}")
        return False


def save_latest_price(supabase: Client, stock_id: int, current_price: float, 
                      price_date: str) -> bool:
    """
    latest_price 테이블에 최신 가격 저장 (upsert)
    """
    try:
        # 기존 가격 확인
        existing = supabase.table("latest_price").select("stock_id").eq("stock_id", stock_id).execute()
        
        if existing.data and len(existing.data) > 0:
            # 업데이트
            supabase.table("latest_price").update({
                "current_price": current_price,
                "price_date": price_date,
                "updated_at": datetime.now().isoformat()
            }).eq("stock_id", stock_id).execute()
        else:
            # 삽입
            supabase.table("latest_price").insert({
                "stock_id": stock_id,
                "current_price": current_price,
                "price_date": price_date
            }).execute()
        
        return True
    except Exception as e:
        print(f"⚠️ 가격 저장 실패: {e}")
        return False


# ============================================================================
# 평가 + DB 저장 실행
# ============================================================================

def run_evaluation_and_save(tickers: List[str], date: str, year: str, 
                            universe: str = "ALL"):
    """
    평가 실행 후 DB에 저장
    """
    print(f"\n🎯 버핏 평가 + DB 저장 시작")
    print(f"   현재가 날짜: {date}")
    print(f"   재무제표 연도: {year}")
    print(f"   평가 종목 수: {len(tickers)}개")
    print(f"   Universe: {universe}\n")
    
    supabase = get_supabase_client()
    
    # 실행 기록 생성
    run_id = create_buffett_run(supabase, universe, "yfinance", date)
    if not run_id:
        print("❌ 실행 기록 생성 실패")
        return None, None
    
    print(f"✅ 실행 기록 생성: run_id = {run_id}")
    
    results = []
    passed = []
    undervalued = []
    saved_count = 0
    
    for ticker in tqdm(tickers, desc="평가 + 저장"):
        # 평가
        eval_result = evaluate_ticker(ticker, date, year)
        
        if not eval_result:
            continue
        
        results.append(eval_result)
        
        if eval_result["pass_status"] == "PASS":
            passed.append(eval_result)
            if eval_result["is_undervalued"]:
                undervalued.append(eval_result)
        
        # DB 저장
        stock_id = ensure_stock_exists(
            supabase,
            ticker,
            eval_result.get("company_name", ticker),
            eval_result.get("exchange"),
            eval_result.get("industry")
        )
        
        if stock_id:
            # 평가 결과 저장
            if save_buffett_result(supabase, run_id, stock_id, eval_result):
                saved_count += 1
            
            # 최신 가격 저장
            save_latest_price(
                supabase,
                stock_id,
                eval_result.get("current_price", 0),
                date
            )
    
    # 결과 정렬
    results.sort(key=lambda x: x["total_score"], reverse=True)
    passed.sort(key=lambda x: x["total_score"], reverse=True)
    undervalued.sort(key=lambda x: x["gap_pct"], reverse=True)
    
    # 결과 출력
    print("\n" + "=" * 70)
    print(f"📊 평가 + 저장 완료")
    print(f"   총 평가: {len(results)}개 종목")
    print(f"   DB 저장: {saved_count}개")
    print(f"   ✅ 우량주 (PASS): {len(passed)}개")
    print(f"   🔥 저평가 우량주: {len(undervalued)}개")
    print("=" * 70)
    
    if undervalued:
        print("\n🔥 저평가 우량주 TOP 10:")
        for i, r in enumerate(undervalued[:10], 1):
            print(f"   {i}. {r['ticker']}: 총점 {r['total_score']}점, "
                  f"상승여력 {r['gap_pct']:+.1f}%, 신뢰 {r['trust_grade_stars']}")
    
    print(f"\n✅ 결과가 DB에 저장되었습니다. (run_id: {run_id})")
    print(f"🔗 API 조회: /api/buffett?runId={run_id}")
    print("=" * 70 + "\n")
    
    return results, run_id


# ============================================================================
# 메인 실행
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="yfinance 버핏 평가 + DB 저장 스크립트",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
실행 예시:
  python yf_result.py --mode test --date 2026-01-30
  python yf_result.py --mode full --date 2026-01-30
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
    
    parser.add_argument(
        "--universe",
        type=str,
        default="ALL",
        choices=["SP500", "NASDAQ100", "ALL"],
        help="지수 유형"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 70)
    print("🎯 yfinance 버핏 평가 + DB 저장 스크립트")
    print("=" * 70)
    print(f"📅 실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔧 모드: {args.mode}")
    print(f"🌐 Universe: {args.universe}")
    print("=" * 70)
    
    # 환경 변수 검증
    validate_env()
    
    # 재무제표 연도 결정
    if args.year == "auto":
        year = find_latest_financial_year()
        if not year:
            print("\n❌ financials/ 폴더에서 연도를 찾을 수 없습니다.")
            print("   먼저 yf_data_collect.py --mode financials를 실행해주세요.")
            return
        print(f"📊 재무제표 연도 자동 탐색: {year}")
    else:
        year = args.year
    
    # 티커 목록 결정
    if args.mode == "test":
        tickers = ["AAPL", "MSFT", "GOOGL", "NVDA", "META"]
        universe = "ALL"
    else:
        tickers = list_tickers_from_prices(args.date)
        universe = args.universe
        
        if not tickers:
            print(f"\n❌ prices/{args.date}/ 폴더에 데이터가 없습니다.")
            print("   먼저 yf_data_collect.py --mode prices를 실행해주세요.")
            return
    
    print(f"\n📋 평가 대상 종목: {len(tickers)}개")
    if len(tickers) <= 10:
        print(f"   {', '.join(tickers)}")
    
    # 평가 + DB 저장 실행
    run_evaluation_and_save(tickers, args.date, year, universe)


if __name__ == "__main__":
    main()
