#!/usr/bin/env bash
# End-to-end smoke test against a running API + MongoDB.
#
# Usage: bash scripts/smoke.sh [base-url]
#
# The suite makes roughly a dozen credential requests, and the API limits
# /auth/login to 20 per 15 minutes per IP, so it can only run once per window.
# Start a fresh server first (scripts/start-dev.sh) or the auth-dependent checks
# will fail with 429. Run `npm run seed` at least once beforehand, since the
# catalogue checks need seeded data.
set -uo pipefail

BASE="${1:-http://127.0.0.1:5000}"
API="$BASE/api"
PASS=0
FAIL=0
STAMP=$(date +%s)
EMAIL="smoke+$STAMP@example.com"
PASSWORD="SmokeTest!234"

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()   { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %s\n' "$*"; }

# check <label> <json> <jq-ish python expr on `d`>
check() {
  local label="$1" body="$2" expr="$3"
  if python3 -c "
import json,sys
try:
    r=json.loads(sys.argv[1])
except Exception as e:
    print('  (not json: %s) %s' % (e, sys.argv[1][:200])); sys.exit(2)
d = r.get('data') if isinstance(r,dict) else None
v = eval(sys.argv[2], {'d': d, 'r': r, 'len': len, 'any': any, 'all': all, 'str': str, 'bool': bool, 'int': int})
sys.exit(0 if v else 1)
" "$body" "$expr" 2>/dev/null; then ok "$label"; else bad "$label"; printf '       got: %s\n' "$(echo "$body" | head -c 400)"; fi
}

req() { # method path [json-body] [extra curl args]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$API$path" -H 'Content-Type: application/json' ${TOKEN:+-H "Authorization: Bearer $TOKEN"} -d "$body"
  else
    curl -sS -X "$method" "$API$path" ${TOKEN:+-H "Authorization: Bearer $TOKEN"}
  fi
}

say "0. Pre-flight"
# A saturated auth limiter would otherwise show up as ~6 confusing failures.
LIMITER=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' -d '{"email":"preflight@probe.invalid","password":"probe"}')
if [ "$LIMITER" = "429" ]; then
  bad "auth rate limit is already saturated"
  printf '       Restart the API (scripts/start-dev.sh) or wait for the window to reset.\n'
  printf '\n\033[1m================ 0 passed, 1 failed ================\033[0m\n'
  exit 1
fi
ok "auth rate limit has headroom"

say "0b. Seeded catalogue present"
H=$(curl -sS "$BASE/health")
check "GET /health returns ok" "$H" "d['status']=='ok' and d['database']=='connected'"

say "1. Auth"
R=$(req POST /auth/register "{\"name\":\"Smoke Tester\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
check "register creates a user" "$R" "d['user']['email']=='$EMAIL'"
TOKEN=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['data']['tokens']['accessToken'])" "$R" 2>/dev/null)
REFRESH=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['data']['tokens']['refreshToken'])" "$R" 2>/dev/null)
[ -n "$TOKEN" ] && ok "access token issued" || bad "access token missing"

check "duplicate email is rejected" "$(req POST /auth/register "{\"name\":\"Dup\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")" "r['success']==False"
check "short password is rejected" "$(req POST /auth/register '{"name":"X","email":"x@y.z","password":"123"}')" "r['success']==False"
check "login with bad password fails" "$(req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"wrongpass\"}")" "r['success']==False"
check "login succeeds" "$(req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")" "d['user']['email']=='$EMAIL'"
check "GET /auth/me identifies the user" "$(req GET /auth/me)" "d['email']=='$EMAIL'"
check "unauthenticated request is 401" "$(curl -sS $API/auth/me)" "r['success']==False and r['code']=='UNAUTHORIZED'"
check "garbage bearer token is 401" "$(curl -sS $API/auth/me -H 'Authorization: Bearer not.a.jwt')" "r['success']==False"

