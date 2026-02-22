"""
S&P500 + NASDAQ100 종목 한글명 자동 수집 스크립트

설계 의도:
- Wikipedia 한국어판에서 기업 한글명 자동 수집
- Wikipedia API를 사용하여 티커 → 한글명 매핑
- 결과를 JSON과 TypeScript 파일로 저장
- BuffettCard 컴포넌트에서 사용할 한글명 데이터 생성

사용법:
  python fetch_korean_names.py
"""

import json
import time
import requests
import pandas as pd
from pathlib import Path
from typing import Optional

# ============================================================
# 설정
# ============================================================
WIKIPEDIA_API = "https://ko.wikipedia.org/w/api.php"
HEADERS = {
    "User-Agent": "BitcosKoreanNameFetcher/1.0 (https://bitcos.io; contact@bitcos.io)"
}

# 이미 알려진 한글명 (Wikipedia에서 찾기 어려운 경우 수동 매핑)
KNOWN_KOREAN_NAMES = {
    # 빅테크
    "AAPL": "애플",
    "MSFT": "마이크로소프트",
    "GOOGL": "알파벳",
    "GOOG": "알파벳",
    "AMZN": "아마존",
    "META": "메타",
    "NVDA": "엔비디아",
    "TSLA": "테슬라",
    # 반도체
    "AMD": "AMD",
    "INTC": "인텔",
    "AVGO": "브로드컴",
    "QCOM": "퀄컴",
    "TXN": "텍사스인스트루먼트",
    "MU": "마이크론",
    "ASML": "ASML",
    "ARM": "ARM",
    # 금융
    "JPM": "JP모건",
    "BAC": "뱅크오브아메리카",
    "WFC": "웰스파고",
    "C": "시티그룹",
    "GS": "골드만삭스",
    "MS": "모건스탠리",
    "V": "비자",
    "MA": "마스터카드",
    "AXP": "아메리칸익스프레스",
    "BRK-B": "버크셔해서웨이",
    # 소비재
    "KO": "코카콜라",
    "PEP": "펩시코",
    "PG": "P&G",
    "WMT": "월마트",
    "COST": "코스트코",
    "MCD": "맥도날드",
    "NKE": "나이키",
    "SBUX": "스타벅스",
    "HD": "홈디포",
    # 헬스케어
    "JNJ": "존슨앤존슨",
    "UNH": "유나이티드헬스",
    "PFE": "화이자",
    "MRK": "머크",
    "ABBV": "애브비",
    "LLY": "일라이릴리",
    # 통신/미디어
    "VZ": "버라이즌",
    "T": "AT&T",
    "NFLX": "넷플릭스",
    "DIS": "디즈니",
    # 에너지
    "XOM": "엑슨모빌",
    "CVX": "셰브론",
    # 산업재
    "BA": "보잉",
    "CAT": "캐터필러",
    "GE": "GE에어로스페이스",
    "HON": "하니웰",
    "UPS": "UPS",
}


def get_sp500_tickers() -> list[str]:
    """
    S&P 500 티커 및 회사명 리스트 가져오기
    
    Returns:
        list: [(ticker, company_name), ...]
    """
    try:
        print("\n🔍 S&P 500 티커 리스트 가져오는 중...")
        url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
        df = pd.read_csv(url)
        
        # (ticker, company_name) 튜플 리스트
        tickers = []
        for _, row in df.iterrows():
            ticker = str(row["Symbol"]).strip().replace(".", "-")
            name = str(row["Name"]).strip() if "Name" in df.columns else ""
            tickers.append((ticker, name))
        
        print(f"✅ S&P 500: {len(tickers)}개 종목")
        return tickers
    except Exception as e:
        print(f"❌ S&P 500 가져오기 실패: {e}")
        return []


def get_nasdaq100_tickers() -> list[str]:
    """
    NASDAQ 100 티커 및 회사명 리스트 가져오기
    
    Returns:
        list: [(ticker, company_name), ...]
    """
    try:
        print("\n🔍 NASDAQ 100 티커 리스트 가져오는 중...")
        url = "https://en.wikipedia.org/wiki/Nasdaq-100"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        
        tables = pd.read_html(requests.get(url, headers=headers).content)
        
        nasdaq100_df = None
        for table in tables:
            if "Ticker" in table.columns or "Symbol" in table.columns:
                nasdaq100_df = table
                break
        
        if nasdaq100_df is None:
            print("❌ NASDAQ 100 테이블을 찾을 수 없습니다")
            return []
        
        ticker_col = "Ticker" if "Ticker" in nasdaq100_df.columns else "Symbol"
        name_col = "Company" if "Company" in nasdaq100_df.columns else None
        
        tickers = []
        for _, row in nasdaq100_df.iterrows():
            ticker = str(row[ticker_col]).strip()
            name = str(row[name_col]).strip() if name_col else ""
            tickers.append((ticker, name))
        
        print(f"✅ NASDAQ 100: {len(tickers)}개 종목")
        return tickers
    except Exception as e:
        print(f"❌ NASDAQ 100 가져오기 실패: {e}")
        return []


