# Google OAuth 검증 준비 체크리스트

이 문서는 `학교평가 설문 생성기`를 Google OAuth 검증(External / In production)으로 제출할 때 필요한 항목을 정리합니다.

## 1) OAuth 동의 화면 기본 설정

- 앱 이름: 학교평가 설문 생성기
- 사용자 지원 이메일: 운영자 이메일
- 앱 홈 URL: `https://2026eva.vercel.app`
- 개인정보처리방침 URL: `https://2026eva.vercel.app/privacy`
- 서비스 약관 URL: `https://2026eva.vercel.app/terms`

## 2) 승인된 리디렉션 URI

- `https://2026eva.vercel.app/api/google/callback`

## 3) 사용 스코프와 사유

- 스코프: `https://www.googleapis.com/auth/forms.body`
- 사용 목적(제출용 문구 예시):
  - "학교가 작성한 평가 문항을 이용자가 명시적으로 요청할 때 Google Forms로 생성하기 위해 사용합니다."
  - "폼 생성 및 문항 등록 이외의 목적으로 Google 사용자 데이터를 수집/판매/공유하지 않습니다."

## 4) 검증 제출 시 준비 자료

- OAuth 동의 화면 정보 입력 완료
- 공개 접근 가능한 개인정보처리방침/약관 URL
- 제품 데모 영상(권장 3~5분)
  - 로그인
  - 문항 선택/편집
  - `Google Forms 만들기` 클릭
  - Google 동의 화면
  - 생성 완료 후 편집 링크 확인
- 테스트 계정 또는 재현 절차 문서

## 5) 운영 보안 체크

- 실제 비밀값은 Vercel 환경변수로만 저장 (`.env`/GitHub 미포함)
- `ADMIN_PASSWORD`, `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET` 주기적 교체 정책 수립
- 유출 의심 시 OAuth Client Secret 즉시 재발급
