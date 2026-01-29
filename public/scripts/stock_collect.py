"""
stock_collect.py
역할: 티커 유니버스 수집 + 원본 데이터 수집

- S&P 500 / NASDAQ100 티커 리스트 수집
- yfinance로 재무/현금흐름/재무상태표 수집
"""

import warnings
import pandas as pd
import requests
import yfinance as yf
from curl_cffi.requests import Session

warnings.filterwarnings("ignore")

# SSL 인증서 에러 우회 세션
session = Session(impersonate="chrome")
session.verify = False


def get_sp500_tickers():
    """S&P 500 티커 리스트 수집 (GitHub 데이터셋 사용)"""
    try:
        url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
        df = pd.read_csv(url)
        tickers = df["Symbol"].tolist()
        tickers = [str(t).strip().replace(".", "-") for t in tickers if pd.notna(t)]
        return tickers
    except Exception:
        return None


def get_nasdaq100_tickers():
    """Wikipedia에서 NASDAQ100 티커 리스트 수집"""
    try:
        url = "https://en.wikipedia.org/wiki/Nasdaq-100"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
        tables = pd.read_html(requests.get(url, headers=headers).content)
        nasdaq100_df = None
        for table in tables:
            if "Ticker" in table.columns or "Symbol" in table.columns:
                nasdaq100_df = table
                break

        if nasdaq100_df is None:
            return get_nasdaq100_fallback()

        ticker_column = "Ticker" if "Ticker" in nasdaq100_df.columns else "Symbol"
        tickers = nasdaq100_df[ticker_column].tolist()
        tickers = [str(t).strip() for t in tickers if pd.notna(t)]
        return tickers

    except Exception:
        return get_nasdaq100_fallback()


def get_nasdaq100_fallback():
    """나스닥 100 백업 리스트"""
    return [
        "AAPL","MSFT","GOOGL","GOOG","AMZN","NVDA","META","TSLA",
        "AVGO","COST","NFLX","ADBE","CSCO","PEP","AMD","INTC","TMUS",
        "INTU","QCOM","TXN","AMGN","HON","AMAT","SBUX","ADP","GILD",
        "ISRG","BKNG","ADI","VRTX","REGN","PANW","MU","LRCX","MDLZ",
        "PYPL","SNPS","KLAC","CDNS","MRVL","ASML","NXPI","ABNB","MELI",
        "WDAY","FTNT","DASH","TEAM","DXCM","CHTR","MNST","ADSK","CPRT",
        "AEP","ORLY","ROST","PCAR","PAYX","ODFL","FAST","EA","KDP","VRSK",
        "XEL","CTSH","DDOG","EXC","CTAS","GEHC","IDXX","LULU","CCEP",
        "KHC","ZS","BIIB","TTWO","ANSS","ON","CDW","CRWD","GFS","WBD",
        "ILMN","MDB","MRNA","WBA","DLTR","SIRI","FANG","CEG","SMCI",
        "TTD","ARM","ROP","CSGP","AZN","MCHP","PDD","MAR","CSX",
    ]


def fetch_raw_stock_data(ticker: str):
    """
    yfinance에서 원본 데이터 수집
    반환값:
      {
        "financials": DataFrame,
        "balance_sheet": DataFrame,
        "cashflow": DataFrame,
        "info": dict
      }
    """
    try:
        stock = yf.Ticker(ticker, session=session)
        financials = stock.financials
        balance_sheet = stock.balance_sheet
        cashflow = stock.cashflow
        info = stock.info

        # 데이터 유효성 체크
        if financials.empty or balance_sheet.empty or cashflow.empty:
            return None

        return {
            "financials": financials,
            "balance_sheet": balance_sheet,
            "cashflow": cashflow,
            "info": info,
        }
    except Exception:
        return None