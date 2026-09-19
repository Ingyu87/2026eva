#!/usr/bin/env bash
# 평가지표 및 현황 XLSX 검증 — docs/implementation.md 8-1
#
# 사용법:
#   ADMIN_PASSWORD=... npm run build && npx next start -p 3100 &
#   ADMIN_PASSWORD=... bash scripts/verify-indicator-xlsx.sh
#
# 실제 2025 템플릿(templates/indicator-status-2025.xlsx, gitignore 처리됨)이 있어야
# 돌아갑니다. 관리자로 템플릿을 등록하고, 학교 계정으로 문항을 만들어 실제로 XLSX를
# 내려받은 뒤 그 파일을 다시 열어 값이 맞는지 확인합니다.
#
# 확인하는 것:
#   1. 템플릿 자동 인식 (셀 주소 하드코딩 없이 헤더/잠금 해제 셀로 구조를 찾음)
#   2. 문항 수·4단계 판정이 올바른 칸에 들어가는지
#   3. "기타" 행 합산, "합계" 행(수식) 보존
#   4. ⚠️ 이 파일을 매년 재사용할 때 작년 값이 그대로 남지 않는지(지난 값 지우기)
set -u
BASE="${BASE_URL:-http://127.0.0.1:3100}"
TEMPLATE="templates/indicator-status-2025.xlsx"
AJAR="/tmp/jIndicatorAdmin.txt"
JAR="/tmp/jIndicatorSchool.txt"
BODY="./.verify-indicator-body.json"
ITEMS="./.verify-indicator-items.json"
TEACHER_CSV="./.verify-indicator-teacher.csv"
PARENT_CSV="./.verify-indicator-parent.csv"
OUT_XLSX="./.verify-indicator-output.xlsx"
rm -f "$AJAR" "$JAR" "$BODY" "$ITEMS" "$TEACHER_CSV" "$PARENT_CSV" "$OUT_XLSX"
PASS=0; FAIL=0
ok(){ echo "  [PASS] $1"; PASS=$((PASS+1)); }
ng(){ echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

if [ ! -f "$TEMPLATE" ]; then
  echo "  [건너뜀] $TEMPLATE 이 없습니다. 실제 템플릿이 있는 환경에서만 돌릴 수 있습니다."
  exit 0
fi
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "  [건너뜀] ADMIN_PASSWORD 환경변수가 없습니다."
  exit 0
fi

j(){ curl -s -X "$1" "$BASE$2" -b "$JAR" -c "$JAR" -H "Content-Type: application/json" ${3:+-d "$3"}; }
jf(){ curl -s -X "$1" "$BASE$2" -b "$JAR" -c "$JAR" -H "Content-Type: application/json" --data-binary "@$BODY"; }
get(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const v=JSON.parse(d).data;console.log(eval('v.'+process.argv[1]))}catch(e){console.log('<parse-error>')}})" "$1"; }
readXlsxCell(){ node -e "
(async () => {
  const wb = new (require('exceljs')).Workbook();
  await wb.xlsx.readFile(process.argv[1]);
  const sheet = wb.getWorksheet('학교평가');
  const v = sheet.getCell(process.argv[2]).value;
  console.log(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
})();
" "$OUT_XLSX" "$1"; }

echo "== 준비: 관리자 로그인, 템플릿 등록 =="
printf '{"password":"%s"}' "$ADMIN_PASSWORD" > "$BODY"
curl -s -X POST "$BASE/api/admin/login" -b "$AJAR" -c "$AJAR" -H "Content-Type: application/json" --data-binary "@$BODY" > /dev/null
UPLOAD_TEMPLATE=$(curl -s -X POST "$BASE/api/admin/templates/indicator-xlsx" -b "$AJAR" -c "$AJAR" -F "file=@$TEMPLATE;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
echo "$UPLOAD_TEMPLATE" | grep -q '"ok":true' && ok "템플릿 등록 및 자동 인식 성공" || { ng "템플릿 등록 실패: $UPLOAD_TEMPLATE"; exit 1; }

echo
echo "== 1. 학교 계정 준비 — 문항 2개(정식 지표 1개 + 미등록 지표 1개) =="
SCHOOL="verify-xlsx-$RANDOM"
printf '{"schoolName":"%s","password":"pw12345"}' "$SCHOOL" > "$BODY"
jf POST /api/auth/register > /dev/null
cat > "$ITEMS" <<'JSON'
{"items":[
  {"id":"vx-1","sourceQuestionId":"s1","groupId":"g1","audience":"teacher","sourceRow":1,"area":"Ⅰ. 협력적 학교자치문화","subarea":"Ⅰ-1. 소통과 협력의 학교자치 기반 조성","indicator":"학교 비전 공유 및 실현","originalQuestion":"q1","editedQuestion":"학교 비전을 잘 공유하고 있다","responseType":"likert_5","order":1},
  {"id":"vx-2","sourceQuestionId":"s1","groupId":"g1","audience":"parent","sourceRow":1,"area":"Ⅰ. 협력적 학교자치문화","subarea":"Ⅰ-1. 소통과 협력의 학교자치 기반 조성","indicator":"학교 비전 공유 및 실현","originalQuestion":"q1","editedQuestion":"학교 비전을 잘 공유하고 있다","responseType":"likert_5","order":1},
  {"id":"vx-3","sourceQuestionId":"s2","groupId":"g2","audience":"teacher","sourceRow":2,"area":"Ⅰ. 협력적 학교자치문화","subarea":"Ⅰ-1. 소통과 협력의 학교자치 기반 조성","indicator":"우리 학교만의 특별한 지표","originalQuestion":"q3","editedQuestion":"우리 학교만의 특별한 활동을 잘 하고 있다","responseType":"likert_5","order":2}
]}
JSON
cp "$ITEMS" "$BODY"
ADD=$(jf POST /api/draft/items)
echo "$ADD" | grep -q '"ok":true' && ok "문항 등록" || ng "문항 등록 실패: $ADD"

echo '{"expectedRev":0,"patch":{"mode":"annual"}}' > "$BODY"
jf PATCH /api/draft/meta > /dev/null

printf '학교 비전을 잘 공유하고 있다,우리 학교만의 특별한 활동을 잘 하고 있다\n매우 그렇다,매우 그렇다\n매우 그렇다,그렇다\n그렇다,그렇다\n' > "$TEACHER_CSV"
printf '학교 비전을 잘 공유하고 있다\n그렇다\n그렇다\n보통이다\n' > "$PARENT_CSV"

echo
echo "== 2. 결과 업로드·집계 =="
TID=$(curl -s -X POST "$BASE/api/results/upload" -b "$JAR" -c "$JAR" -F "audience=teacher" -F "file=@$TEACHER_CSV;type=text/csv" | get uploadId)
PID=$(curl -s -X POST "$BASE/api/results/upload" -b "$JAR" -c "$JAR" -F "audience=parent" -F "file=@$PARENT_CSV;type=text/csv" | get uploadId)
printf '{"uploadIds":["%s","%s"]}' "$TID" "$PID" > "$BODY"
AGG=$(jf POST /api/results/aggregate)
RID=$(echo "$AGG" | get "result.id")
echo "$AGG" | grep -q '"ok":true' && ok "집계 성공 (resultId=$RID)" || { ng "집계 실패: $AGG"; exit 1; }

echo
echo "== 3. XLSX 내려받기 =="
STATUS=$(curl -s -o "$OUT_XLSX" -w "%{http_code}" "$BASE/api/export/indicator-xlsx?resultId=$RID" -b "$JAR" -c "$JAR")
[ "$STATUS" = "200" ] && ok "다운로드 성공 (200)" || { ng "다운로드 실패 ($STATUS)"; exit 1; }

echo
echo "== 4. 내용 확인 =="
SCHOOL_CELL=$(readXlsxCell M3)
[ "$SCHOOL_CELL" = "$SCHOOL" ] && ok "학교명 기입됨" || ng "학교명이 예상과 다름: $SCHOOL_CELL (기대: $SCHOOL)"

TEACHER_COUNT=$(readXlsxCell I6)
[ "$TEACHER_COUNT" = "1" ] && ok "정식 지표 행에 교원 문항 수 1 기입" || ng "I6 값이 예상과 다름: $TEACHER_COUNT"

TEACHER_RESULT=$(readXlsxCell M6)
[ "$TEACHER_RESULT" = "매우 우수" ] && ok "교원 4단계 판정 = 매우 우수" || ng "M6 값이 예상과 다름: $TEACHER_RESULT"

PARENT_RESULT=$(readXlsxCell L6)
[ "$PARENT_RESULT" = "우수" ] && ok "학부모 4단계 판정 = 우수" || ng "L6 값이 예상과 다름: $PARENT_RESULT"

ETC_COUNT=$(readXlsxCell I10)
[ "$ETC_COUNT" = "1" ] && ok "미등록 지표가 '기타' 행으로 합산됨" || ng "기타 행(I10) 값이 예상과 다름: $ETC_COUNT"

STALE=$(readXlsxCell H12)
if [ "$STALE" = "" ] || [ "$STALE" = "null" ]; then
  ok "다른 지표의 작년 값이 지워짐(재사용 안전)"
else
  ng "작년 값이 안 지워짐: H12=$STALE"
fi

FORMULA=$(readXlsxCell I11)
echo "$FORMULA" | grep -q "SUM" && ok "합계 행 수식이 그대로 보존됨" || ng "합계 행이 훼손됨: $FORMULA"

rm -f "$ITEMS" "$TEACHER_CSV" "$PARENT_CSV" "$BODY" "$OUT_XLSX"

echo
echo "========================================"
echo "  통과 $PASS / 실패 $FAIL"
echo "========================================"
[ "$FAIL" -eq 0 ]
