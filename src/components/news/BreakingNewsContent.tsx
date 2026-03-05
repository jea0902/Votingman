"use client";

/**
 * 속보 컨텐츠 - 코인니스 스타일 디자인
 */

import { useState, useEffect } from "react";
import { Clock, TrendingUp, Zap, Filter, RefreshCw, ChevronDown, ExternalLink, Eye, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

// 임시 뉴스 데이터 타입
interface NewsItem {
  id: string;
  title: string;
  summary: string;
  fullContent?: string; // 펼쳐진 전체 내용
  category: "경제" | "정치" | "사회" | "온체인" | "SNS" | "매크로";
  isHighlighted: boolean; // 관리자가 설정한 중요 뉴스 (주황색 제목)
  time: string; // 한국시간 (HH:MM 형식)
  date: string; // 날짜 (YYYY-MM-DD 형식)
  source: string;
  sourceUrl?: string; // 원문 링크
  imageUrl?: string;
}

// 임시 목업 데이터
const MOCK_NEWS: NewsItem[] = [
  // 오늘 뉴스
  {
    id: "1",
    title: "비트코인 65,000달러 돌파, 연말 10만 달러 전망",
    summary: "기관 투자자들의 대량 매수세가 이어지면서 비트코인이 강세를 보이고 있습니다. 전문가들은 연말까지 10만 달러 돌파 가능성을 제시하고 있습니다.",
    fullContent: "비트코인이 65,000달러를 돌파하며 새로운 역사를 쓰고 있습니다. 블랙록, 피델리티 등 주요 자산운용사들의 현물 ETF 승인 이후 기관 자금이 대거 유입되고 있으며, 마이크로스트레티지를 비롯한 기업들의 비트코인 매수도 이어지고 있습니다. 특히 할빙 이후 공급량 감소와 함께 수요 증가가 겹치면서 완벽한 상승 모멘텀을 형성하고 있다고 전문가들은 분석합니다. JP모간의 분석에 따르면 현재 추세가 지속될 경우 연말까지 10만 달러 돌파도 충분히 가능하다고 전망했습니다.",
    category: "온체인",
    isHighlighted: true,
    time: "14:32",
    date: "2026-03-01",
    source: "코인데스크",
    sourceUrl: "https://coindesk.com",
  },
  {
    id: "2",
    title: "연준 기준금리 동결 결정, 글로벌 경제에 미치는 영향",
    summary: "연방준비제도가 기준금리를 현 수준으로 유지하기로 결정했습니다. 인플레이션 둔화 신호에도 불구하고 신중한 접근을 택했습니다.",
    fullContent: "제롬 파월 연준 의장은 FOMC 회의 후 기자회견에서 '인플레이션이 2% 목표치에 안정적으로 수렴하는 것을 확인할 때까지 신중하게 접근하겠다'고 밝혔습니다. 최근 고용시장의 견조함과 소비 회복세가 지속되고 있어 성급한 금리 인하보다는 현 수준을 유지하는 것이 적절하다고 판단했습니다. 이번 결정으로 글로벌 증시는 혼재된 반응을 보이고 있으며, 신흥국 통화에는 상대적으로 부정적 영향을 미칠 것으로 예상됩니다.",
    category: "매크로",
    isHighlighted: true,
    time: "14:27",
    date: "2026-03-01",
    source: "로이터",
    sourceUrl: "https://reuters.com",
  },
  {
    id: "3",
    title: "미국 CPI 2.1% 상승, 연준 금리 결정에 영향 전망",
    summary: "미국 12월 소비자물가지수가 연간 2.1% 상승하며 연준의 2% 목표치를 소폭 상회했습니다. 시장에서는 추가 금리인하 가능성을 점쳤습니다.",
    fullContent: "미국 노동부가 발표한 12월 소비자물가지수(CPI)는 전년 동월 대비 2.1% 상승을 기록했습니다. 이는 시장 예상치인 2.0%를 소폭 상회한 수치입니다. 특히 핵심 CPI는 1.9%로 목표치를 하회하면서 연준의 금리 정책에 미묘한 변화를 예고하고 있습니다. 에너지와 식료품을 제외한 핵심 인플레이션의 둔화세가 뚜렷해지면서 시장에서는 다음 FOMC 회의에서 추가 금리인하 가능성을 높게 점치고 있습니다.",
    category: "매크로",
    isHighlighted: true,
    time: "14:17",
    date: "2026-03-01",
    source: "미국 노동부",
    sourceUrl: "https://bls.gov",
  },
  {
    id: "4",
    title: "일론 머스크, X에서 도지코인 급등 예측 발언",
    summary: "일론 머스크가 X(트위터)를 통해 도지코인의 미래 가치에 대한 긍정적인 전망을 밝혔습니다. 해당 트윗 이후 도지코인 가격이 15% 급등했습니다.",
    fullContent: "일론 머스크가 오늘 오전 자신의 X 계정에 '도지코인이 화성에서 사용될 최초의 화폐가 될 것'이라는 내용의 트윗을 게시했습니다. 이 발언 이후 도지코인 가격이 15분 만에 15% 상승하며 $0.12를 기록했습니다. 암호화폐 커뮤니티에서는 머스크의 스페이스X 화성 식민지 계획과 연관된 발언으로 해석하고 있습니다. 한편 테슬라의 결제 시스템에 도지코인 통합 가능성에 대한 추측도 나오고 있습니다.",
    category: "SNS",
    isHighlighted: true,
    time: "14:02",
    date: "2026-03-01",
    source: "X (@elonmusk)",
    sourceUrl: "https://x.com/elonmusk",
  },

  // 어제 뉴스 (2026-02-28)
  {
    id: "5",
    title: "유럽중앙은행 기준금리 0.25%p 인하, 3.75%→3.5%",
    summary: "유럽중앙은행(ECB)이 기준금리를 0.25%포인트 인하하여 3.5%로 조정했습니다. 유로존 경기 둔화에 대응한 조치로 해석됩니다.",
    fullContent: "크리스틴 라가르드 ECB 총재는 기자회견에서 '유로존 경제의 성장 둔화와 인플레이션 압력 완화를 고려한 결정'이라고 설명했습니다. 특히 독일과 프랑스의 제조업 PMI 지속 하락과 소비 부진이 주요 고려 요인이었다고 밝혔습니다. 이번 금리 인하로 유럽 주요 증시는 일제히 상승했으며, 유로/달러 환율은 1.08 수준까지 하락했습니다.",
    category: "매크로",
    isHighlighted: false,
    time: "21:30",
    date: "2026-02-28",
    source: "ECB",
    sourceUrl: "https://ecb.europa.eu",
  },
  {
    id: "6",
    title: "미국 비농업 고용 증가 18만명, 예상치 하회",
    summary: "미국 12월 비농업 부문 신규 고용이 18만명 증가에 그쳤습니다. 시장 예상치인 22만명을 크게 하회한 수치입니다.",
    fullContent: "미국 노동부 발표에 따르면 12월 비농업 고용은 18만명 증가했지만 시장 예상치를 4만명 하회했습니다. 실업률은 3.7%로 전월과 동일했습니다. 업종별로는 서비스업이 14만명 증가한 반면 제조업은 2만명 감소했습니다. 평균 시간당 임금은 전월 대비 0.2% 상승에 그쳐 임금 인플레이션 압력이 완화되는 모습을 보였습니다. 이로 인해 연준의 추가 금리인하 가능성이 높아졌다는 분석이 나오고 있습니다.",
    category: "매크로",
    isHighlighted: false,
    time: "22:30",
    date: "2026-02-28",
    source: "미국 노동부",
    sourceUrl: "https://bls.gov",
  },
  {
    id: "7",
    title: "전국민 기본소득 도입 논의 본격화, 시범사업 추진",
    summary: "정부가 전국민 기본소득 도입에 대한 사회적 논의를 본격화한다고 발표했습니다. 내년부터 일부 지역에서 시범사업을 시작합니다.",
    fullContent: "기획재정부는 오늘 전국민 기본소득 도입 가능성에 대한 연구용역 결과를 발표했습니다. 월 50만원 수준의 기본소득 지급 시 연간 약 300조원의 재원이 필요하지만, 기존 복지제도 정비와 세제개편을 통해 단계적 도입이 가능하다고 분석했습니다. 경기도 성남시와 전북 전주시에서 내년부터 2년간 시범사업을 실시하며, 그 결과를 바탕으로 전국 확대 여부를 결정할 예정입니다.",
    category: "사회",
    isHighlighted: false,
    time: "18:45",
    date: "2026-02-28",
    source: "한겨레",
    sourceUrl: "https://hani.co.kr",
  },

  // 그저께 뉴스 (2026-02-27)
  {
    id: "8",
    title: "중국 제조업 PMI 49.8, 6개월 연속 위축세",
    summary: "중국 12월 제조업 PMI가 49.8을 기록하며 6개월 연속 기준선 50을 하회했습니다. 글로벌 경제에 대한 우려가 확산되고 있습니다.",
    fullContent: "중국 국가통계국이 발표한 12월 제조업 PMI는 49.8로 전월(49.4)보다 소폭 개선됐지만 여전히 경기 위축을 나타내는 50 기준선을 밑돌았습니다. 신규 주문과 생산이 동반 부진한 가운데 수출 주문은 더욱 악화됐습니다. 부동산 시장 침체와 소비 위축이 지속되면서 중국 정부의 추가 부양책 필요성이 대두되고 있습니다. 글로벌 공급망에서 중국이 차지하는 비중을 고려할 때 세계 경제에 미칠 파급효과에 대한 우려가 커지고 있습니다.",
    category: "매크로",
    isHighlighted: false,
    time: "10:00",
    date: "2026-02-27",
    source: "중국 국가통계국",
    sourceUrl: "https://stats.gov.cn",
  },
  {
    id: "9",
    title: "독일 IFO 기업경기지수 87.2, 4개월 만에 상승",
    summary: "독일의 대표적인 경기선행지수인 IFO 기업경기지수가 4개월 만에 상승 전환했습니다. 제조업 부문의 개선이 두드러졌습니다.",
    fullContent: "독일 IFO 연구소가 발표한 2월 기업경기지수는 87.2로 전월(85.8) 대비 1.4포인트 상승했습니다. 이는 시장 예상치(86.5)를 웃도는 수치로 독일 경제의 바닥 신호로 해석되고 있습니다. 특히 제조업 현황지수가 큰 폭으로 개선되면서 유럽 경제회복에 대한 기대감이 높아지고 있습니다. 다만 서비스업 부문은 여전히 부진한 모습을 보이고 있어 전반적인 경기 회복까지는 시간이 필요할 것으로 분석됩니다.",
    category: "매크로",
    isHighlighted: false,
    time: "16:30",
    date: "2026-02-27",
    source: "IFO 경제연구소",
    sourceUrl: "https://ifo.de",
  },
];

const CATEGORIES = ["전체", "경제", "정치", "사회", "온체인", "SNS", "매크로"] as const;

export function BreakingNewsContent() {
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [news, setNews] = useState<NewsItem[]>(MOCK_NEWS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(2); // 초기에 2개 안 읽은 뉴스
  const [showUnreadBanner, setShowUnreadBanner] = useState(true); // 초기에 배너 표시

  // 카테고리 필터링된 뉴스
  const filteredNews = selectedCategory === "전체"
    ? news
    : news.filter(item => item.category === selectedCategory);

  // 날짜별로 뉴스 그룹핑
  const groupedNews = filteredNews.reduce((groups, item) => {
    const date = item.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {} as Record<string, NewsItem[]>);

  // 날짜를 최신순으로 정렬
  const sortedDates = Object.keys(groupedNews).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // 날짜 포맷팅 함수 (YYYY-MM-DD → YYYY년 MM월 DD일)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00.000Z');
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // 실제로는 API 호출
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 새로운 뉴스 시뮬레이션
    const newCount = Math.floor(Math.random() * 3) + 1;
    setUnreadCount(newCount);
    setShowUnreadBanner(newCount > 0);

    setIsRefreshing(false);
  };

  const handleUnreadClick = () => {
    // 실제로는 새 뉴스만 상단에 표시
    setShowUnreadBanner(false);
    setUnreadCount(0);
    // 페이지 상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "경제": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "정치": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "사회": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "온체인": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "SNS": return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400";
      case "매크로": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-red-500" />
              <h1 className="text-3xl font-bold text-foreground">실시간 속보</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              새로고침
            </button>
          </div>
          <p className="text-muted-foreground">실시간으로 업데이트되는 금융 시장의 주요 뉴스와 속보를 확인하세요.</p>
        </div>

        {/* 안 읽은 속보 배너 */}
        {showUnreadBanner && (
          <div className="mb-6">
            <button
              onClick={handleUnreadClick}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors animate-pulse"
            >
              <Bell className="h-5 w-5" />
              <span className="font-medium">안 읽은 속보 {unreadCount}개</span>
              <span className="text-sm opacity-80">클릭하여 확인</span>
            </button>
          </div>
        )}

        {/* 카테고리 필터 */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜별 뉴스 목록 */}
        <div className="space-y-8">
          {sortedDates.map((date) => (
            <div key={date} className="space-y-4">
              {/* 날짜 헤더 */}
              <div className="sticky top-16 z-10 bg-background/80 backdrop-blur-sm border-b border-border pb-2 mb-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <div className="w-1 h-6 bg-primary rounded-full"></div>
                  {formatDate(date)}
                </h2>
              </div>

              {/* 해당 날짜의 뉴스들 */}
              <div className="space-y-6">
                {groupedNews[date]
                  .sort((a, b) => b.time.localeCompare(a.time)) // 시간순 정렬 (최신순)
                  .map((item) => {
                    const isExpanded = expandedItems.has(item.id);
                    return (
                      <article
                        key={item.id}
                        className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
                      >
                        {/* 코인니스 스타일 레이아웃 */}
                        <div className="flex">
                              {/* 왼쪽 시간 표시 */}
                              <div className="flex-shrink-0 w-16 p-4 bg-muted/30 rounded-l-lg border-r border-border flex flex-col items-center justify-start">
                                <div className="text-sm font-bold text-foreground">{item.time}</div>
                              </div>

                          {/* 오른쪽 뉴스 내용 */}
                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full", getCategoryColor(item.category))}>
                                  {item.category}
                                </span>
                              </div>
                              <span className="text-sm text-muted-foreground">출처: {item.source}</span>
                            </div>

                            <h2 className={cn(
                              "text-xl font-semibold mb-3 leading-tight transition-colors cursor-pointer hover:underline",
                              item.isHighlighted
                                ? "text-orange-500 dark:text-orange-400"
                                : "text-foreground"
                            )}
                              onClick={() => toggleExpanded(item.id)}
                            >
                              {item.title}
                            </h2>

                            <p className="text-muted-foreground mb-4 leading-relaxed">
                              {item.summary}
                            </p>

                            {/* 펼쳐진 내용 */}
                            {isExpanded && item.fullContent && (
                              <div className="mb-4 p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
                                <p className="text-foreground leading-relaxed whitespace-pre-line">
                                  {item.fullContent}
                                </p>
                              </div>
                            )}

                            {/* 버튼들 */}
                            <div className="flex items-center gap-3 pt-2 border-t border-border">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(item.id);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
                              >
                                <Eye className="h-4 w-4" />
                                {isExpanded ? "접기" : "펼쳐보기"}
                              </button>

                              {item.sourceUrl && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.sourceUrl, '_blank');
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  원문 보기
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* 더 보기 버튼 */}
        <div className="mt-8 text-center">
          <button className="px-6 py-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors">
            더 많은 뉴스 보기
          </button>
        </div>
      </div>
    </div>
  );
}