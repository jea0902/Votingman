"""
버핏원픽 결과 저장 스크립트

설계 의도:
- fmp_evaluate.py의 평가 결과를 Supabase DB에 저장
- buffett_run, stocks, buffett_result, latest_price 테이블 관리
- 평가 + 저장을 한 번에 실행

실행 모드:
- --mode test     : 테스트 모드 (5개 종목만)
- --mode full     : 전체 평가 (Storage에 있는 모든 종목)
- --date          : 현재가 데이터 날짜 (기본값: 오늘)
- --year          : 재무제표 데이터 연도 (기본값: 올해)

사용법:
    python fmp_result.py --mode test --date 2026-01-30 --year 2026
"""

import os
import argparse
from datetime import datetime
from typing import List, Dict, Optional
from tqdm import tqdm
from dotenv import load_dotenv
from supabase import create_client, Client

# fmp_evaluate.py에서 평가 함수 import
from fmp_evaluate import (
    validate_env,
    get_supabase_client,
    evaluate_ticker,
    list_tickers_from_prices,
    find_latest_financial_year,
    get_trust_grade,
    generate_pass_reason,
    generate_valuation_reason,
)

# ============================================================================
# 환경 설정
# ============================================================================

# .env.local 파일 로드
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'))

# 환경 변수
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')


# ============================================================================
# DB 저장 함수
# ============================================================================

def ensure_stock_exists(supabase: Client, ticker: str, company_name: str, 
                        exchange: str = None, industry: str = None) -> int:
    """
    stocks 테이블에 종목이 없으면 생성, 있으면 stock_id 반환
    """
    # 기존 stock 조회
    result = supabase.table("stocks").select("stock_id").eq("ticker", ticker).execute()
    
    if result.data and len(result.data) > 0:
        return result.data[0]["stock_id"]
    
    # 없으면 새로 생성
    insert_result = supabase.table("stocks").insert({
        "ticker": ticker,
        "company_name": company_name or ticker,
        "exchange": exchange,
        "industry": industry,
    }).execute()
    
    if insert_result.data and len(insert_result.data) > 0:
        return insert_result.data[0]["stock_id"]
    
    raise Exception(f"Failed to create stock: {ticker}")


def create_buffett_run(supabase: Client, universe: str, data_source: str, data_version: str) -> int:
    """
    buffett_run 테이블에 새 실행 기록 생성
    """
    result = supabase.table("buffett_run").insert({
        "universe": universe,
        "data_source": data_source,
        "data_version": data_version,
    }).execute()
    
    if result.data and len(result.data) > 0:
        return result.data[0]["run_id"]
    
    raise Exception("Failed to create buffett_run")


def save_buffett_result(supabase: Client, run_id: int, stock_id: int, 
                        eval_result: Dict) -> bool:
    """
    buffett_result 테이블에 평가 결과 저장
    """
    try:
        supabase.table("buffett_result").insert({
            "run_id": run_id,
            "stock_id": stock_id,
            "total_score": eval_result["total_score"],
            "pass_status": eval_result["pass_status"],
            "current_price": eval_result["current_price"],
            "intrinsic_value": eval_result["intrinsic_value"],
            "gap_pct": eval_result["gap_pct"],
            "recommendation": eval_result["recommendation"],
            "is_undervalued": eval_result["is_undervalued"],
            "years_data": eval_result["years_data"],
            "trust_grade": eval_result["trust_grade"],
            "trust_grade_text": eval_result["trust_grade_text"],
            "trust_grade_stars": eval_result["trust_grade_stars"],
            "pass_reason": eval_result["pass_reason"],
            "valuation_reason": eval_result["valuation_reason"],
        }).execute()
        return True
    except Exception as e:
        print(f"   ❌ buffett_result 저장 실패: {e}")
        return False


def save_latest_price(supabase: Client, stock_id: int, current_price: float, price_date: str) -> bool:
    """
    latest_price 테이블에 현재가 저장 (upsert)
    """
    try:
        supabase.table("latest_price").upsert({
            "stock_id": stock_id,
            "current_price": current_price,
            "price_date": price_date,
        }, on_conflict="stock_id").execute()
        return True
    except Exception as e:
        print(f"   ❌ latest_price 저장 실패: {e}")
        return False


