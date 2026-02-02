/**
 * 익명 사용자 관련 유틸리티 함수
 * 
 * 설계 의도:
 * - 비로그인 사용자를 위한 익명 닉네임 생성 및 관리
 * - LocalStorage 기반으로 브라우저 세션 간 일관성 유지
 * - 익명 사용자의 댓글 소유권 확인
 */

const ANONYMOUS_NICKNAME_KEY = 'anonymous_nickname';
const MY_COMMENTS_KEY = 'my_comments';
const LIKED_POSTS_KEY = 'liked_posts';

/**
 * 익명 사용자의 닉네임을 가져오거나 생성합니다.
 * LocalStorage에 저장하여 같은 브라우저에서는 동일한 닉네임을 유지합니다.
 * 
 * @returns 익명 닉네임 (예: "익명1234")
 * 
 * @example
 * const nickname = getAnonymousNickname();
 * // "익명1234" (최초 호출 시 생성, 이후 동일 값 반환)
 */
export function getAnonymousNickname(): string {
  // 서버 사이드에서는 기본값 반환
  if (typeof window === 'undefined') {
    return '익명';
  }

  let nickname = localStorage.getItem(ANONYMOUS_NICKNAME_KEY);
  
  if (!nickname) {
    // 랜덤 4자리 숫자 생성
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    nickname = `익명${randomNum}`;
    localStorage.setItem(ANONYMOUS_NICKNAME_KEY, nickname);
  }
  
  return nickname;
}

/**
 * 익명 사용자가 작성한 댓글 ID 목록을 가져옵니다.
 * 
 * @returns 댓글 ID 배열
 */
export function getMyAnonymousComments(): number[] {
  if (typeof window === 'undefined') {
    return [];
  }
  
  return JSON.parse(localStorage.getItem(MY_COMMENTS_KEY) || '[]');
}

/**
 * 익명 사용자가 작성한 댓글 ID를 저장합니다.
 * 
 * @param commentId - 저장할 댓글 ID
 */
export function saveMyAnonymousComment(commentId: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  const myComments = getMyAnonymousComments();
  myComments.push(commentId);
  localStorage.setItem(MY_COMMENTS_KEY, JSON.stringify(myComments));
}

/**
 * 익명 사용자가 좋아요한 게시글 ID 목록을 가져옵니다.
 * 
 * @returns 게시글 ID 배열
 */
export function getAnonymousLikedPosts(): number[] {
  if (typeof window === 'undefined') {
    return [];
  }
  
  return JSON.parse(localStorage.getItem(LIKED_POSTS_KEY) || '[]');
}

/**
 * 익명 사용자의 좋아요 상태를 토글합니다.
 * 
 * @param postId - 게시글 ID
 * @returns 토글 후 좋아요 상태 (true: 좋아요됨, false: 취소됨)
 */
export function toggleAnonymousLike(postId: number): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const likedPosts = getAnonymousLikedPosts();
  const index = likedPosts.indexOf(postId);
  
  if (index > -1) {
    // 이미 좋아요 → 취소
    likedPosts.splice(index, 1);
    localStorage.setItem(LIKED_POSTS_KEY, JSON.stringify(likedPosts));
    return false;
  } else {
    // 좋아요 추가
    likedPosts.push(postId);
    localStorage.setItem(LIKED_POSTS_KEY, JSON.stringify(likedPosts));
    return true;
  }
}

/**
 * 익명 사용자가 특정 게시글에 좋아요했는지 확인합니다.
 * 
 * @param postId - 게시글 ID
 * @returns 좋아요 여부
 */
export function hasAnonymousLiked(postId: number): boolean {
  return getAnonymousLikedPosts().includes(postId);
}