say "2. Profile & derived metrics"
check "update profile" "$(req PATCH /users/profile '{"age":28,"gender":"male","heightCm":176,"weightKg":82.5,"fitnessLevel":"intermediate","activityLevel":"moderate","goals":["weight_loss","general_fitness"]}')" "d['heightCm']==176"
check "BMI derived from profile" "$(req POST /users/bmi '{}')" "19<=d['bmi']<=30 and d['category'] in ('Normal','Overweight')"
check "calorie target computed" "$(req GET /users/profile)" "d['dailyCalorieTarget']>1200"
check "water target computed" "$(req GET /users/profile)" "d['dailyWaterTargetMl']>=1500"
check "profile rejects impossible height" "$(req PATCH /users/profile '{"heightCm":5}')" "r['success']==False"
check "log weight" "$(req POST /users/weight '{"weightKg":81.8,"date":"'$(date +%F)'"}')" "d['weightKg']==81.8"
check "notification settings round-trip" "$(req PATCH /users/notification-settings '{"waterReminders":false}')" "d['waterReminders']==False"
check "account summary" "$(req GET /users/account)" "isinstance(d,dict)"

say "3. Catalogue (public-ish reads)"
check "workouts are seeded" "$(req GET '/workouts?limit=5')" "len(d['items'])>0"
check "food catalogue is seeded" "$(req GET '/nutrition/foods?limit=5')" "len(d['items'])>0"
check "workout filter by category" "$(req GET '/workouts?category=strength&limit=5')" "all(i['category']=='strength' for i in d['items'])"
check "yoga routines are seeded" "$(req GET '/yoga?limit=5')" "len(d['items'])>0"
check "foods are seeded" "$(req GET '/nutrition/foods?search=rice&limit=5')" "len(d['items'])>0"
check "food categories" "$(req GET /nutrition/foods/categories)" "len(d)>0"
check "bad id is a 400 not a 500" "$(req GET /workouts/not-an-id)" "r['success']==False"

say "4. Workout session lifecycle"
WID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['data']['items'][0]['_id'])" "$(req GET '/workouts?limit=1')" 2>/dev/null)
S=$(req POST "/workouts/$WID/start")
check "start a session" "$S" "d['session']['status']=='in_progress'"
SID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['data']['session']['_id'])" "$S" 2>/dev/null)
check "starting twice resumes, not duplicates" "$(req POST "/workouts/$WID/start")" "d['resumed']==True"
check "active session is retrievable" "$(req GET /workouts/session/active)" "d is not None"
C=$(req POST "/workouts/$WID/complete" '{"durationMinutes":42,"caloriesBurned":380,"exercisesCompleted":9,"notes":"smoke","perceivedEffort":7}')
check "complete the session" "$C" "d['session']['status']=='completed'"
check "completion credits the streak" "$(req GET /progress/streak)" "d['current']>=1"
check "history records the session" "$(req GET '/workouts/history?limit=5')" "len(d['items'])>0"
check "stats aggregate" "$(req GET /workouts/stats)" "d['totalSessions']>=1"
check "abandon needs an active session" "$(req DELETE "/workouts/sessions/$SID")" "r['success']==False and r['code']=='NOT_FOUND'"

say "5. Nutrition"
F=$(req GET '/nutrition/foods?search=chicken&limit=1')
FID=$(python3 -c "import json,sys; d=json.loads(sys.argv[1])['data']['items']; print(d[0]['_id'] if d else '')" "$F" 2>/dev/null)
check "create a food log" "$(req POST /nutrition/food-logs "{\"foodId\":\"$FID\",\"grams\":150,\"mealType\":\"lunch\"}")" "d['nutrition']['calories']>0"
check "today's nutrition summary" "$(req GET '/nutrition/today')" "d['consumed']>0 and d['target']>0"
check "nutrition history" "$(req GET "/nutrition/history?from=$(date +%F)&to=$(date +%F)")" "len(d)>0"
check "negative grams is rejected" "$(req POST /nutrition/food-logs "{\"foodId\":\"$FID\",\"grams\":-5,\"mealType\":\"lunch\"}")" "r['success']==False"
check "generate a meal plan" "$(req POST '/nutrition/meals/generate?plan=vegetarian')" "len(d)>0"

