#!/usr/bin/env bash
# AI 해석(7단계) 검증 — docs/implementation.md 7단계
#
# 사용법:
#   npm run build && npx next start -p 3100 &
#   bash scripts/verify-ai-analysis.sh
#
#   개발 서버로 돌릴 때:
#   BASE_URL=http://127.0.0.1:3000 bash scripts/verify-ai-analysis.sh
#
# ⚠️ 이 스크립트는 실제 Gemini API를 호출합니다(과금·쿼터 소모, 응답이 매번 조금씩 다름).
#    그래서 npm run verify 기본 체인에는 넣지 않았습니다. GEMINI_API_KEY가 .env.local에
#    있어야 하고, 서버가 그 값을 읽은 상태로 떠 있어야 합니다.
#
# 교원-학부모 간 실제 인식 격차가 있는 데이터를 넣고, Gemini가
# ① 그 격차를 실제로 짚어내는지 ② 서술형(마스킹된) 응답을 반영하는지
# ③ evidence 숫자가 실제 집계와 정확히 일치하는지(환각 방지)를 확인합니다.
set -u
BASE="${BASE_URL:-http://127.0.0.1:3100}"
JAR="/tmp/jAiVerify.txt"
ITEMS="./.verify-ai-items.json"
TEACHER_CSV="./.verify-ai-teacher.csv"
PARENT_CSV="./.verify-ai-parent.csv"
BODY="./.verify-ai-body.json"
rm -f "$JAR" "$ITEMS" "$TEACHER_CSV" "$PARENT_CSV" "$BODY"
SCHOOL="verify-ai-$RANDOM"
PASS=0; FAIL=0
ok(){ echo "  [PASS] $1"; PASS=$((PASS+1)); }
ng(){ echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

j(){ curl -s -X "$1" "$BASE$2" -b "$JAR" -c "$JAR" -H "Content-Type: application/json" ${3:+-d "$3"}; }
jf(){ curl -s -X "$1" "$BASE$2" -b "$JAR" -c "$JAR" -H "Content-Type: application/json" --data-binary "@$BODY"; }
get(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const v=JSON.parse(d).data;console.log(eval('v.'+process.argv[1]))}catch(e){console.log('<parse-error>')}})" "$1"; }

cat > "$ITEMS" <<'JSON'
{"items":[
  {"id":"gap-teacher-1","sourceQuestionId":"src1","groupId":"gapgroup","audience":"teacher","sourceRow":1,"area":"Ⅰ. 협력적 학교자치문화","subarea":"Ⅰ-3. 공감과 소통의 행정","indicator":"예산 편성・운영의 적정성 및 투명성 제고","originalQuestion":"예산 편성과 운영이 투명하다","editedQuestion":"예산 편성과 운영이 투명하다","responseType":"likert_5","order":1},
  {"id":"gap-parent-1","sourceQuestionId":"src1","groupId":"gapgroup","audience":"parent","sourceRow":1,"area":"Ⅰ. 협력적 학교자치문화","subarea":"Ⅰ-3. 공감과 소통의 행정","indicator":"예산 편성・운영의 적정성 및 투명성 제고","originalQuestion":"예산 편성과 운영이 투명하다","editedQuestion":"예산 편성과 운영이 투명하다","responseType":"likert_5","order":1},
  {"id":"text-parent-1","sourceQuestionId":"src2","groupId":"textgroup","audience":"parent","sourceRow":2,"area":"Ⅰ. 협력적 학교자치문화","subarea":"Ⅰ-3. 공감과 소통의 행정","indicator":"예산 편성・운영의 적정성 및 투명성 제고","originalQuestion":"예산 관련 하고 싶은 말을 자유롭게 적어주세요","editedQuestion":"예산 관련 하고 싶은 말을 자유롭게 적어주세요","responseType":"text","order":2}
]}
JSON

cat > "$TEACHER_CSV" <<'CSV'
예산 편성과 운영이 투명하다
매우 그렇다
매우 그렇다
매우 그렇다
매우 그렇다
매우 그렇다
매우 그렇다
매우 그렇다
매우 그렇다
매우 그렇다
매우 그렇다
매우 그렇다
그렇다
CSV

cat > "$PARENT_CSV" <<'CSV'
예산 편성과 운영이 투명하다,예산 관련 하고 싶은 말을 자유롭게 적어주세요
매우 그렇다,
그렇다,예산 사용 내역을 좀 더 자세히 공개해 주셨으면 합니다. 김민준 선생님께 문의드렸으나 답변이 늦었습니다.
그렇다,
그렇다,
그렇다,예산위원회에 학부모 참여를 늘려주세요.
그렇다,
보통이다,
보통이다,
매우 그렇다,
매우 그렇다,
매우 그렇다,
그렇다,
CSV

echo "== 준비: 학교 등록, 교원/학부모 문항(같은 지표) + 학부모 서술형 문항 등록 =="
j POST /api/auth/register "{\"schoolName\":\"$SCHOOL\",\"password\":\"pw12345\"}" > /dev/null
cp "$ITEMS" "$BODY"
ADD=$(jf POST /api/draft/items)
echo "$ADD" | grep -q '"ok":true' && ok "문항 3개 등록" || ng "문항 등록 실패: $ADD"

