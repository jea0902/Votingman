"""
FMP (Financial Modeling Prep) 데이터 수집 스크립트

설계 의도:
- 버핏원픽 서비스를 위한 재무 데이터 수집
- FMP API를 통해 S&P 500, NASDAQ 100 종목의 재무제표와 현재가 수집
- 원본 데이터를 Supabase Storage에 JSON 형태로 저장
- 무료 요금제 제약 (250회/일, 5회/분) 준수

실행 모드:
- --mode tickers    : 티커 목록 갱신 (월 1회)
- --mode financials : 재무제표 수집 (연 1회)
- --mode prices     : 현재가 수집 (일간)
- --mode test       : 테스트 모드 (5개 종목만)

사용법:
    python fmp_data_collect.py --mode tickers
    python fmp_data_collect.py --mode financials
    python fmp_data_collect.py --mode prices
    python fmp_data_collect.py --mode test
"""

import os
import json
import time
import argparse
import requests
import pandas as pd
from datetime import datetime
from typing import Optional, List, Dict, Any
from tqdm import tqdm
from dotenv import load_dotenv
from supabase import create_client, Client

# ============================================================================
# 환경 설정
# ============================================================================

# .env.local 파일 로드 (프로젝트 루트 기준)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'))

# 환경 변수
FMP_API_KEY = os.getenv('FMP_API_KEY')
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# FMP API 기본 URL
FMP_BASE_URL = "https://financialmodelingprep.com/stable"

# Storage 버킷 이름
BUCKET_NAME = "fmp-raw-data"

# Rate Limit 설정 (무료 요금제: 5회/분)
RATE_LIMIT_DELAY = 12  # 12초 간격 = 5회/분


def validate_env():
    """
    환경 변수 검증
    
    필수 환경 변수가 설정되어 있는지 확인합니다.
    누락된 경우 명확한 에러 메시지를 출력합니다.
    """
    missing = []
    
    if not FMP_API_KEY:
        missing.append("FMP_API_KEY")
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    
    if missing:
        print("\n❌ 필수 환경 변수가 설정되지 않았습니다:")
        for var in missing:
            print(f"   - {var}")
        print("\n📝 .env.local 파일에 위 변수들을 설정해주세요.")
        print("   참고: .env.example 파일을 확인하세요.\n")
        exit(1)
    
    print("✅ 환경 변수 검증 완료")


# ============================================================================
# Supabase Storage 클라이언트
# ============================================================================

def get_supabase_client() -> Client:
    """
    Supabase 클라이언트 생성
    
    Returns:
        Client: Supabase 클라이언트 인스턴스
    """
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def save_to_storage(file_path: str, data: Any) -> bool:
    """
    Supabase Storage에 JSON 데이터 저장
    
    Args:
        file_path: 저장할 파일 경로 (예: "tickers/2026-01/sp500.json")
        data: 저장할 데이터 (JSON 직렬화 가능한 객체)
    
    Returns:
        bool: 저장 성공 여부
    
    보안: service_role 키를 사용하여 RLS 우회
    """
    try:
        supabase = get_supabase_client()
        
        # JSON 직렬화
        json_data = json.dumps(data, ensure_ascii=False, indent=2)
        json_bytes = json_data.encode('utf-8')
        
        # Storage에 업로드 (기존 파일 덮어쓰기)
        result = supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=json_bytes,
            file_options={"content-type": "application/json", "upsert": "true"}
        )
        
        return True
        
    except Exception as e:
        print(f"   ❌ Storage 저장 실패: {file_path}")
        print(f"      에러: {str(e)}")
        return False


def read_from_storage(file_path: str) -> Optional[Any]:
    """
    Supabase Storage에서 JSON 데이터 읽기
    
    Args:
        file_path: 읽을 파일 경로
    
    Returns:
        파싱된 JSON 데이터 또는 None
    """
    try:
        supabase = get_supabase_client()
        
        # Storage에서 다운로드
        response = supabase.storage.from_(BUCKET_NAME).download(file_path)
        
        # JSON 파싱
        data = json.loads(response.decode('utf-8'))
        return data
        
    except Exception as e:
        print(f"   ⚠️ Storage 읽기 실패: {file_path}")
        return None


# ============================================================================
# Wikipedia 티커 파싱
# ============================================================================