say "6. Hydration"
check "log water" "$(req POST /hydration/log '{"amountMl":500}')" "d['log']['amountMl']==500 and d['totalMl']==500"
check "hydration today" "$(req GET /hydration/today)" "d['totalMl']>=500"
check "water limit per entry is enforced" "$(req POST /hydration/log '{"amountMl":9000}')" "r['success']==False"

say "7. Progress, goals, achievements"
check "progress overview" "$(req GET /progress)" "d is not None"
check "daily series" "$(req GET '/progress/daily?days=7')" "len(d)>0"
check "weekly report" "$(req GET '/progress/weekly')" "d is not None"
check "monthly report" "$(req GET '/progress/monthly')" "d is not None"
G=$(req POST /goals '{"title":"Lose 5 kg","goalType":"weight_loss","targetValue":76,"unit":"kg","source":"weight"}')
check "create a counting-down goal" "$G" "d['progressPercent']==0"
GID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['data']['_id'])" "$G" 2>/dev/null)
check "baseline captured from profile" "$(req GET "/goals/$GID")" "d['baselineValue']>=81"
check "progress recomputed on update" "$(req POST "/goals/$GID/progress" '{"currentValue":78.5}')" "56<=d['progressPercent']<=58"
check "count-up goal syncs immediately" "$(req POST /goals '{"title":"Run 20 times","goalType":"general_fitness","targetValue":20,"unit":"sessions","source":"workout_count"}')" "d['baselineValue']==0 and d['currentValue']==1 and d['progressPercent']==5"
check "goal stats" "$(req GET /goals/stats)" "d['total']>=2"
check "achievements evaluate" "$(req POST /achievements/evaluate)" "d is not None"
check "achievement summary" "$(req GET /achievements/summary)" "isinstance(d,dict)"

say "8. AI (local model + deterministic fallback)"
A=$(req GET /ai/status)
check "AI status reports a model" "$A" "d['model']['modelId']!='none'"
check "AI availability is reported" "$A" "isinstance(d['available'],bool)"
check "recommendations are served" "$(req GET /ai/recommendations)" "d['primary'] is not None"
check "recommendations need no auth-free key" "$(req GET /ai/recommendations?type=nutrition)" "d['provider'] in ('rules','transformers')"
check "assistant answers a question" "$(req POST '/ai/assistant?message=How%20many%20calories%20should%20I%20eat%3F')" "len(d['reply'])>20"
check "assistant conversation is persisted" "$(req GET /ai/assistant/conversations)" "len(d)>0"
check "assistant flags a medical question" "$(req POST '/ai/assistant?message=Should%20I%20take%20insulin%20for%20my%20diabetes%3F')" "'insulin' in d['reply'].lower() or 'doctor' in d['reply'].lower()"
check "recommendation history" "$(req GET /ai/recommendations/history)" "len(d)>0"

say "9. Notifications & community"
check "notification list" "$(req GET /notifications)" "'items' in d or isinstance(d,list)"
check "unread count" "$(req GET /notifications/unread-count)" "'unreadCount' in d"
P=$(req POST /community '{"content":"Finished my first 5k. Smoke test was worth it.","postType":"achievement","category":"general"}')
check "create a post" "$P" "d['content'].startswith('Finished')"
PID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['data']['_id'])" "$P" 2>/dev/null)
check "feed lists the post" "$(req GET '/community?limit=10')" "any(i['_id']=='$PID' for i in d['items'])"
check "like a post" "$(req POST "/community/$PID/like")" "d['liked']==True"
check "like is idempotent" "$(req POST "/community/$PID/like")" "d['liked']==False"
check "comment on a post" "$(req POST "/community/$PID/comments" '{"content":"Nice work"}')" "d['commentCount']==1"
check "own post is deletable" "$(req DELETE "/community/$PID")" "d['deleted']==True"

say "10. Dashboard (one aggregated request)"
D=$(req GET /dashboard)
check "dashboard returns all sections" "$D" "all(k in d for k in ('today','week','goals','streak','achievementSummary'))"
check "dashboard calorie ring" "$D" "d['today']['calories']['target']>0"
check "dashboard water ring" "$D" "d['today']['water']['targetMl']>0"
check "dashboard carries a disclaimer" "$D" "'disclaimer' in d"

