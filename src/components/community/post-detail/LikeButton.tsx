/**
 * 좋아요 버튼 컴포넌트
 * 
 * 설계 의도:
 * - 좋아요/취소 토글
 * - 좋아요 수 표시
 * - 로딩 상태 처리
 */

"use client";

import { Button } from "@/components/ui/button";
import { ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  isLiked: boolean;
  isLiking: boolean;
  likeCount: number;
  onToggle: () => void;
}

/**
 * 좋아요 버튼을 렌더링합니다.
 */
export function LikeButton({
  isLiked,
  isLiking,
  likeCount,
  onToggle,
}: LikeButtonProps) {
  return (
    <div className="my-6 flex justify-center">
      <Button
        size="lg"
        variant={isLiked ? "default" : "outline"}
        onClick={onToggle}
        disabled={isLiking}
        className={cn(
          "gap-2 px-8 py-6 text-lg font-semibold",
          isLiked && "bg-red-500 hover:bg-red-600 text-white border-red-500"
        )}
      >
        <ThumbsUp className={cn("h-6 w-6", isLiked && "fill-current")} />
        {isLiked ? '좋아요 취소' : '좋아요'} ({likeCount})
      </Button>
    </div>
  );
}
