// 클라이언트 컴포넌트 

// 회원 탈퇴 페이지 - 탈퇴는 사실상 계정 비활성화임.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 회원 탈퇴 페이지
 * 경로: /account/leave
 *
 * UX 설계:
 * - 체크박스로 탈퇴 조건 동의 확인
 * - 확인 문구("탈퇴합니다") 직접 입력으로 실수 방지
 * - 탈퇴 후 홈("/")으로 리다이렉트
 */


const CONFIRM_KEYWORD = "탈퇴합니다";

const LEAVE_CONDITIONS = [
  "탈퇴 후 즉시 서비스 이용이 불가합니다.",
  "재가입 시 기존 계정이 그대로 복구됩니다.",
  "보팅코인 및 전적은 재가입 후에도 유지됩니다.",
  "작성한 게시글과 댓글은 그대로 유지됩니다.",
];

export default function LeavePage() {
  const router = useRouter();
  const [checkedItems, setCheckedItems] = useState<boolean[]>(
    new Array(LEAVE_CONDITIONS.length).fill(false)
  );
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checkedItems.every(Boolean);
  const isConfirmMatch = confirmText === CONFIRM_KEYWORD;
  const canSubmit = allChecked && isConfirmMatch && !isLoading;

  const toggleCheck = (index: number) => {
    setCheckedItems((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleLeave = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/leave", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "오류가 발생했습니다. 다시 시도해주세요.");
        return;
      }

      // 탈퇴 완료 → 홈으로 이동 (새로고침으로 Navbar 상태 초기화)
window.location.href = "/";
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center px-4 py-16">
      <div className="leave-card">
        {/* 헤더 */}
        <div className="leave-header">
          <div className="leave-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="leave-title">회원 탈퇴</h1>
          <p className="leave-subtitle">
            탈퇴 전 아래 내용을 반드시 확인해주세요.
          </p>
        </div>

        {/* 탈퇴 조건 체크 */}
        <div className="conditions-section">
          <p className="section-label">탈퇴 조건 확인</p>
          <ul className="conditions-list">
            {LEAVE_CONDITIONS.map((condition, i) => (
              <li
                key={i}
                className={`condition-item ${checkedItems[i] ? "checked" : ""}`}
                onClick={() => toggleCheck(i)}
              >
                <span className="condition-checkbox">
                  {checkedItems[i] ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : null}
                </span>
                <span className="condition-text">{condition}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 확인 문구 입력 */}
        <div className="confirm-section">
          <label className="section-label" htmlFor="confirm-input">
            확인 문구 입력
          </label>
          <p className="confirm-hint">
            아래 칸에{" "}
            <strong className="confirm-keyword">"{CONFIRM_KEYWORD}"</strong>를
            정확히 입력해주세요.
          </p>
          <input
            id="confirm-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_KEYWORD}
            className={`confirm-input ${isConfirmMatch ? "match" : ""}`}
            autoComplete="off"
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="error-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* 버튼 */}
        <div className="button-group">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-cancel"
            disabled={isLoading}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleLeave}
            disabled={!canSubmit}
            className={`btn-leave ${canSubmit ? "active" : ""}`}
          >
            {isLoading ? (
              <span className="loading-spinner" />
            ) : (
              "탈퇴하기"
            )}
          </button>
        </div>
      </div>

      <style>{`
        .leave-card {
          width: 100%;
          max-width: 480px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 16px;
          padding: 40px 36px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        /* 헤더 */
        .leave-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }

        .leave-icon {
          width: 64px;
          height: 64px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
        }

        .leave-title {
          font-size: 22px;
          font-weight: 700;
          color: #f5f5f5;
          letter-spacing: -0.3px;
        }

        .leave-subtitle {
          font-size: 14px;
          color: #6b6b6b;
          line-height: 1.5;
        }

        /* 섹션 공통 */
        .section-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 12px;
        }

        /* 조건 리스트 */
        .conditions-section {}

        .conditions-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .condition-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 8px;
          border: 1px solid #2a2a2a;
          background: #141414;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          user-select: none;
        }

        .condition-item:hover {
          border-color: #3a3a3a;
          background: #1e1e1e;
        }

        .condition-item.checked {
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.05);
        }

        .condition-checkbox {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: 1.5px solid #3a3a3a;
          background: #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
          transition: border-color 0.15s, background 0.15s;
        }

        .condition-item.checked .condition-checkbox {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.15);
        }

        .condition-text {
          font-size: 14px;
          color: #ccc;
          line-height: 1.4;
        }

        .condition-item.checked .condition-text {
          color: #f5f5f5;
        }

        /* 확인 입력 */
        .confirm-section {}

        .confirm-hint {
          font-size: 13px;
          color: #666;
          margin-bottom: 10px;
          line-height: 1.5;
        }

        .confirm-keyword {
          color: #ef4444;
          font-weight: 600;
        }

        .confirm-input {
          width: 100%;
          padding: 12px 14px;
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          color: #f5f5f5;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }

        .confirm-input::placeholder {
          color: #3a3a3a;
        }

        .confirm-input:focus {
          border-color: #4a4a4a;
        }

        .confirm-input.match {
          border-color: rgba(239, 68, 68, 0.4);
        }

        /* 에러 박스 */
        .error-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          color: #f87171;
          font-size: 13px;
          line-height: 1.4;
        }

        /* 버튼 */
        .button-group {
          display: flex;
          gap: 10px;
        }

        .btn-cancel {
          flex: 1;
          padding: 13px;
          border-radius: 8px;
          border: 1px solid #2a2a2a;
          background: transparent;
          color: #888;
          font-size: 15px;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }

        .btn-cancel:hover:not(:disabled) {
          border-color: #4a4a4a;
          color: #ccc;
        }

        .btn-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-leave {
          flex: 1.5;
          padding: 13px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: #2a2a2a;
          color: #555;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          cursor: not-allowed;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-leave.active {
          background: #ef4444;
          color: #fff;
          cursor: pointer;
          border-color: #ef4444;
        }

        .btn-leave.active:hover {
          background: #dc2626;
          border-color: #dc2626;
        }

        /* 로딩 스피너 */
        .loading-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .leave-card {
            padding: 32px 24px;
          }
        }
      `}</style>
    </div>
  );
}