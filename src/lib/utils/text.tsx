/**
 * 텍스트 처리 유틸리티 함수
 * 
 * 설계 의도:
 * - 멘션(@username) 파싱 및 하이라이트 렌더링
 * - 향후 해시태그, 링크 파싱 확장 가능
 */

import React from 'react';

/**
 * 텍스트에서 멘션(@username)을 파싱하여 하이라이트된 React 노드로 변환합니다.
 * 
 * @param content - 파싱할 텍스트 내용
 * @returns React 노드 배열 (일반 텍스트 + 하이라이트된 멘션)
 * 
 * @example
 * renderContentWithMentions("안녕하세요 @홍길동 님")
 * // ["안녕하세요 ", <span className="...">@홍길동</span>, " 님"]
 */
export function renderContentWithMentions(content: string): React.ReactNode {
  const mentionRegex = /@(\S+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // 멘션 이전 텍스트
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }
    
    // 멘션 부분 (하이라이트)
    parts.push(
      <span 
        key={match.index} 
        className="text-primary font-medium bg-primary/10 px-1 rounded"
      >
        @{match[1]}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }

  // 남은 텍스트
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : content;
}
