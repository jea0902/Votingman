"""
buffett_result.py
역할: 배치 평가 + 요약 출력 + CSV 저장
"""

from datetime import datetime
from tqdm import tqdm
import pandas as pd

from stock_collect import (
    get_sp500_tickers,
    get_nasdaq100_tickers,
    fetch_raw_stock_data
)
from buffett_calculate import evaluate_stock_from_raw


def batch_evaluate(tickers):
    results = []
    failed = []

    for ticker in tqdm(tickers, desc="평가 진행", ncols=80):
        raw = fetch_raw_stock_data(ticker)
        if not raw:
            failed.append(ticker)
            continue

        result = evaluate_stock_from_raw(ticker, raw)
        if result:
            results.append(result)
        else:
            failed.append(ticker)

    df = pd.DataFrame(results)
    if not df.empty:
        df = df.sort_values("total_score", ascending=False)

    return df, failed


def save_to_csv(df, filename=None):
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"buffett_evaluation_{timestamp}.csv"

    df.to_csv(filename, index=False, encoding="utf-8-sig")
    return filename


def print_summary(df):
    if df.empty:
        print("\n❌ 평가 결과가 없습니다.")
        return

    print("\n📊 종목별 요약")
    print(f"\n{'순위':<4} {'티커':<8} {'총점':<6} {'등급':<6} {'현재가':<10} {'적정가':<10} {'GAP':<8} {'추천':<6}")
    print("-" * 100)

    for idx, row in df.iterrows():
        rank = idx + 1 if isinstance(idx, int) else list(df.index).index(idx) + 1
        print(
            f"{rank:<4} {row['ticker']:<8} {row['total_score']:<6.0f} {row['pass']:<6} "
            f"${row['current_price']:<9.2f} ${row['intrinsic_value']:<9.2f} "
            f"{row['gap_pct']:>6.1f}% {row['recommendation']:<6}"
        )

    pass_count = len(df[df["pass"] == "PASS"])
    buy_count = len(df[df["recommendation"] == "BUY"])

    print(f"\n🏆 우량주 통과: {pass_count}/{len(df)}개")
    print(f"💰 매수 추천: {buy_count}/{len(df)}개")


def main():
    print("\n평가 모드를 선택하세요:")
    print("1. 테스트 모드 (5개 종목)")
    print("2. 나스닥 100 평가")
    print("3. S&P 500 평가")
    print("4. 나스닥 100 + S&P 500 통합 평가")

    choice = input("\n👉 선택 (1/2/3/4): ").strip()

    if choice == "1":
        tickers = ["AAPL", "MSFT", "GOOGL", "NVDA", "META"]
    elif choice == "2":
        tickers = get_nasdaq100_tickers()
    elif choice == "3":
        tickers = get_sp500_tickers()
    elif choice == "4":
        nasdaq = get_nasdaq100_tickers()
        sp500 = get_sp500_tickers()
        tickers = list(set(nasdaq + sp500))
    else:
        print("잘못된 선택입니다.")
        return

    df, failed = batch_evaluate(tickers)

    print_summary(df)

    if not df.empty:
        filename = save_to_csv(df)
        print(f"\n✅ 결과 저장 완료: {filename}")

    if failed:
        print(f"\n⚠️ 평가 실패 종목 수: {len(failed)}")


if __name__ == "__main__":
    main()