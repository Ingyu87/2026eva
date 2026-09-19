export function operationalChecks(env: Record<string, string | undefined>) {
  let serviceAccount = false;
  try {
    const parsed = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '{}');
    serviceAccount = !!(parsed.project_id && parsed.client_email && parsed.private_key);
  } catch { /* 잘못된 JSON도 미설정으로 안내 */ }
  const firebase = serviceAccount || !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
  return [
    { name: '학교 자료 저장', configured: firebase, next: 'Firebase 서비스 계정을 설정한 뒤 가상 자료 저장·재접속과 다른 브라우저의 동시 수정을 확인하세요.' },
    { name: '로그인 서명', configured: !!env.SESSION_SECRET && env.SESSION_SECRET.length >= 32 && env.SESSION_SECRET !== 'replace-with-a-long-random-string', next: '서버 환경변수 SESSION_SECRET에 무작위 비밀값을 32자 이상 설정하세요.' },
    { name: 'Google Forms', configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), next: 'Google OAuth 설정과 승인된 콜백 주소를 확인한 뒤 가상 학생용 폼의 첫 학년 문항, 선택형·서술형 문항을 확인하세요.' }
  ];
}
