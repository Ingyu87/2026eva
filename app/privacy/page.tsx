import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 학교평가 설문 생성기"
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "40px 20px", lineHeight: 1.7 }}>
      <h1>개인정보처리방침</h1>
      <p>학교평가 설문 생성기(이하 "서비스")는 이용자의 개인정보를 소중히 여기며 관련 법령을 준수합니다.</p>

      <h2>1. 수집 항목</h2>
      <p>서비스는 학교명, 로그인 비밀번호(해시 처리), 설문 작성 데이터, Google OAuth 연동 시 필요한 최소 정보만 처리합니다.</p>

      <h2>2. 이용 목적</h2>
      <p>학교 계정 인증, 설문 초안 저장, DOCX 및 Google Forms 생성 기능 제공을 위해 개인정보를 이용합니다.</p>

      <h2>3. 보관 기간</h2>
      <p>서비스 운영 기간 동안 데이터를 보관하며, 이용자 요청 또는 운영 정책에 따라 지체 없이 삭제할 수 있습니다.</p>

      <h2>4. 제3자 제공</h2>
      <p>
        서비스는 Google Forms 생성 기능 제공을 위해 이용자가 명시적으로 동의한 경우에 한해 Google API를 사용합니다.
        법령상 근거가 없는 한 제3자에게 개인정보를 제공하지 않습니다.
      </p>

      <h2>5. 이용자 권리</h2>
      <p>이용자는 자신의 데이터 조회, 수정, 삭제를 요청할 수 있습니다.</p>

      <h2>6. 문의처</h2>
      <p>개인정보 관련 문의: 운영자에게 별도 고지된 연락처로 요청</p>

      <p style={{ marginTop: 32, color: "#555" }}>시행일: 2026-05-07</p>
    </main>
  );
}
