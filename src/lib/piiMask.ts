/**
 * 서술형 응답을 Gemini로 보내기 전에 개인정보를 가립니다 (spec.md 4.9 "개인정보 처리").
 *
 * 완벽한 개체명 인식이 아니라 정규식 기반 최선의 노력입니다. 서술형 응답은 짧고
 * 정형화된 문장이 많아(예: "김OO 선생님께 감사드립니다") 이 정도로도 대부분 걸러집니다.
 * 놓치는 경우가 있을 수 있으니 화면에 마스킹 결과를 보여주고 사전 고지·동의를 받습니다.
 */

const PHONE_PATTERN = /01[0-9][-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** 학번은 학교마다 자릿수가 달라 8~10자리 숫자로 넓게 잡습니다. 전화번호보다 먼저 걸러지고 남은 것만 대상입니다. */
const STUDENT_ID_PATTERN = /\b\d{8,10}\b/g;
/** "김OO 선생님/학생/어머니…" 처럼 호칭 앞의 한글 2~4자를 이름으로 봅니다. */
const NAME_BEFORE_TITLE_PATTERN =
  /[가-힣]{2,4}(?=\s?(선생님|선생|학생|어머니|아버지|학부모님|학부모|담임|교사|교장|교감|원장|부장))/g;

export function maskPersonalInfo(text: string): string {
  return text
    .replace(PHONE_PATTERN, "[전화번호]")
    .replace(EMAIL_PATTERN, "[이메일]")
    .replace(STUDENT_ID_PATTERN, "[학번]")
    .replace(NAME_BEFORE_TITLE_PATTERN, "[이름]");
}