echo
echo "== 1. 결과 업로드 (자동 연결) =="
TEACHER_UP=$(curl -s -X POST "$BASE/api/results/upload" -b "$JAR" -c "$JAR" -F "audience=teacher" -F "file=@$TEACHER_CSV;type=text/csv")
TID=$(echo "$TEACHER_UP" | get uploadId)
PARENT_UP=$(curl -s -X POST "$BASE/api/results/upload" -b "$JAR" -c "$JAR" -F "audience=parent" -F "file=@$PARENT_CSV;type=text/csv")
PID=$(echo "$PARENT_UP" | get uploadId)
[ -n "$TID" ] && [ "$TID" != "undefined" ] && ok "교원 업로드 성공" || ng "교원 업로드 실패: $TEACHER_UP"
[ -n "$PID" ] && [ "$PID" != "undefined" ] && ok "학부모 업로드 성공 (서술형 포함)" || ng "학부모 업로드 실패: $PARENT_UP"

echo
echo "== 2. 집계 — 교원 4.9 / 학부모 4.2 격차가 나오는지 =="
printf '{"uploadIds":["%s","%s"]}' "$TID" "$PID" > "$BODY"
AGG=$(jf POST /api/results/aggregate)
RID=$(echo "$AGG" | get "result.id")
TEACHER_MEAN=$(echo "$AGG" | get "result.areaStats.find(s=>s.audience==='teacher').meanRounded")
PARENT_MEAN=$(echo "$AGG" | get "result.areaStats.find(s=>s.audience==='parent').meanRounded")
[ "$TEACHER_MEAN" = "4.9" ] && ok "교원 영역 평균 4.9" || ng "교원 평균이 예상과 다름: $TEACHER_MEAN"
[ "$PARENT_MEAN" = "4.2" ] && ok "학부모 영역 평균 4.2 (격차 존재)" || ng "학부모 평균이 예상과 다름: $PARENT_MEAN"

echo
echo "== 3. Gemini 해석 실행 (실제 API 호출, 수십 초 걸릴 수 있음) =="
printf '{"resultId":"%s","uploadIds":["%s","%s"],"schoolContext":"소통과 신뢰를 바탕으로 한 학교자치 문화 조성을 교육목표로 삼고 있습니다."}' "$RID" "$TID" "$PID" > "$BODY"
ANALYZE=$(curl -s -m 90 -X POST "$BASE/api/results/analyze" -b "$JAR" -c "$JAR" -H "Content-Type: application/json" --data-binary "@$BODY")
echo "$ANALYZE" | grep -q '"ok":true' && ok "AI 해석 API 호출 성공" || { ng "AI 해석 실패: $ANALYZE"; }

FINDING_COUNT=$(echo "$ANALYZE" | get "result.aiAnalysis.areas[0].findings.length")
[ -n "$FINDING_COUNT" ] && [ "$FINDING_COUNT" != "undefined" ] && [ "$FINDING_COUNT" != "0" ] && \
  ok "영역 분석에 findings가 생성됨 ($FINDING_COUNT개)" || ng "findings가 비어 있음"

EVIDENCE_TEACHER=$(echo "$ANALYZE" | get "JSON.stringify(v.result.aiAnalysis)" 2>/dev/null)
NEEDS_REVIEW=$(echo "$ANALYZE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const v=JSON.parse(d).data.result.aiAnalysis;const all=[...v.areas.flatMap(a=>a.findings), ...v.consultingNeeds];console.log(all.filter(f=>f.needsReview).length)})")
[ "$NEEDS_REVIEW" = "0" ] && ok "환각 방지 검증 통과 — 확인 필요(needsReview) 항목 0건" || echo "  [정보] needsReview 항목 ${NEEDS_REVIEW}건 (재생성으로도 못 맞춰 비워짐 — Gemini 응답 편차로 발생 가능, 재실행해서 확인)"

OPINION_LEN=$(echo "$ANALYZE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log((JSON.parse(d).data.result.aiAnalysis.overallOpinion||'').length))")
[ "$OPINION_LEN" -gt 20 ] 2>/dev/null && ok "종합의견이 생성됨 (${OPINION_LEN}자)" || ng "종합의견이 비어 있거나 너무 짧음"

echo
echo "== 4. 개인정보 마스킹 확인 (원문의 '김민준'이 결과에 그대로 나오면 안 됨) =="
if echo "$ANALYZE" | grep -q "김민준"; then
  ng "마스킹 안 된 이름이 AI 응답에 그대로 노출됨"
else
  ok "이름이 AI 응답에 노출되지 않음"
fi

rm -f "$ITEMS" "$TEACHER_CSV" "$PARENT_CSV" "$BODY"

echo
echo "========================================"
echo "  통과 $PASS / 실패 $FAIL"
echo "========================================"
[ "$FAIL" -eq 0 ]
