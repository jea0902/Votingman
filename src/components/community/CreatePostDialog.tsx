"use client";

/**
 * 게시글 작성 다이얼로그
 * 
 * 설계 의도:
 * - 모달 형태로 빠른 게시글 작성
 * - 자유게시판/관점 게시판 구분
 * - 자유게시판은 카테고리 선택 (자유/건의)
 * - 임시: 작성자 닉네임 수동 입력 (인증 미구현)
 * 
 * 확장성:
 * - 인증 추가 시 닉네임 입력 제거, 자동 처리
 * - 이미지 업로드 기능 추가 가능
 * - 마크다운 에디터 연동 가능
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// 현재는 건의 게시판(자유 board_type)만 사용. 관점 게시판은 MVP에서 비활성화.
type BoardType = 'free'; // | 'perspective';
type Category = 'free' | 'suggestion';

type CreatePostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardType: BoardType;
  onSuccess?: () => void;
};

export function CreatePostDialog({ 
  open, 
  onOpenChange, 
  boardType,
  onSuccess 
}: CreatePostDialogProps) {
  // 모든 새 글은 '건의' 카테고리로 저장
  const [category, setCategory] = useState<Category>('suggestion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // 이미지 첨부 상태
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // 사용자 정보
  const [currentUser, setCurrentUser] = useState<{ id: string; nickname: string } | null>(null);

  // 사용자 세션 확인
  useEffect(() => {
    const supabase = createClient();
    
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('nickname')
          .eq('user_id', session.user.id)
          .is('deleted_at', null)
          .maybeSingle();

        if (userData) {
          setCurrentUser({
            id: session.user.id,
            nickname: userData.nickname,
          });
        }
      }
    });
  }, [open]);

  // 이미지 선택 핸들러
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: File[] = [];
    const newPreviewUrls: string[] = [];

    Array.from(files).forEach((file) => {
      // 파일 타입 검증 (이미지만 허용)
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일만 업로드 가능합니다.');
        return;
      }

      // 파일 크기 검증 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        setError('이미지 크기는 5MB 이하만 가능합니다.');
        return;
      }

      newImages.push(file);
      newPreviewUrls.push(URL.createObjectURL(file));
    });

    setImages((prev) => [...prev, ...newImages]);
    setImagePreviewUrls((prev) => [...prev, ...newPreviewUrls]);
  };

  // 이미지 제거 핸들러
  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(imagePreviewUrls[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // 로그인 확인
      if (!currentUser) {
        setError('로그인이 필요합니다.');
        setIsSubmitting(false);
        return;
      }

      // 입력 검증
      if (!title.trim()) {
        setError('제목을 입력해주세요.');
        setIsSubmitting(false);
        return;
      }

      if (!content.trim()) {
        setError('내용을 입력해주세요.');
        setIsSubmitting(false);
        return;
      }

      // FormData로 이미지와 함께 전송
      const formData = new FormData();
      formData.append('board_type', boardType);
      if (boardType === 'free') {
        formData.append('category', category);
      }
      formData.append('title', title.trim());
      formData.append('content', content.trim());
      formData.append('user_id', currentUser.id);
      formData.append('author_name', currentUser.nickname);

      // 이미지 추가
      images.forEach((image, index) => {
        formData.append('images', image);
      });

      // API 호출
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '게시글 작성에 실패했습니다.');
      }

      // 성공: 폼 초기화 및 모달 닫기
      setTitle('');
      setContent('');
      setCategory('suggestion');
      setImages([]);
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setImagePreviewUrls([]);
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (err) {
      console.error('Failed to create post:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      setTitle('');
      setContent('');
      setCategory('suggestion');
      setImages([]);
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setImagePreviewUrls([]);
      setError('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            건의 게시판 글쓰기
            {/* 기존: {boardType === 'free' ? '자유게시판 글쓰기' : '관점 게시판 글쓰기'} */}
          </DialogTitle>
          <DialogDescription>
            서비스에 대한 아이디어, 버그 제보, 불편 사항 등 건의 내용을 작성해주세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* 자유게시판: 카테고리 선택
              현재는 건의 게시판만 사용하므로 모든 글을 '건의'로 저장합니다.
              추후 자유/건의 구분이 필요하면 아래 주석을 복원하세요.
          */}
          {boardType === 'free' && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {/*
              <Label>
                카테고리 <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={category}
                onValueChange={(value) => setCategory(value as Category)}
                disabled={isSubmitting}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="free" id="cat-free" />
                  <Label htmlFor="cat-free" className="cursor-pointer font-normal">
                    💬 자유 - 일상 투자 이야기, 질문 등
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="suggestion" id="cat-suggestion" />
                  <Label htmlFor="cat-suggestion" className="cursor-pointer font-normal">
                    💡 건의 - 서비스 개선 제안
                  </Label>
                </div>
              </RadioGroup>
              */}
              <p>모든 게시글은 건의 카테고리로 등록됩니다.</p>
            </div>
          )}

          {/* 제목 */}
          <div className="space-y-2">
            <Label htmlFor="post-title">
              제목 <span className="text-destructive">*</span>
            </Label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="제목을 입력하세요"
              maxLength={300}
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/300자
            </p>
          </div>

          {/* 내용 */}
          <div className="space-y-2">
            <Label htmlFor="post-content">
              내용 <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              placeholder="내용을 입력하세요"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* 이미지 첨부 */}
          <div className="space-y-2">
            <Label htmlFor="post-images">
              이미지 첨부 (선택)
            </Label>
            <div className="space-y-3">
              {/* 파일 선택 버튼 */}
              <div className="flex items-center gap-2">
                <input
                  id="post-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('post-images')?.click()}
                  disabled={isSubmitting}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  이미지 선택
                </Button>
                <p className="text-xs text-muted-foreground">
                  최대 5MB, 이미지 파일만 가능
                </p>
              </div>

              {/* 이미지 프리뷰 */}
              {imagePreviewUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {imagePreviewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-md border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={isSubmitting}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  작성 중...
                </>
              ) : (
                '작성 완료'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