say "11. Refresh rotation & reuse detection"
NEW=$(req POST /auth/refresh "{\"refreshToken\":\"$REFRESH\"}")
check "refresh issues a new pair" "$NEW" "d['tokens']['accessToken']!=''"
R2=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['data']['tokens']['refreshToken'])" "$NEW" 2>/dev/null)
check "reusing a rotated token is blocked" "$(req POST /auth/refresh "{\"refreshToken\":\"$REFRESH\"}")" "r['success']==False"
check "the family is revoked after reuse" "$(req POST /auth/refresh "{\"refreshToken\":\"$R2\"}")" "r['success']==False"

say "12. Security & error handling"
check "unknown route 404s" "$(req GET /does-not-exist)" "r['success']==False"
OTHER_EMAIL="other+$STAMP@example.com"
curl -sS -X POST $API/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"Other User\",\"email\":\"$OTHER_EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null
OTHER_TOKEN=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['data']['tokens']['accessToken'])" "$(curl -sS -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$OTHER_EMAIL\",\"password\":\"$PASSWORD\"}")" 2>/dev/null)
# A brand-new user has no weight on record. A weight goal must be refused rather
# than silently created with a baseline of 0, which would pin the goal at 0%
# forever and hide real change.
check "weight goal without a recorded weight is refused" \
  "$(curl -sS -X POST $API/goals -H "Authorization: Bearer $OTHER_TOKEN" -H 'Content-Type: application/json' \
    -d '{"title":"Lose 5 kg","goalType":"weight_loss","targetValue":75,"unit":"kg","source":"weight"}')" \
  "r['success']==False and r['code']=='BAD_REQUEST'"
check "a manual goal still works with no weight recorded" \
  "$(curl -sS -X POST $API/goals -H "Authorization: Bearer $OTHER_TOKEN" -H 'Content-Type: application/json' \
    -d '{"title":"Walk 3 times","goalType":"general_fitness","targetValue":3,"unit":"sessions","source":"manual","currentValue":0}')" \
  "d['progressPercent']==0"
check "an empty progress body is refused" \
  "$(curl -sS -X POST $API/goals/$GID/progress -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')" \
  "r['success']==False"
check "another user cannot read my goal" "$(curl -sS $API/goals/$GID -H "Authorization: Bearer $OTHER_TOKEN")" "r['success']==False and r['code'] in ('NOT_FOUND','FORBIDDEN')"
check "another user cannot update my goal" "$(curl -sS -X POST $API/goals/$GID/progress -H "Authorization: Bearer $OTHER_TOKEN" -H 'Content-Type: application/json' -d '{"currentValue":999}')" "r['success']==False"
check "malformed id is rejected" "$(req GET '/goals/000000000000000000000000')" "r['success']==False"
check "error shape is consistent" "$(req POST /auth/login '{"email":"nope"}')" "r['success']==False and 'code' in r and 'message' in r and 'errors' in r"

say "13. Logout & account deletion"
check "logout succeeds" "$(req POST /auth/logout "{\"refreshToken\":\"$R2\"}")" "d['loggedOut']==True"
check "change password" "$(req POST /auth/change-password "{\"currentPassword\":\"$PASSWORD\",\"newPassword\":\"NewSmoke!234\"}")" "d['changed']==True"
check "old password no longer works" "$(req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")" "r['success']==False"
check "login with new password" "$(req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"NewSmoke!234\"}")" "d['user']['email']=='$EMAIL'"
TOKEN=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['data']['tokens']['accessToken'])" "$(req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"NewSmoke!234\"}")" 2>/dev/null)
check "account deletion cascades" "$(req DELETE /users/account)" "d['deleted']==True"
check "the deleted user can no longer authenticate" "$(req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"NewSmoke!234\"}")" "r['success']==False"

printf '\n\033[1m================ %d passed, %d failed ================\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
