/**
 * 구글폼 필수·선택. 문항 문장을 보고 해당되는 사람만 답하면 되는 것은 선택으로 둡니다.
 * 연구부장이 수정에서 직접 고른 값은 그대로 따릅니다.
 */

const OPTIONAL_PHRASE = /해당되는|해당하(는|신|시면)|해당 학부모|해당하는 분만|이용하(는|신)|참여한 경우|건너뛰/;
const OPTIONAL_TOPIC = /방과후|돌봄교실|돌봄서비스|돌봄 서비스|특수학급|특수교육|개별화교육|학부모회 활동|학부모 동아리|학부모 학습|기초학력 지원|보충학습|맞춤형 지원|교육복지/;

export function suggestOptionalResponse(item: {
  audience?: string;
  indicator?: string;
  editedQuestion?: string;
  originalQuestion?: string;
}): boolean {
  const text = `${item.indicator ?? ""} ${item.editedQuestion || item.originalQuestion || ""}`;
  if (OPTIONAL_PHRASE.test(text)) {
    return true;
  }
  if (item.audience === "teacher" || item.audience === "staff") {
    return false;
  }
  return OPTIONAL_TOPIC.test(text);
}

export function isFormRequired(item: {
  required?: boolean;
  audience?: string;
  indicator?: string;
  editedQuestion?: string;
  originalQuestion?: string;
}): boolean {
  if (item.required === true) {
    return true;
  }
  if (item.required === false) {
    return false;
  }
  return !suggestOptionalResponse(item);
}
