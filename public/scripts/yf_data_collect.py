"""
yfinance 데이터 수집 스크립트

목적: yfinance API로 데이터를 수집하여 Supabase Storage에 저장
- 티커 목록 (GitHub: S&P 500, 나스닥 100)
- 재무제표 (yfinance)
- 현재가 (yfinance)

실행 예시:
  python yf_data_collect.py --mode tickers     # 티커 목록 수집 (월별)
  python yf_data_collect.py --mode financials  # 재무제표 수집 (연별)
  python yf_data_collect.py --mode prices      # 현재가 수집 (일별)
  python yf_data_collect.py --mode test        # 테스트 (5종목)
"""

import os
import sys
import json
import argparse
from datetime import datetime
from typing import List, Dict, Any, Optional

import yfinance as yf
from curl_cffi.requests import Session
import pandas as pd
from tqdm import tqdm
from dotenv import load_dotenv
from supabase import create_client, Client
import warnings

warnings.filterwarnings("ignore")

# 환경 변수 로드 (.env.local 지원, 프로젝트 루트에서 찾기)
from pathlib import Path

# 스크립트 위치 기준으로 프로젝트 루트 찾기
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent.parent  # public/scripts -> public -> project root

# .env.local 먼저 시도, 없으면 .env
env_local = project_root / ".env.local"
env_file = project_root / ".env"

if env_local.exists():
    load_dotenv(env_local)
elif env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv()  # 기본 동작

# ============================================================================
# 설정
# ============================================================================

BUCKET_NAME = "yf-raw-data"  # yfinance 전용 버킷

# SSL 인증서 에러 우회용 세션 생성
session = Session(impersonate="chrome")
session.verify = False


# ============================================================================
# 환경 변수 및 Supabase 클라이언트
# ============================================================================

def validate_env():
    """환경 변수 검증"""
    # SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 둘 다 지원
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
# Storage 저장 함수
# ============================================================================

def save_to_storage(file_path: str, data: Any) -> bool:
    """
    Supabase Storage에 JSON 데이터 저장
    
    Args:
        file_path: 저장 경로 (예: "prices/2026-01-30/AAPL.json")
        data: 저장할 데이터
    
    Returns:
        성공 여부
    """
    try:
        supabase = get_supabase_client()
        json_data = json.dumps(data, ensure_ascii=False, indent=2, default=str)
        
        # 기존 파일 삭제 시도 (덮어쓰기용)
        try:
            supabase.storage.from_(BUCKET_NAME).remove([file_path])
        except:
            pass
        
        # 새 파일 업로드
        result = supabase.storage.from_(BUCKET_NAME).upload(
            file_path,
            json_data.encode('utf-8'),
            {"content-type": "application/json"}
        )
        
        return True
    except Exception as e:
        print(f"⚠️ Storage 저장 실패 ({file_path}): {e}")
        return False


# ============================================================================
# 티커 수집 함수
# ============================================================================

def get_sp500_tickers() -> List[str]:
    """GitHub에서 S&P 500 티커 리스트 가져오기"""
    try:
        print("🔍 S&P 500 티커 리스트 가져오는 중...")
        url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
        df = pd.read_csv(url)
        tickers = df["Symbol"].tolist()
        tickers = [str(t).strip().replace(".", "-") for t in tickers if pd.notna(t)]
        print(f"✅ S&P 500: {len(tickers)}개 종목")
        return tickers
    except Exception as e:
        print(f"❌ S&P 500 가져오기 실패: {e}")
        return []


def get_nasdaq100_tickers() -> List[str]:
    """GitHub에서 나스닥 100 티커 리스트 가져오기"""
    try:
        print("🔍 나스닥 100 티커 리스트 가져오는 중...")
        url = "https://raw.githubusercontent.com/Gary-Strauss/NASDAQ100_Constituents/master/data/nasdaq100_constituents.csv"
        df = pd.read_csv(url)
        tickers = df["Ticker"].tolist()
        tickers = [str(t).strip().replace(".", "-") for t in tickers if pd.notna(t)]
        print(f"✅ 나스닥 100: {len(tickers)}개 종목")
        return tickers
    except Exception as e:
        print(f"❌ 나스닥 100 가져오기 실패: {e}")
        return []


