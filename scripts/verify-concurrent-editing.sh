#!/usr/bin/env bash
# 동시 편집 수용 기준 검증
#
# 사용법:
#   npm run build && npx next start -p 3100 &
#   bash scripts/verify-concurrent-editing.sh
#
# 같은 학교 계정으로 두 사람(A/B)이 동시에 작업하는 상황을 재현해,
# 어느 쪽 작업도 사라지지 않는지 확인합니다.
# 식별자를 ASCII로 쓰는 것은 콘솔 인코딩 영향을 받지 않기 위함입니다.
set -u
SP="${TMPDIR:-/tmp}"
BASE="http://127.0.0.1:3100"
A="$SP/jA.txt"; B="$SP/jB.txt"
rm -f "$A" "$B"
SCHOOL="verify-$RANDOM"
PASS=0; FAIL=0
ok(){ echo "  [PASS] $1"; PASS=$((PASS+1)); }
ng(){ echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

j(){ curl -s -X "$1" "$BASE$2" -b "$3" -c "$3" -H "Content-Type: application/json" ${4:+-d "$4"}; }
code(){ curl -s -o /dev/null -w "%{http_code}" -X "$1" "$BASE$2" -b "$3" -c "$3" -H "Content-Type: application/json" ${4:+-d "$4"}; }

ids(){ j GET /api/draft "$1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d).data;console.log(b.items.map(i=>i.id).sort().join(','))})"; }
field(){ j GET /api/draft "$1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d).data;console.log(eval('b.'+process.argv[1]))})" "$2"; }
has(){ case ",$1," in *",$2,"*) return 0;; *) return 1;; esac }

mk(){ printf '{"items":[{"id":"%s","sourceQuestionId":"src","audience":"%s","sourceRow":1,"area":"A1","subarea":"S1","indicator":"I1","originalQuestion":"q","editedQuestion":"q","responseType":"likert_5","order":%s}]}' "$1" "$2" "$3"; }

echo "== 준비: 같은 학교 계정으로 두 브라우저(A/B) 로그인 =="
j POST /api/auth/register "$A" "{\"schoolName\":\"$SCHOOL\",\"password\":\"pw12345\"}" > /dev/null
j POST /api/auth/login    "$B" "{\"schoolName\":\"$SCHOOL\",\"password\":\"pw12345\"}" > /dev/null
echo "  완료 ($SCHOOL)"

echo
echo "== 1. 서로 다른 대상을 동시에 편집 (기존 유실 시나리오) =="
j POST /api/draft/items "$A" "$(mk itemA teacher 1)" > /dev/null
j POST /api/draft/items "$B" "$(mk itemB parent  1)" > /dev/null
IDS=$(ids "$A")
has "$IDS" itemA && ok "A(교원)의 문항이 남아 있다" || ng "A의 문항이 사라졌다"
has "$IDS" itemB && ok "B(학부모)의 문항이 남아 있다" || ng "B의 문항이 사라졌다"

echo
echo "== 2. 같은 대상의 다른 문항을 동시에 편집 =="
j POST /api/draft/items "$A" "$(mk itemA2 teacher 2)" > /dev/null
j POST /api/draft/items "$B" "$(mk itemB2 teacher 3)" > /dev/null
IDS=$(ids "$A")
has "$IDS" itemA2 && ok "A의 추가 문항이 남아 있다" || ng "A의 추가 문항이 사라졌다"
has "$IDS" itemB2 && ok "B의 추가 문항이 남아 있다" || ng "B의 추가 문항이 사라졌다"

echo
echo "== 3. 같은 문항을 동시에 수정 → 조용한 덮어쓰기 금지 =="
C1=$(code PATCH /api/draft/items/itemA "$A" '{"expectedRev":0,"patch":{"editedQuestion":"edited-by-A"},"updatedBy":"kim"}')
C2=$(code PATCH /api/draft/items/itemA "$B" '{"expectedRev":0,"patch":{"editedQuestion":"edited-by-B"},"updatedBy":"lee"}')
[ "$C1" = "200" ] && ok "먼저 저장한 A는 성공(200)" || ng "A 저장 실패($C1)"
[ "$C2" = "409" ] && ok "나중에 저장한 B는 충돌 안내(409)" || ng "B가 조용히 덮어썼다($C2)"
CONF=$(j PATCH /api/draft/items/itemA "$B" '{"expectedRev":0,"patch":{"editedQuestion":"x"}}')
echo "$CONF" | grep -q '"reason":"conflict"' && ok "409 본문에 conflict 표시가 있다" || ng "conflict 표시 없음"
echo "$CONF" | grep -q '"updatedBy":"kim"' && ok "409 본문이 마지막 수정자를 알려준다" || ng "수정자 정보 없음"
echo "$CONF" | grep -q 'edited-by-A' && ok "409 본문에 최신 내용이 실려 있다" || ng "최신 내용 없음"

