#!/usr/bin/env bash
# 결과 파일 업로드 → 열 연결 → 집계 검증 (docs/implementation.md 6단계)
#
# 사용법:
#   npm run build && npx next start -p 3100 &
#   bash scripts/verify-results.sh
#
#   개발 서버로 돌릴 때:
#   BASE_URL=http://127.0.0.1:3000 bash scripts/verify-results.sh
#
# 가이드북 51쪽 공식(scripts/verify-scoring.mjs)이 실제로 업로드→매칭→집계 API를
# 거쳐서도 같은 숫자를 내는지 확인합니다. 순수 계산만 검증하는 verify-scoring.mjs와
# 달리, 여기는 열 자동/수동 연결과 학생 학년별 분해까지 API 경로로 검증합니다.
set -u
SP="${TMPDIR:-/tmp}"
BASE="${BASE_URL:-http://127.0.0.1:3100}"
JAR="$SP/jResults.txt"
# curl.exe(mingw) -F "file=@경로"는 MSYS 자동 경로 변환을 안 받아 /tmp 경로를 못 엽니다.
# 그래서 이 파일만 현재 디렉터리(리포 루트) 기준 상대경로로 둡니다.
CSV="./.verify-results-tmp.csv"
rm -f "$JAR" "$CSV"
SCHOOL="verify-results-$RANDOM"
PASS=0; FAIL=0
ok(){ echo "  [PASS] $1"; PASS=$((PASS+1)); }
ng(){ echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

j(){ curl -s -X "$1" "$BASE$2" -b "$JAR" -c "$JAR" -H "Content-Type: application/json" ${3:+-d "$3"}; }
get(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const v=JSON.parse(d).data;console.log(eval('v.'+process.argv[1]))}catch(e){console.log('<parse-error>')}})" "$1"; }

# ⚠️ curl.exe(mingw)는 -d "인라인 문자열"에 한글이 있으면 명령줄 인자 인코딩 과정에서
# 깨뜨립니다(콘솔 코드페이지 변환). 그래서 한글이 들어가는 요청 본문은 전부 파일로 써서
# --data-binary "@파일"로 보냅니다. verify-concurrent-editing.sh가 식별자를 ASCII로만
# 쓰는 것도 같은 이유입니다.
BODY="./.verify-results-body.json"
jf(){ curl -s -X "$1" "$BASE$2" -b "$JAR" -c "$JAR" -H "Content-Type: application/json" --data-binary "@$BODY"; }

echo "== 준비: 학교 로그인, 학생용 5점 척도 문항 1개 등록 =="
j POST /api/auth/register "{\"schoolName\":\"$SCHOOL\",\"password\":\"pw123456\"}" > /dev/null
ITEM_ID="verify-item-1"
printf '{"items":[{"id":"%s","sourceQuestionId":"src","groupId":"g1","audience":"student","sourceRow":1,"area":"Ⅰ. 협력적 학교자치문화","subarea":"Ⅰ-1. 소통과 협력의 학교자치","indicator":"지표1","originalQuestion":"질문1","editedQuestion":"질문1","responseType":"likert_5","order":1}]}' "$ITEM_ID" > "$BODY"
ADD=$(jf POST /api/draft/items)
echo "$ADD" | grep -q '"ok":true' && ok "문항 등록" || { ng "문항 등록 실패: $ADD"; }

printf '학년,질문1\n4학년,매우 그렇다\n4학년,그렇다\n5학년,보통이다\n' > "$CSV"

echo
echo "== 1. 업로드 시 자동 연결 (구글폼 스냅숏이 없으니 둘 다 unmatched 예상) =="
UPLOAD=$(curl -s -X POST "$BASE/api/results/upload" -b "$JAR" -c "$JAR" -F "audience=student" -F "file=@$CSV;type=text/csv")
UPLOAD_ID=$(echo "$UPLOAD" | get uploadId)
[ -n "$UPLOAD_ID" ] && [ "$UPLOAD_ID" != "undefined" ] && ok "업로드 성공 (uploadId=$UPLOAD_ID)" || ng "업로드 실패: $UPLOAD"
STATUS0=$(echo "$UPLOAD" | get "columns[0].match.status")
STATUS1=$(echo "$UPLOAD" | get "columns[1].match.status")
[ "$STATUS0" = "unmatched" ] && ok "학년 열은 구글폼 스냅숏 없이는 자동 연결 안 됨(unmatched)" || ng "학년 열 상태 예상과 다름: $STATUS0"
[ "$STATUS1" = "question" ] && ok "질문1 열은 현재 문항 텍스트로 자동 연결됨(current-text)" || ng "질문1 열이 연결되지 않음: $STATUS1 ($UPLOAD)"

echo
echo "== 2. 수동 연결로 학년 열 지정 =="
printf '{"uploadId":"%s","mapping":[{"column":"학년","isGrade":true},{"column":"질문1","questionId":"%s"}]}' "$UPLOAD_ID" "$ITEM_ID" > "$BODY"
MAP=$(jf POST /api/results/map)
echo "$MAP" | grep -q '"ok":true' && ok "연결표 저장" || ng "연결표 저장 실패: $MAP"

echo
echo "== 3. 집계 실행 — 가이드북 공식과 학생 학년별 분해 확인 =="
AGG=$(j POST /api/results/aggregate "{\"uploadIds\":[\"$UPLOAD_ID\"]}")
echo "$AGG" | grep -q '"ok":true' && ok "집계 성공" || { ng "집계 실패: $AGG"; }

OVERALL_MEAN=$(echo "$AGG" | get "result.questionStats.find(s=>s.grade===undefined).mean")
[ "$OVERALL_MEAN" = "4" ] && ok "전체 평균 (5+4+3)/3 = 4.0" || ng "전체 평균이 예상과 다름: $OVERALL_MEAN"

G4_MEAN=$(echo "$AGG" | get "result.questionStats.find(s=>s.grade===4).mean")
[ "$G4_MEAN" = "4.5" ] && ok "4학년만 평균 (5+4)/2 = 4.5" || ng "4학년 평균이 예상과 다름: $G4_MEAN"

G5_MEAN=$(echo "$AGG" | get "result.questionStats.find(s=>s.grade===5).mean")
[ "$G5_MEAN" = "3" ] && ok "5학년만 평균 3.0" || ng "5학년 평균이 예상과 다름: $G5_MEAN"

AREA_MEAN=$(echo "$AGG" | get "result.areaStats[0].mean")
AREA_GRADE=$(echo "$AGG" | get "result.areaStats[0].grade4")
[ "$AREA_MEAN" = "4" ] && ok "영역 평균 = 문항 평균과 동일(문항 1개) 4.0" || ng "영역 평균이 예상과 다름: $AREA_MEAN"
[ "$AREA_GRADE" = "매우 우수" ] && ok "영역 판정 = 매우 우수" || ng "영역 판정이 예상과 다름: $AREA_GRADE"

RESP_COUNT=$(echo "$AGG" | get "result.responsesByAudience.student")
[ "$RESP_COUNT" = "3" ] && ok "학생 응답자 수 = 3" || ng "학생 응답자 수가 예상과 다름: $RESP_COUNT"

rm -f "$CSV" "$BODY"

echo
echo "========================================"
echo "  통과 $PASS / 실패 $FAIL"
echo "========================================"
[ "$FAIL" -eq 0 ]
