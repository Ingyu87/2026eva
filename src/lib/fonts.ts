/**
 * 글꼴은 `app/styles/tokens.css`의 `--font-sans` / `--font-mono` 가 정합니다.
 *
 * 예전에는 `next/font/google`로 Inter를 받아 썼는데 두 가지 문제가 있었습니다.
 *   1. 빌드할 때마다 Google Fonts에 접속해야 해서, 학교망처럼 TLS 검사가 걸린
 *      환경에서는 빌드 자체가 실패합니다.
 *   2. next/font가 주입하는 `--font-sans`가 디자인 토큰의 값을 덮어써서,
 *      한글 본문까지 라틴 글꼴 기준으로 렌더링됐습니다.
 *
 * 한글 화면이므로 Pretendard를 우선하고 없으면 맑은 고딕으로 떨어뜨립니다.
 * 둘 다 내려받지 않으므로 화면이 늦게 뜨는 일도 없습니다.
 */
export const fontClassNames = "";