# ============================================================================
# 메인 실행 함수
# ============================================================================

def run_evaluation_and_save(tickers: List[str], date: str, year: str, universe: str = "ALL"):
    """
    전체 평가 실행 및 DB 저장
    
    Args:
        tickers: 평가할 티커 목록
        date: 현재가 데이터 날짜
        year: 재무제표 데이터 연도
        universe: 지수 유형 (SP500, NASDAQ100, ALL)
    """
    print("\n" + "=" * 70)
    print("🚀 버핏원픽 평가 + DB 저장 시작")
    print("=" * 70)
    print(f"📅 현재가 날짜: {date}")
    print(f"📊 재무제표 연도: {year}")
    print(f"🎯 평가 종목 수: {len(tickers)}개")
    print(f"🌐 Universe: {universe}")
    print("-" * 70)
    
    supabase = get_supabase_client()
    
    # buffett_run 생성
    run_id = create_buffett_run(supabase, universe, "FMP", date)
    print(f"✅ 평가 실행 ID: {run_id}")
    
    results = []
    failed = []
    saved_count = 0
    
    for ticker in tqdm(tickers, desc="평가 + 저장", ncols=80):
        # 1. 평가
        eval_result = evaluate_ticker(ticker, date, year)
        if not eval_result:
            failed.append(ticker)
            continue
        
        results.append(eval_result)
        
        # 2. DB 저장
        try:
            # stocks 테이블
            stock_id = ensure_stock_exists(
                supabase, 
                ticker, 
                eval_result["company_name"],
                eval_result.get("exchange"),
                eval_result.get("industry")
            )
            
            # buffett_result 테이블
            save_buffett_result(supabase, run_id, stock_id, eval_result)
            
            # latest_price 테이블
            save_latest_price(supabase, stock_id, eval_result["current_price"], date)
            
            saved_count += 1
        except Exception as e:
            print(f"\n   ❌ {ticker} DB 저장 실패: {e}")
    
    # 결과 정렬 (총점 내림차순)
    results.sort(key=lambda x: x["total_score"], reverse=True)
    
    # 요약 출력
    print("\n" + "=" * 70)
    print("📋 평가 + 저장 완료!")
    print("=" * 70)
    print(f"✅ 평가 성공: {len(results)}개")
    print(f"💾 DB 저장: {saved_count}개")
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
    print(f"✅ 결과가 DB에 저장되었습니다. (run_id: {run_id})")
    print(f"🔗 API 조회: /api/buffett?runId={run_id}")
    print("=" * 70 + "\n")
    
    return results, run_id


# ============================================================================
# 메인 실행
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="버핏원픽 평가 + DB 저장 스크립트",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
실행 예시:
  python fmp_result.py --mode test --date 2026-01-30 --year 2026
  python fmp_result.py --mode full --date 2026-01-30 --year 2026
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
    
    parser.add_argument(
        "--universe",
        type=str,
        default="ALL",
        choices=["SP500", "NASDAQ100", "ALL"],
        help="지수 유형"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 70)
    print("🎯 버핏원픽 평가 + DB 저장 스크립트")
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
            print("   먼저 fmp_data_collect.py --mode financials를 실행해주세요.")
            return
        print(f"📊 재무제표 연도 자동 탐색: {year}")
    else:
        year = args.year
    
    # 티커 목록 결정
    if args.mode == "test":
        tickers = ["AAPL", "MSFT", "GOOGL", "NVDA", "META"]
        universe = "ALL"  # DB CHECK 제약: SP500, NASDAQ100, ALL만 허용
    else:
        tickers = list_tickers_from_prices(args.date)
        universe = args.universe
        
        if not tickers:
            print(f"\n❌ prices/{args.date}/ 폴더에 데이터가 없습니다.")
            print("   먼저 fmp_data_collect.py --mode prices를 실행해주세요.")
            return
    
    print(f"\n📋 평가 대상 종목: {len(tickers)}개")
    if len(tickers) <= 10:
        print(f"   {', '.join(tickers)}")
    
    # 평가 + DB 저장 실행
    run_evaluation_and_save(tickers, args.date, year, universe)


if __name__ == "__main__":
    main()