def collect_tickers() -> Dict[str, Any]:
    """티커 목록 수집 및 저장"""
    sp500 = get_sp500_tickers()
    nasdaq100 = get_nasdaq100_tickers()
    
    # 중복 제거
    all_tickers = list(set(sp500 + nasdaq100))
    all_tickers.sort()
    
    result = {
        "collected_at": datetime.now().isoformat(),
        "sp500_count": len(sp500),
        "nasdaq100_count": len(nasdaq100),
        "total_unique": len(all_tickers),
        "sp500": sp500,
        "nasdaq100": nasdaq100,
        "all": all_tickers
    }
    
    # Storage에 저장
    year_month = datetime.now().strftime("%Y-%m")
    file_path = f"tickers/{year_month}/all.json"
    
    if save_to_storage(file_path, result):
        print(f"✅ 티커 목록 저장 완료: {file_path}")
        print(f"   총 {len(all_tickers)}개 (중복 제거)")
    
    return result


# ============================================================================
# 재무제표 수집 함수
# ============================================================================

def collect_financials_for_ticker(ticker: str, year: str) -> Optional[Dict]:
    """
    단일 종목 재무제표 수집
    
    Returns:
        재무제표 데이터 또는 None
    """
    try:
        stock = yf.Ticker(ticker, session=session)
        
        financials = stock.financials
        balance_sheet = stock.balance_sheet
        cashflow = stock.cashflow
        info = stock.info
        
        if financials.empty or balance_sheet.empty or cashflow.empty:
            return None
        
        # DataFrame을 dict로 변환 (JSON 직렬화 가능하게)
        def df_to_dict(df):
            result = {}
            for col in df.columns:
                year_str = str(col.year) if hasattr(col, 'year') else str(col)
                result[year_str] = {}
                for idx in df.index:
                    val = df.loc[idx, col]
                    result[year_str][idx] = float(val) if pd.notna(val) else None
            return result
        
        data = {
            "ticker": ticker,
            "collected_at": datetime.now().isoformat(),
            "company_name": info.get("shortName", info.get("longName", ticker)),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
            "financials": df_to_dict(financials),
            "balance_sheet": df_to_dict(balance_sheet),
            "cashflow": df_to_dict(cashflow),
            "years_available": len(financials.columns)
        }
        
        return data
    except Exception as e:
        return None


def collect_financials(tickers: List[str], year: str):
    """재무제표 일괄 수집 및 저장"""
    print(f"\n📊 재무제표 수집 시작 ({len(tickers)}개 종목)")
    
    success = 0
    failed = 0
    
    for ticker in tqdm(tickers, desc="재무제표 수집", ncols=80, ascii=True, leave=True):
        data = collect_financials_for_ticker(ticker, year)
        
        if data:
            file_path = f"financials/{year}/{ticker}/data.json"
            if save_to_storage(file_path, data):
                success += 1
            else:
                failed += 1
        else:
            failed += 1
    
    print(f"\n✅ 재무제표 수집 완료: 성공 {success}개, 실패 {failed}개")
    return success, failed


# ============================================================================
# 현재가 수집 함수
# ============================================================================

def collect_price_for_ticker(ticker: str) -> Optional[Dict]:
    """단일 종목 현재가 수집"""
    try:
        stock = yf.Ticker(ticker, session=session)
        info = stock.info
        
        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
        if not current_price:
            return None
        
        data = {
            "ticker": ticker,
            "collected_at": datetime.now().isoformat(),
            "company_name": info.get("shortName", info.get("longName", ticker)),
            "current_price": current_price,
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("forwardPE") or info.get("trailingPE"),
            "exchange": info.get("exchange", "Unknown"),
            "currency": info.get("currency", "USD")
        }
        
        return data
    except Exception as e:
        return None


def collect_prices(tickers: List[str], date: str):
    """현재가 일괄 수집 및 저장"""
    print(f"\n💰 현재가 수집 시작 ({len(tickers)}개 종목)")
    
    success = 0
    failed = 0
    
    for ticker in tqdm(tickers, desc="현재가 수집", ncols=80, ascii=True, leave=True):
        data = collect_price_for_ticker(ticker)
        
        if data:
            file_path = f"prices/{date}/{ticker}.json"
            if save_to_storage(file_path, data):
                success += 1
            else:
                failed += 1
        else:
            failed += 1
    
    print(f"\n✅ 현재가 수집 완료: 성공 {success}개, 실패 {failed}개")
    return success, failed


