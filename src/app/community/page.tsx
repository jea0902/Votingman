"use client";

import { CommunityFeed } from "@/components/community/CommunityFeed";

export default function CommunityPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <CommunityFeed
        title="커뮤니티 (홈 통합)"
        description="커뮤니티 기능은 홈 하단 피드 중심으로 통합되었습니다. 이 페이지는 상세 열람/접근용으로 유지됩니다."
        pageSize={20}
        showIntegrationNotice
      />
    </div>
  );
}

