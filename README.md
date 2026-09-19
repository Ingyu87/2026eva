# 2026학년도 학교평가 웹앱

교육청 예시자료에서 평가문항을 골라 설문을 만들고, 설문 결과를 분석해
제출 서류를 생성하는 Next.js 웹앱입니다.

## 문서

**AI 에이전트로 작업한다면 [AGENTS.md](AGENTS.md)를 먼저 읽으세요.**
지켜야 할 규칙과 되돌리면 안 되는 구조를 정리해 두었습니다.

사람이 읽을 문서는 [docs/README.md](docs/README.md)부터 보세요. 문서 4종의 역할을 설명합니다.

| 문서 | 내용 |
|---|---|
| [docs/prd.md](docs/prd.md) | 왜 만드는가, 무엇이 되어야 하는가 |
| [docs/spec.md](docs/spec.md) | 화면·데이터·API·계산식 |
| [docs/design.md](docs/design.md) | 색·글꼴·간격·부품 규격 |
| [docs/implementation.md](docs/implementation.md) | 단계별 작업 계획과 진행 상황 |

## 실행

```bash
npm install
npm run dev
```

Firebase 환경변수가 없으면 메모리 저장소로 동작합니다. 서버를 다시 켜면
등록한 학교와 초안이 사라지므로 로컬 확인용으로만 쓰세요.

## 검증

```bash
npm run verify            # 아래 셋을 한 번에
npm run typecheck
npm run verify:bank       # 문항 풀이 2026 평가체제를 지키는가
npm run verify:design     # 색·간격·높이 고정 규칙을 지키는가

# 서버를 띄운 뒤 실행합니다
npm run build && npx next start -p 3100 &
npm run verify:concurrent # 두 사람이 동시에 작업해도 유실이 없는가
```

`verify:concurrent`는 같은 학교 계정으로 두 세션을 만들어, 서로 다른 대상과
같은 문항을 동시에 편집하는 상황을 재현합니다. 이 프로젝트에서 가장 중요한
검증이라 손으로 하지 않고 스크립트로 남겼습니다.

## 문항 풀 갱신

교육청이 새 예시자료를 배포하면 두 단계로 적재합니다.

```bash
python scripts/extract_question_bank.py "1_(초)2026 학교평가 평가문항 예시 자료.pdf" \
    --level elementary --out .parsed/question-bank-2026-raw.json
node scripts/build-question-bank.mjs .parsed/question-bank-2026-raw.json
npm run verify:bank
```

정리 단계에서 허용된 세부영역 10개와 대조해 통과한 것만 채택하고, 나머지는
`.parsed/question-bank-2026-rejected.json`에 모아 보고합니다. 영역·세부영역은
학교가 고칠 수 없는 값이므로(기본계획 Ⅴ-3-가-2, 가이드북 Q6) 여기서 걸러야 합니다.

## 주요 기능

- 학교 계정 등록·로그인, 관리자 계정 관리
- 2026 평가체제 기반 문항 풀 탐색 (지표 트리 + 검색)
- 문항을 평가 주체별로 담고 수정·정렬
- **여러 명이 동시에 작업해도 서로의 작업이 사라지지 않음**
- DOCX 설문지 출력, Google Forms 생성

## 환경변수

`.env.example`을 참고해 Vercel 환경변수에 등록합니다.

```bash
ADMIN_PASSWORD=
SESSION_SECRET=

FIREBASE_SERVICE_ACCOUNT_JSON={"project_id":"...","client_email":"...","private_key":"..."}

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# 배포 시에만 설정합니다. 로컬에서는 비워 두면 접속 주소에 맞는 콜백이 적용됩니다.
GOOGLE_REDIRECT_URI=https://your-vercel-domain.vercel.app/api/google/callback
```

`.env`는 `.gitignore`에 있습니다. 실제 값은 호스트 환경변수로만 설정하세요.

## 저장소에 올리지 않는 것

**이 저장소는 공개입니다.** 학교 실제 데이터는 `.gitignore`로 막아 두었습니다.

- 설문 결과 HTML — 학생·학부모 서술형 응답 원문이 들어 있습니다
- 학교평가서 PDF, 평가지표 및 현황 XLSX — 학교별 평가 결과

## Google Cloud 설정

1. **Google Forms API** 사용 설정
2. **OAuth 동의 화면**에 테스트 사용자 또는 프로덕션 승인 구성
3. **OAuth 클라이언트 ID**(웹)의 승인된 리디렉션 URI에 모두 등록
   - `http://localhost:3000/api/google/callback`
   - `http://127.0.0.1:3000/api/google/callback`
   - `https://your-vercel-domain.vercel.app/api/google/callback`
4. 사용 scope: `https://www.googleapis.com/auth/forms.body`

- 개인정보처리방침: `https://2026eva.vercel.app/privacy`
- 이용약관: `https://2026eva.vercel.app/terms`
- 검증 체크리스트: [docs/google-oauth-verification-checklist.md](docs/google-oauth-verification-checklist.md)

## 2026-09-19 종합 검토 반영

최신 변경·점수 산정·검증·운영 환경 미확인 항목은 [종합 검토 기록](docs/review-2026-09-19.md)에 기록했습니다.
문항 풀은 대상별 963개이며 AI 없이 평가 의견을 작성할 수 있습니다. 제출본은 학년말 집계의 대상·문항별 응답과 평가 의견 검사를 통과해야 합니다.
로컬 체험 저장소는 재시작 시 유지되지 않을 수 있습니다. 운영에는 Firebase와 강한 SESSION_SECRET이 필요합니다.
