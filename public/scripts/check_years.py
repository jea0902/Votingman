"""연도별 데이터 유효성 확인 스크립트 - 여러 종목 확인"""
from yf_evaluate import read_from_storage

# 여러 종목 확인
tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ']

for ticker in tickers:
    data = read_from_storage(f'financials/2026/{ticker}/data.json')
    if not data:
        print(f'{ticker}: No data')
        continue
    
    financials = data.get('financials', {})
    balance_sheet = data.get('balance_sheet', {})
    
    print(f'\n=== {ticker} ===')
    years = sorted(financials.keys())
    
    for year in years:
        fin = financials.get(year, {})
        bal = balance_sheet.get(year, {})
        
        revenue = fin.get('Total Revenue', 0) or 0
        net_income = fin.get('Net Income', 0) or 0
        equity = bal.get('Stockholders Equity', 0) or 0
        
        valid = "OK" if (net_income != 0 and equity != 0 and revenue != 0) else "SKIP"
        print(f'  {year}: {valid}')