echo
echo "== 4. 한쪽이 순서 변경 중 다른 쪽이 문항 추가 =="
j PATCH /api/draft/items/itemA2 "$A" '{"expectedRev":0,"patch":{"order":0.5}}' > /dev/null
j POST /api/draft/items "$B" "$(mk itemB3 teacher 4)" > /dev/null
IDS=$(ids "$A")
has "$IDS" itemB3 && ok "순서 변경 중 추가된 B의 문항이 남아 있다" || ng "B의 문항이 사라졌다"
has "$IDS" itemA2 && ok "A가 옮긴 문항도 남아 있다" || ng "A의 문항이 사라졌다"
ORD=$(j GET /api/draft "$A" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d).data;console.log(b.items.find(i=>i.id==='itemA2').order)})")
[ "$ORD" = "0.5" ] && ok "분수 인덱스로 자기 문서만 바뀐다 (order=0.5)" || ng "순서 값이 예상과 다르다($ORD)"

echo
echo "== 5. 동기화가 변경분만 내려주는가 =="
SINCE=$(field "$A" "since")
j POST /api/draft/items "$B" "$(mk itemLate staff 9)" > /dev/null
SYNC=$(j GET "/api/draft/sync?since=$SINCE&sessionId=sessA" "$A")
echo "$SYNC" | grep -q 'itemLate' && ok "새 변경이 동기화로 전달된다" || ng "새 변경이 전달되지 않았다"
echo "$SYNC" | grep -q 'itemB2' && ng "바뀌지 않은 것까지 전부 내려왔다" || ok "바뀐 것만 내려온다"

echo
echo "== 6. 삭제가 동기화로 전달되는가 (tombstone) =="
SINCE2=$(field "$B" "since")
j DELETE /api/draft/items/itemB "$A" '{"expectedRev":0}' > /dev/null
SYNC=$(j GET "/api/draft/sync?since=$SINCE2&sessionId=sessB" "$B")
echo "$SYNC" | grep -q '"deleted":\["itemB"\]' && ok "삭제가 상대에게 전달된다" || ng "삭제가 전달되지 않았다"
IDS=$(ids "$B")
has "$IDS" itemB && ng "삭제된 문항이 목록에 남아 있다" || ok "삭제된 문항은 목록에서 빠진다"

echo
echo "== 7. 메타를 동시에 수정 =="
REV=$(field "$A" "draft.rev")
j PATCH /api/draft/meta "$A" "{\"expectedRev\":$REV,\"patch\":{\"title\":\"title-A\"}}" > /dev/null
C=$(code PATCH /api/draft/meta "$B" "{\"expectedRev\":$REV,\"patch\":{\"title\":\"title-B\"}}")
[ "$C" = "409" ] && ok "메타도 조용히 덮어쓰지 않는다(409)" || ng "메타가 덮어써졌다($C)"

echo
echo "== 8. 접속자 표시 =="
j POST /api/draft/presence "$A" '{"sessionId":"sessA","displayName":"kim","audience":"teacher"}' > /dev/null
P=$(j POST /api/draft/presence "$B" '{"sessionId":"sessB","displayName":"lee","audience":"parent"}')
echo "$P" | grep -q '"displayName":"kim"' && ok "B 화면에 A가 접속자로 보인다" || ng "접속자가 보이지 않는다"
echo "$P" | grep -q '"sessionId":"sessB"' && ng "자기 자신이 접속자 목록에 들어갔다" || ok "자기 자신은 목록에서 빠진다"

echo
echo "== 9. 폐기된 전체 덮어쓰기 PUT =="
C=$(code PUT /api/draft "$A" '{"draft":{}}')
{ [ "$C" = "405" ] || [ "$C" = "404" ]; } && ok "PUT /api/draft 는 더 이상 받지 않는다($C)" || ng "PUT이 아직 살아 있다($C)"

echo
echo "========================================"
echo "  통과 $PASS / 실패 $FAIL"
echo "========================================"
[ "$FAIL" -eq 0 ]
