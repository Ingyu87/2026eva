# 학교평가 설문 생성기

학교평가 평가문항을 대상별로 선택하고 수정한 뒤 DOCX 설문지와 Google Forms를 생성하는 Next.js 웹앱입니다.

## 실행

```bash
npm install
npm run dev
```

로컬 실행 후 `http://localhost:3000`으로 접속합니다. 현재 작업 환경에서는 3000번 포트가 사용 중이라 `http://localhost:3001`로 dev 서버를 실행했습니다.

## 주요 기능

- 학교 사용자 등록/로그인
- 관리자 로그인 및 학교 계정 관리
- `교원용`, `학부모용`, `학생용`, `교직원용` 문항 탭
- 영역, 세부영역, 평가지표 필터링
- 문항 담기, 수정, 삭제, 순서 변경
- DOCX 설문지 출력
- Google OAuth를 통한 Google Forms 생성

## 환경변수

`.env.example`을 참고해 Vercel 환경변수에 등록합니다.

```bash
ADMIN_PASSWORD=your-secure-admin-password
SESSION_SECRET=replace-with-a-long-random-string

FIREBASE_SERVICE_ACCOUNT_JSON={"project_id":"...","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"}

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# 배포 시에만 설정 권장. 로컬에서는 비워 두고 접속 주소에 맞는 콜백이 자동 적용됩니다.
GOOGLE_REDIRECT_URI=https://your-vercel-domain.vercel.app/api/google/callback
```

Firebase 서비스 계정은 JSON 한 줄 방식 또는 개별 `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` 방식 중 하나를 사용합니다.

**보안:** `.env`는 `.gitignore`에 포함되어 있으며 GitHub에 올리지 않습니다. 실제 비밀번호·Firebase JSON·Google 클라이언트 보안 비밀은 Vercel(또는 호스트) 환경 변수로만 설정하세요.

## Google Cloud 설정

1. Google Cloud Console에서 **Google Forms API**를 사용 설정합니다.
2. **OAuth 동의 화면**에서 테스트 사용자(또는 프로덕션 승인)를 구성합니다.
3. **OAuth 클라이언트 ID**(웹)를 만들고, **승인된 리디렉션 URI**에 아래를 **모두** 등록하는 것을 권장합니다.
   - `http://localhost:3000/api/google/callback`
   - `http://127.0.0.1:3000/api/google/callback` (브라우저 주소를 127.0.0.1로 열 때 필요)
   - 배포: `https://your-vercel-domain.vercel.app/api/google/callback`
4. 로컬에서 `.env`의 `GOOGLE_REDIRECT_URI`는 **비워 두면** 접속한 호스트에 맞춰 콜백 URL이 맞춰집니다. `localhost`로만 등록해 두고 `127.0.0.1`로 접속하면 OAuth `redirect_uri_mismatch`가 날 수 있습니다.
5. 이 앱은 scope `https://www.googleapis.com/auth/forms.body` 를 사용합니다.

## 검증 명령

```bash
npm run typecheck
npm run build
```

## 참고

Firebase 환경변수가 없으면 로컬 개발용 메모리 저장소로 동작합니다. 이 경우 서버를 재시작하면 등록 학교와 초안이 사라집니다. Vercel 배포에서는 반드시 Firebase 환경변수를 설정해야 합니다.

## OAuth 검증 준비

- 개인정보처리방침: `https://2026eva.vercel.app/privacy`
- 이용약관: `https://2026eva.vercel.app/terms`
- 검증 체크리스트: `docs/google-oauth-verification-checklist.md`