# ============================================================================
# 티커 목록 로드
# ============================================================================

def load_tickers_from_storage() -> List[str]:
    """Storage에서 가장 최근 티커 목록 로드"""
    try:
        supabase = get_supabase_client()
        
        # tickers 폴더의 월별 폴더 목록
        result = supabase.storage.from_(BUCKET_NAME).list("tickers")
        if not result:
            return []
        
        # 가장 최근 월 찾기
        months = [item["name"] for item in result if item.get("id") is None]
        if not months:
            return []
        
        months.sort(reverse=True)
        latest_month = months[0]
        
        # all.json 읽기
        file_path = f"tickers/{latest_month}/all.json"
        data = supabase.storage.from_(BUCKET_NAME).download(file_path)
        ticker_data = json.loads(data.decode('utf-8'))
        
        return ticker_data.get("all", [])
    except Exception as e:
        print(f"⚠️ 티커 목록 로드 실패: {e}")
        return []


# ============================================================================
# 메인 실행
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="yfinance 데이터 수집 스크립트",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
실행 예시:
  python yf_data_collect.py --mode tickers     # 티커 목록 (월별)
  python yf_data_collect.py --mode financials  # 재무제표 (연별)
  python yf_data_collect.py --mode prices      # 현재가 (일별)
  python yf_data_collect.py --mode test        # 테스트
        """
    )
    
    parser.add_argument(
        "--mode",
        type=str,
        default="test",
        choices=["tickers", "financials", "prices", "test", "full"],
        help="실행 모드"
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
        default=datetime.now().strftime("%Y"),
        help="재무제표 데이터 연도 (YYYY)"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 70)
    print("📊 yfinance 데이터 수집 스크립트")
    print("=" * 70)
    print(f"📅 실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔧 모드: {args.mode}")
    print(f"📁 버킷: {BUCKET_NAME}")
    print("=" * 70)
    
    # 환경 변수 검증
    validate_env()
    
    if args.mode == "tickers":
        # 티커 목록 수집
        collect_tickers()
        
    elif args.mode == "financials":
        # 재무제표 수집
        tickers = load_tickers_from_storage()
        if not tickers:
            print("❌ 티커 목록이 없습니다. 먼저 --mode tickers를 실행하세요.")
            return
        collect_financials(tickers, args.year)
        
    elif args.mode == "prices":
        # 현재가 수집
        tickers = load_tickers_from_storage()
        if not tickers:
            print("❌ 티커 목록이 없습니다. 먼저 --mode tickers를 실행하세요.")
            return
        collect_prices(tickers, args.date)
        
    elif args.mode == "test":
        # 테스트 모드 (5종목)
        test_tickers = ["AAPL", "MSFT", "GOOGL", "NVDA", "META"]
        print(f"\n🧪 테스트 모드: {test_tickers}")
        
        # 티커 저장
        test_data = {
            "collected_at": datetime.now().isoformat(),
            "sp500_count": 0,
            "nasdaq100_count": 5,
            "total_unique": 5,
            "sp500": [],
            "nasdaq100": test_tickers,
            "all": test_tickers
        }
        year_month = datetime.now().strftime("%Y-%m")
        save_to_storage(f"tickers/{year_month}/all.json", test_data)
        
        # 재무제표 수집
        collect_financials(test_tickers, args.year)
        
        # 현재가 수집
        collect_prices(test_tickers, args.date)
        
    elif args.mode == "full":
        # 전체 실행 (티커 + 재무제표 + 현재가)
        print("\n🚀 전체 데이터 수집 시작...")
        
        # 1. 티커 수집
        ticker_data = collect_tickers()
        tickers = ticker_data.get("all", [])
        
        if not tickers:
            print("❌ 티커 목록 수집 실패")
            return
        
        # 2. 재무제표 수집
        collect_financials(tickers, args.year)
        
        # 3. 현재가 수집
        collect_prices(tickers, args.date)
    
    print("\n" + "=" * 70)
    print("✅ 데이터 수집 완료!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