def get_sp500_tickers() -> Optional[List[str]]:
    """
    S&P 500 티커 리스트를 가져옴 (GitHub 백업 소스 사용)
    
    Returns:
        list: S&P 500 티커 리스트 또는 None
    
    데이터 소스: GitHub의 공개 S&P 500 데이터셋
    """
    try:
        print("\n🔍 S&P 500 티커 리스트 가져오는 중...")
        
        # GitHub 공개 데이터셋 사용
        url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
        df = pd.read_csv(url)
        tickers = df["Symbol"].tolist()
        
        # 클린업: 공백 제거, .을 -로 변환 (yfinance 호환용이지만 FMP도 동일)
        tickers = [str(t).strip().replace(".", "-") for t in tickers if pd.notna(t)]
        
        print(f"✅ S&P 500: {len(tickers)}개 종목 발견!")
        
        return tickers
        
    except Exception as e:
        print(f"❌ S&P 500 가져오기 실패: {str(e)}")
        return None


def get_nasdaq100_tickers() -> Optional[List[str]]:
    """
    Wikipedia에서 나스닥 100 티커 리스트를 가져옴
    
    Returns:
        list: 나스닥 100 티커 리스트 또는 None
    
    주의: Wikipedia 구조 변경 시 파싱 실패 가능 → fallback 사용
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
                break
        
        if nasdaq100_df is None:
            print("⚠️ 테이블을 찾을 수 없습니다. Fallback 사용...")
            return get_nasdaq100_fallback()
        
        # 티커 컬럼명 찾기
        ticker_column = "Ticker" if "Ticker" in nasdaq100_df.columns else "Symbol"
        
        # 티커 리스트 추출
        tickers = nasdaq100_df[ticker_column].tolist()
        
        # 클린업
        tickers = [str(t).strip() for t in tickers if pd.notna(t)]
        
        print(f"✅ 나스닥 100: {len(tickers)}개 종목 발견!")
        
        return tickers
        
    except Exception as e:
        print(f"⚠️ Wikipedia 파싱 실패: {str(e)}")
        print("   Fallback 리스트를 사용합니다...")
        return get_nasdaq100_fallback()


def get_nasdaq100_fallback() -> List[str]:
    """
    나스닥 100 기본 리스트 (백업용)
    
    Wikipedia 파싱 실패 시 사용하는 하드코딩된 리스트입니다.
    주기적으로 업데이트가 필요합니다.
    """
    return [
        # 메가캡 테크
        "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA",
        # 대형 테크
        "AVGO", "COST", "NFLX", "ADBE", "CSCO", "PEP", "AMD", "TMUS",
        "INTC", "CMCSA", "INTU", "TXN", "QCOM", "AMGN", "ISRG", "HON",
        "AMAT", "BKNG", "VRTX", "SBUX", "MDLZ", "GILD", "ADP", "ADI",
        "REGN", "LRCX", "PANW", "MU", "SNPS", "KLAC", "CDNS", "MELI",
        "PYPL", "ASML", "ABNB", "ORLY", "CRWD", "CTAS", "MAR", "MNST",
        "MRVL", "NXPI", "WDAY", "PCAR", "FTNT", "CPRT", "ROST", "CHTR",
        "DXCM", "ODFL", "KDP", "AEP", "PAYX", "KHC", "FAST", "EXC",
        "IDXX", "VRSK", "BKR", "CTSH", "GEHC", "CSGP", "EA", "XEL",
        "CCEP", "DDOG", "ANSS", "TEAM", "FANG", "ON", "CDW", "GFS",
        "ZS", "ILMN", "TTD", "WBD", "BIIB", "MRNA", "DLTR", "WBA",
        "SIRI", "LCID", "ARM", "SMCI", "CEG",
    ]


# ============================================================================
# FMP API 호출
# ============================================================================

def call_fmp_api(endpoint: str, params: Dict[str, str] = None) -> Optional[Any]:
    """
    FMP API 호출
    
    Args:
        endpoint: API 엔드포인트 (예: "income-statement")
        params: 추가 쿼리 파라미터
    
    Returns:
        API 응답 데이터 또는 None
    
    에러 처리:
    - 네트워크 에러: 재시도 없이 None 반환
    - HTTP 에러: 상태 코드별 메시지 출력
    - Rate Limit: 429 에러 시 대기 후 재시도
    """
    try:
        url = f"{FMP_BASE_URL}/{endpoint}"
        
        # 기본 파라미터에 API 키 추가
        request_params = {"apikey": FMP_API_KEY}
        if params:
            request_params.update(params)
        
        response = requests.get(url, params=request_params, timeout=30)
        
        # HTTP 에러 처리
        if response.status_code == 429:
            print("   ⏳ Rate Limit 도달. 60초 대기 중...")
            time.sleep(60)
            return call_fmp_api(endpoint, params)  # 재시도
        
        if response.status_code == 403:
            print(f"   ❌ 403 Forbidden: 엔드포인트 접근 불가 ({endpoint})")
            return None
        
        if response.status_code != 200:
            print(f"   ❌ HTTP {response.status_code}: {endpoint}")
            return None
        
        return response.json()
        
    except requests.exceptions.Timeout:
        print(f"   ⚠️ 타임아웃: {endpoint}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"   ❌ 네트워크 에러: {str(e)}")
        return None
    except json.JSONDecodeError:
        print(f"   ❌ JSON 파싱 실패: {endpoint}")
        return None


def fetch_income_statement(ticker: str) -> Optional[List[Dict]]:
    """손익계산서 조회 (5년치)"""
    return call_fmp_api("income-statement", {"symbol": ticker})


def fetch_balance_sheet(ticker: str) -> Optional[List[Dict]]:
    """재무상태표 조회 (5년치)"""
    return call_fmp_api("balance-sheet-statement", {"symbol": ticker})


def fetch_cash_flow(ticker: str) -> Optional[List[Dict]]:
    """현금흐름표 조회 (5년치)"""
    return call_fmp_api("cash-flow-statement", {"symbol": ticker})


def fetch_profile(ticker: str) -> Optional[List[Dict]]:
    """기업 프로필 + 현재가 조회"""
    return call_fmp_api("profile", {"symbol": ticker})


# ============================================================================
# 데이터 수집 함수
# ============================================================================

def collect_tickers() -> bool:
    """
    티커 목록 수집 및 Storage 저장
    
    S&P 500과 NASDAQ 100 티커 목록을 Wikipedia/GitHub에서 가져와
    Supabase Storage에 저장합니다.
    
    저장 경로: tickers/{year-month}/sp500.json, nasdaq100.json
    
    Returns:
        bool: 수집 성공 여부
    """
    print("\n" + "=" * 60)
    print("📋 티커 목록 수집 시작")
    print("=" * 60)
    
    today = datetime.now()
    year_month = today.strftime("%Y-%m")
    
    success = True
    
    # S&P 500
    sp500 = get_sp500_tickers()
    if sp500:
        file_path = f"tickers/{year_month}/sp500.json"
        data = {
            "updated_at": today.isoformat(),
            "count": len(sp500),
            "tickers": sp500
        }
        if save_to_storage(file_path, data):
            print(f"   ✅ 저장 완료: {file_path}")
        else:
            success = False
    else:
        success = False
    
    # NASDAQ 100
    nasdaq100 = get_nasdaq100_tickers()
    if nasdaq100:
        file_path = f"tickers/{year_month}/nasdaq100.json"
        data = {
            "updated_at": today.isoformat(),
            "count": len(nasdaq100),
            "tickers": nasdaq100
        }
        if save_to_storage(file_path, data):
            print(f"   ✅ 저장 완료: {file_path}")
        else:
            success = False
    else:
        success = False
    
    # 통합 목록 (중복 제거)
    if sp500 and nasdaq100:
        all_tickers = sorted(list(set(sp500 + nasdaq100)))
        file_path = f"tickers/{year_month}/all.json"
        data = {
            "updated_at": today.isoformat(),
            "count": len(all_tickers),
            "sp500_count": len(sp500),
            "nasdaq100_count": len(nasdaq100),
            "tickers": all_tickers
        }
        if save_to_storage(file_path, data):
            print(f"   ✅ 저장 완료: {file_path} (통합 {len(all_tickers)}개)")
    
    return success


def collect_financials(tickers: List[str], year: str = None) -> Dict[str, int]:
    """
    재무제표 수집 (손익계산서, 재무상태표, 현금흐름표)
    
    각 종목에 대해 3개의 재무제표를 FMP API에서 가져와
    Supabase Storage에 저장합니다.
    
    저장 경로: financials/{year}/{ticker}/income-statement.json 등
    
    Args:
        tickers: 수집할 티커 목록
        year: 저장할 연도 (기본값: 현재 연도)
    
    Returns:
        dict: 성공/실패 카운트 {"success": n, "failed": n}
    
    Rate Limit: 종목당 3 API 호출, 호출 간 12초 대기
    """
    if year is None:
        year = datetime.now().strftime("%Y")
    
    print("\n" + "=" * 60)
    print(f"📊 재무제표 수집 시작 ({len(tickers)}개 종목)")
    print("=" * 60)
    print(f"📅 저장 연도: {year}")
    print(f"⏱️ 예상 소요 시간: 약 {len(tickers) * 3 * RATE_LIMIT_DELAY // 60}분")
    print("-" * 60)
    
    results = {"success": 0, "failed": 0, "failed_tickers": []}
    
    for ticker in tqdm(tickers, desc="재무제표 수집", ncols=80):
        ticker_success = True
        
        # 1. 손익계산서
        income = fetch_income_statement(ticker)
        if income:
            save_to_storage(f"financials/{year}/{ticker}/income-statement.json", income)
        else:
            ticker_success = False
        time.sleep(RATE_LIMIT_DELAY)
        
        # 2. 재무상태표
        balance = fetch_balance_sheet(ticker)
        if balance:
            save_to_storage(f"financials/{year}/{ticker}/balance-sheet.json", balance)
        else:
            ticker_success = False
        time.sleep(RATE_LIMIT_DELAY)
        
        # 3. 현금흐름표
        cashflow = fetch_cash_flow(ticker)
        if cashflow:
            save_to_storage(f"financials/{year}/{ticker}/cash-flow.json", cashflow)
        else:
            ticker_success = False
        time.sleep(RATE_LIMIT_DELAY)
        
        if ticker_success:
            results["success"] += 1
        else:
            results["failed"] += 1
            results["failed_tickers"].append(ticker)
    
    print("\n" + "-" * 60)
    print(f"✅ 성공: {results['success']}개")
    print(f"❌ 실패: {results['failed']}개")
    if results["failed_tickers"]:
        print(f"   실패 종목: {', '.join(results['failed_tickers'][:20])}")
        if len(results["failed_tickers"]) > 20:
            print(f"   ... 외 {len(results['failed_tickers']) - 20}개")
    
    return results


def collect_prices(tickers: List[str]) -> Dict[str, int]:
    """
    현재가 수집 (일간)
    
    각 종목의 현재가와 기업 정보를 FMP profile API에서 가져와
    Supabase Storage에 저장합니다.
    
    저장 경로: prices/{date}/{ticker}.json
    
    Args:
        tickers: 수집할 티커 목록
    
    Returns:
        dict: 성공/실패 카운트
    
    Rate Limit: 종목당 1 API 호출, 호출 간 12초 대기
    """
    today = datetime.now().strftime("%Y-%m-%d")
    
    print("\n" + "=" * 60)
    print(f"💰 현재가 수집 시작 ({len(tickers)}개 종목)")
    print("=" * 60)
    print(f"📅 수집 날짜: {today}")
    print(f"⏱️ 예상 소요 시간: 약 {len(tickers) * RATE_LIMIT_DELAY // 60}분")
    print("-" * 60)
    
    results = {"success": 0, "failed": 0, "failed_tickers": []}
    
    for ticker in tqdm(tickers, desc="현재가 수집", ncols=80):
        profile = fetch_profile(ticker)
        
        if profile and len(profile) > 0:
            # profile API는 배열로 반환되므로 첫 번째 요소 사용
            data = {
                "fetched_at": datetime.now().isoformat(),
                "ticker": ticker,
                "profile": profile[0] if isinstance(profile, list) else profile
            }
            if save_to_storage(f"prices/{today}/{ticker}.json", data):
                results["success"] += 1
            else:
                results["failed"] += 1
                results["failed_tickers"].append(ticker)
        else:
            results["failed"] += 1
            results["failed_tickers"].append(ticker)
        
        time.sleep(RATE_LIMIT_DELAY)
    
    print("\n" + "-" * 60)
    print(f"✅ 성공: {results['success']}개")
    print(f"❌ 실패: {results['failed']}개")
    if results["failed_tickers"]:
        print(f"   실패 종목: {', '.join(results['failed_tickers'][:20])}")
    
    return results


def get_cached_tickers() -> Optional[List[str]]:
    """
    Storage에서 캐시된 티커 목록 로드
    
    가장 최근 저장된 통합 티커 목록(all.json)을 읽어옵니다.
    없으면 None 반환.
    
    Returns:
        list: 티커 목록 또는 None
    """
    today = datetime.now()
    year_month = today.strftime("%Y-%m")
    
    # 이번 달 데이터 시도
    data = read_from_storage(f"tickers/{year_month}/all.json")
    if data and "tickers" in data:
        print(f"✅ 캐시된 티커 목록 로드: {data['count']}개")
        return data["tickers"]
    
    # 지난 달 데이터 시도
    if today.month == 1:
        prev_year_month = f"{today.year - 1}-12"
    else:
        prev_year_month = f"{today.year}-{today.month - 1:02d}"
    
    data = read_from_storage(f"tickers/{prev_year_month}/all.json")
    if data and "tickers" in data:
        print(f"✅ 이전 티커 목록 로드: {data['count']}개 ({prev_year_month})")
        return data["tickers"]
    
    return None


# ============================================================================
# 메인 실행
# ============================================================================

def main():
    """
    메인 실행 함수
    
    명령행 인자를 파싱하여 적절한 수집 모드를 실행합니다.
    """
    parser = argparse.ArgumentParser(
        description="FMP 데이터 수집 스크립트 (버핏원픽용)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
실행 예시:
  python fmp_data_collect.py --mode tickers      # 티커 목록 갱신
  python fmp_data_collect.py --mode financials   # 재무제표 수집
  python fmp_data_collect.py --mode prices       # 현재가 수집
  python fmp_data_collect.py --mode test         # 테스트 (5종목)
        """
    )
    
    parser.add_argument(
        "--mode",
        type=str,
        required=True,
        choices=["tickers", "financials", "prices", "test"],
        help="수집 모드 선택"
    )
    
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="수집할 종목 수 제한 (테스트용)"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("🚀 FMP 데이터 수집 스크립트")
    print("=" * 60)
    print(f"📅 실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔧 모드: {args.mode}")
    print("=" * 60)
    
    # 환경 변수 검증
    validate_env()
    
    # 모드별 실행
    if args.mode == "tickers":
        collect_tickers()
        
    elif args.mode == "financials":
        # 캐시된 티커 목록 로드 시도
        tickers = get_cached_tickers()
        
        if not tickers:
            print("\n⚠️ 캐시된 티커 목록이 없습니다.")
            print("   먼저 --mode tickers를 실행해주세요.")
            print("   또는 Wikipedia/GitHub에서 직접 가져옵니다...")
            
            sp500 = get_sp500_tickers() or []
            nasdaq100 = get_nasdaq100_tickers() or []
            tickers = sorted(list(set(sp500 + nasdaq100)))
        
        if args.limit:
            tickers = tickers[:args.limit]
            print(f"⚠️ 종목 수 제한: {args.limit}개")
        
        collect_financials(tickers)
        
    elif args.mode == "prices":
        # 캐시된 티커 목록 로드 시도
        tickers = get_cached_tickers()
        
        if not tickers:
            print("\n⚠️ 캐시된 티커 목록이 없습니다.")
            print("   먼저 --mode tickers를 실행해주세요.")
            return
        
        if args.limit:
            tickers = tickers[:args.limit]
            print(f"⚠️ 종목 수 제한: {args.limit}개")
        
        collect_prices(tickers)
        
    elif args.mode == "test":
        # 테스트 모드: 5개 종목만
        test_tickers = ["AAPL", "MSFT", "GOOGL", "NVDA", "META"]
        
        print("\n🧪 테스트 모드 (5개 종목)")
        print(f"   종목: {', '.join(test_tickers)}")
        
        # 재무제표 수집 테스트
        print("\n[1/2] 재무제표 수집 테스트...")
        collect_financials(test_tickers)
        
        # 현재가 수집 테스트
        print("\n[2/2] 현재가 수집 테스트...")
        collect_prices(test_tickers)
    
    print("\n" + "=" * 60)
    print("✅ 수집 완료!")
    print(f"📅 종료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