def search_korean_wikipedia(company_name: str, ticker: str) -> Optional[str]:
    """
    Wikipedia 한국어판에서 회사 한글명 검색
    
    Args:
        company_name: 영문 회사명
        ticker: 티커 심볼
    
    Returns:
        한글 회사명 또는 None
    """
    # 1. 이미 알려진 한글명이 있으면 반환
    if ticker in KNOWN_KOREAN_NAMES:
        return KNOWN_KOREAN_NAMES[ticker]
    
    # 2. Wikipedia API로 검색
    search_terms = [
        company_name,
        f"{company_name} 기업",
        ticker,
    ]
    
    for search_term in search_terms:
        try:
            # Wikipedia 검색 API
            params = {
                "action": "query",
                "list": "search",
                "srsearch": search_term,
                "format": "json",
                "srlimit": 3,
            }
            
            response = requests.get(WIKIPEDIA_API, params=params, headers=HEADERS, timeout=10)
            data = response.json()
            
            if "query" in data and data["query"]["search"]:
                # 첫 번째 검색 결과의 제목 반환
                title = data["query"]["search"][0]["title"]
                
                # 회사명 관련 결과인지 확인 (기업, 회사, Inc, Corp 등)
                if any(keyword in title for keyword in ["기업", "회사", company_name.split()[0]]):
                    return title
            
            time.sleep(0.3)  # API 요청 간격
            
        except Exception:
            continue
    
    return None


def extract_korean_name(wiki_title: str, company_name: str) -> str:
    """
    Wikipedia 제목에서 순수 한글명 추출
    
    Args:
        wiki_title: Wikipedia 문서 제목
        company_name: 영문 회사명 (비교용)
    
    Returns:
        정제된 한글명
    """
    # "(기업)", "(회사)" 등 제거
    import re
    clean_name = re.sub(r'\s*\([^)]*\)', '', wiki_title).strip()
    
    # 너무 길면 첫 단어만
    if len(clean_name) > 15:
        clean_name = clean_name.split()[0]
    
    return clean_name


def fetch_all_korean_names() -> dict[str, str]:
    """
    모든 S&P500 + NASDAQ100 종목의 한글명 수집
    
    Returns:
        dict: {ticker: korean_name}
    """
    print("\n" + "=" * 80)
    print("🚀 미국 주식 한글명 수집 시작")
    print("=" * 80)
    
    # 티커 수집
    sp500 = get_sp500_tickers()
    nasdaq100 = get_nasdaq100_tickers()
    
    # 중복 제거
    all_stocks = {}
    for ticker, name in sp500 + nasdaq100:
        if ticker not in all_stocks:
            all_stocks[ticker] = name
    
    print(f"\n📊 총 {len(all_stocks)}개 종목 처리 예정")
    
    # 한글명 수집
    korean_names = {}
    success_count = 0
    
    for i, (ticker, company_name) in enumerate(all_stocks.items()):
        print(f"\r⏳ 진행 중: {i+1}/{len(all_stocks)} ({ticker})...", end="", flush=True)
        
        korean_name = search_korean_wikipedia(company_name, ticker)
        
        if korean_name:
            clean_name = extract_korean_name(korean_name, company_name)
            korean_names[ticker] = clean_name
            success_count += 1
        
        # API 요청 간격 (Wikipedia 정책 준수)
        time.sleep(0.5)
    
    print(f"\n\n✅ 한글명 수집 완료: {success_count}/{len(all_stocks)}개 성공")
    
    return korean_names


def save_results(korean_names: dict[str, str]):
    """
    결과를 JSON과 TypeScript 파일로 저장
    
    Args:
        korean_names: {ticker: korean_name}
    """
    output_dir = Path(__file__).parent.parent.parent / "src" / "lib" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. JSON 파일
    json_path = output_dir / "korean-stock-names.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(korean_names, f, ensure_ascii=False, indent=2)
    print(f"\n💾 JSON 저장: {json_path}")
    
    # 2. TypeScript 파일
    ts_path = output_dir / "korean-stock-names.ts"
    ts_content = '''/**
 * S&P500 + NASDAQ100 종목 한글명 매핑
 * 
 * 생성: fetch_korean_names.py 스크립트
 * 업데이트: 필요시 스크립트 재실행
 */

export const KOREAN_STOCK_NAMES: Record<string, string> = {
'''
    
    # 알파벳 순 정렬
    for ticker in sorted(korean_names.keys()):
        name = korean_names[ticker]
        ts_content += f'  "{ticker}": "{name}",\n'
    
    ts_content += "};\n"
    
    with open(ts_path, "w", encoding="utf-8") as f:
        f.write(ts_content)
    print(f"💾 TypeScript 저장: {ts_path}")


def main():
    """메인 실행"""
    korean_names = fetch_all_korean_names()
    
    if korean_names:
        save_results(korean_names)
        
        print("\n" + "=" * 80)
        print("✅ 완료!")
        print("=" * 80)
        print("\n다음 단계:")
        print("1. src/lib/data/korean-stock-names.ts 파일 확인")
        print("2. BuffettCard.tsx에서 import해서 사용")
        print('   import { KOREAN_STOCK_NAMES } from "@/lib/data/korean-stock-names";')
    else:
        print("\n❌ 한글명 수집 실패")


if __name__ == "__main__":
    main()
