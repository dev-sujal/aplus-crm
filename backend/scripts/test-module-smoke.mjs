// End-to-end smoke test for the Test module. Usage: node scripts/test-module-smoke.mjs
// Requires the API running (default http://localhost:5000/api/v1) and the seeded owner.
const BASE = process.env.API_URL ?? "http://localhost:5000/api/v1";
const EMAIL = process.env.OWNER_EMAIL ?? "owner@aplus.test";
const PASSWORD = process.env.OWNER_PASSWORD ?? "ChangeMe123!";
let token = "";
let failures = 0;

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}
function check(name, cond, extra = "") {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name} ${extra}`); }
}
const idOf = (o) => o?.id ?? o?._id;

const login = await call("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
token = login.data?.accessToken;
check("login", !!token, JSON.stringify(login.data));

const stamp = Date.now();
const course = await call("POST", "/courses", { title: `Course ${stamp}`, fee: 1000 });
const courseId = idOf(course.data);
check("create course", course.status === 201, JSON.stringify(course.data));
const student = await call("POST", "/students", { firstName: "Asha", lastName: "K", email: `a${stamp}@x.com` });
const studentId = idOf(student.data);
const student2 = await call("POST", "/students", { firstName: "Not", lastName: "Enrolled" });
const student2Id = idOf(student2.data);
check("create students", student.status === 201 && student2.status === 201);
const enr = await call("POST", "/enrollments", { student: studentId, course: courseId });
check("enroll student", enr.status === 201, JSON.stringify(enr.data));

const mk = (text, type, n, correct, extra = {}) => ({
  course: courseId, type, text, marks: 2, topic: "T1", difficulty: "easy",
  options: Array.from({ length: n }, (_, i) => ({ id: `o${i}`, text: `Opt ${i}` })),
  correctOptionIds: correct, ...extra,
});
const q1 = await call("POST", "/tests/questions", mk("Capital of India?", "single", 4, ["o0"]));
const q2 = await call("POST", "/tests/questions", mk("Pick primes", "multiple", 4, ["o0", "o1"]));
check("create questions", q1.status === 201 && q2.status === 201, JSON.stringify(q1.data) + JSON.stringify(q2.data));
const q1Id = idOf(q1.data), q2Id = idOf(q2.data);
check("question has id field", !!q1.data?.id, "(frontend relies on `id`)");

const lq = await call("GET", `/tests/questions?course=${courseId}&limit=100`);
check("list questions", lq.status === 200 && lq.data?.items?.length === 2, JSON.stringify(lq.data)?.slice(0, 200));
const lqs = await call("GET", `/tests/questions?course=${courseId}&search=Capital`);
check("search questions", lqs.status === 200 && lqs.data?.items?.length === 1, JSON.stringify(lqs.data)?.slice(0, 200));
const uq = await call("PATCH", `/tests/questions/${q1Id}`, { text: "Capital of India (edited)?", marks: 3 });
check("edit question", uq.status === 200 && uq.data?.text.includes("edited"), JSON.stringify(uq.data)?.slice(0, 200));

const t = await call("POST", "/tests", {
  course: courseId, title: "Unit Test 1", questionIds: [q2Id, q1Id], timeLimitMinutes: 20,
  passPercentage: 50, negativeMarking: false, shuffleQuestions: false, status: "draft",
});
const testId = idOf(t.data);
check("create test", t.status === 201, JSON.stringify(t.data)?.slice(0, 300));
check("test keeps chosen question order", t.data?.questions?.[0]?.questionId === q2Id);
const lt = await call("GET", `/tests?course=${courseId}&limit=50`);
check("list tests (has id, course populated)", lt.status === 200 && lt.data?.items?.[0]?.id && lt.data?.items?.[0]?.course?.title, JSON.stringify(lt.data)?.slice(0, 300));
const lts = await call("GET", `/tests?course=${courseId}&search=Unit`);
check("search tests", lts.status === 200 && lts.data?.items?.length === 1, JSON.stringify(lts.data)?.slice(0, 200));
const ut = await call("PATCH", `/tests/${testId}`, { title: "Unit Test 1 (edited)", timeLimitMinutes: 25 });
check("edit test", ut.status === 200 && ut.data?.title.includes("edited"), JSON.stringify(ut.data)?.slice(0, 200));

const badAssign = await call("POST", `/tests/${testId}/assignments`, { studentIds: [studentId] });
check("cannot assign draft test", badAssign.status === 400);
const pub = await call("POST", `/tests/${testId}/publish`);
check("publish test", pub.status === 200 && pub.data?.status === "published", JSON.stringify(pub.data)?.slice(0, 200));

const eligible = await call("GET", `/tests/${testId}/eligible-students`);
check("eligible students endpoint lists enrolled only", eligible.status === 200 && eligible.data?.length === 1 && idOf(eligible.data[0]) === studentId, JSON.stringify(eligible.data)?.slice(0, 200));

const notEnrolled = await call("POST", `/tests/${testId}/assignments`, { studentIds: [student2Id] });
check("reject non-enrolled student", notEnrolled.status === 400);
const asg = await call("POST", `/tests/${testId}/assignments`, { studentIds: [studentId], attemptsAllowed: 2, availabilityStart: null, availabilityEnd: null });
check("assign test", asg.status === 201 && asg.data?.length === 1, JSON.stringify(asg.data)?.slice(0, 300));
const asgId = idOf(asg.data?.[0]); const shareToken = asg.data?.[0]?.shareToken;
check("assignment has id & test title populated", !!asgId && asg.data?.[0]?.test?.title, JSON.stringify(asg.data?.[0])?.slice(0, 300));
const la = await call("GET", `/tests/assignments?test=${testId}`);
check("list assignments", la.status === 200 && la.data?.length === 1 && la.data[0].id, JSON.stringify(la.data)?.slice(0, 200));

token = ""; // student is anonymous from here
const pub1 = await call("GET", `/tests/share/${shareToken}`);
check("public assignment loads & hides answers", pub1.status === 200 && pub1.data?.test?.title && pub1.data.test.questions[0].snapshot.correctOptionIds.length === 0 && !pub1.data.test.createdBy, JSON.stringify(pub1.data)?.slice(0, 400));
const start = await call("POST", `/tests/share/${shareToken}/start`);
check("start attempt", start.status === 200 && start.data?.test?.questions?.length === 2, JSON.stringify(start.data)?.slice(0, 400));
check("start hides correct answers", start.data?.test?.questions?.every((q) => q.snapshot.correctOptionIds.length === 0));
const start2 = await call("POST", `/tests/share/${shareToken}/start`);
check("start is idempotent (resumes)", start2.status === 200 && start2.data?.attemptId === start.data?.attemptId);
const answers = [
  { questionId: q2Id, selectedOptionIds: ["o0", "o1"], markedForReview: false },
  { questionId: q1Id, selectedOptionIds: ["o0"], markedForReview: true },
];
const prog = await call("PATCH", `/tests/share/${shareToken}/progress`, { currentQuestionIndex: 1, answers });
check("save progress", prog.status === 200 && prog.data?.saved, JSON.stringify(prog.data)?.slice(0, 200));
const sub = await call("POST", `/tests/share/${shareToken}/submit`, { answers });
check("submit full marks", sub.status === 200 && sub.data?.result?.percentage === 100, JSON.stringify(sub.data?.result)?.slice(0, 300));
const res = await call("GET", `/tests/share/${shareToken}/result`);
check("public result", res.status === 200 && res.data?.visible && res.data.result.score === 5, JSON.stringify(res.data?.result)?.slice(0, 200));
const again = await call("POST", `/tests/share/${shareToken}/start`);
check("2nd attempt allowed (attemptsAllowed=2)", again.status === 200 && again.data?.attemptId !== start.data?.attemptId, JSON.stringify(again.data)?.slice(0, 200));
const sub2 = await call("POST", `/tests/share/${shareToken}/submit`, { answers: [{ questionId: q1Id, selectedOptionIds: ["o3"] }] });
check("submit failing attempt", sub2.status === 200 && sub2.data?.result?.passed === false, JSON.stringify(sub2.data)?.slice(0, 200));
const third = await call("POST", `/tests/share/${shareToken}/start`);
check("3rd attempt blocked", third.status === 403);

token = login.data.accessToken;
const att = await call("GET", `/tests/attempts?test=${testId}`);
check("list attempts", att.status === 200 && att.data?.total === 2 && att.data.items[0].id, JSON.stringify(att.data)?.slice(0, 200));
const attF = await call("GET", `/tests/attempts?test=${testId}&passed=false`);
check("filter attempts passed=false", attF.status === 200 && attF.data?.total === 1, JSON.stringify(attF.data)?.slice(0, 200));
const attT = await call("GET", `/tests/attempts?test=${testId}&passed=true`);
check("filter attempts passed=true", attT.status === 200 && attT.data?.total === 1);
const one = await call("GET", `/tests/attempts/${att.data.items[0].id}`);
check("attempt detail", one.status === 200 && one.data?.testSnapshot?.questions?.length === 2);
const rt = await call("PATCH", `/tests/assignments/${asgId}/retake`);
check("allow retake", rt.status === 200 && rt.data?.attemptsAllowed === 3, JSON.stringify(rt.data)?.slice(0, 200));
const rv = await call("PATCH", `/tests/assignments/${asgId}/revoke`);
check("revoke", rv.status === 200 && rv.data?.status === "revoked");
token = "";
const afterRevoke = await call("POST", `/tests/share/${shareToken}/start`);
check("revoked link cannot start", afterRevoke.status === 403, String(afterRevoke.status));
token = login.data.accessToken;

check("analytics overview", (await call("GET", "/tests/analytics/overview")).status === 200);
const ta = await call("GET", `/tests/analytics/tests/${testId}`);
check("test analytics", ta.status === 200 && ta.data?.attemptsCount === 2, JSON.stringify(ta.data)?.slice(0, 200));
check("course comparison", (await call("GET", "/tests/analytics/courses")).status === 200);
check("leaderboard", (await call("GET", "/tests/analytics/leaderboard")).status === 200);

const arch = await call("POST", `/tests/${testId}/archive`);
check("archive test", arch.status === 200 && arch.data?.status === "archived");
const delUsed = await call("DELETE", `/tests/questions/${q1Id}`);
check("delete used question -> archived", delUsed.status === 200 && delUsed.data?.status === "archived", String(delUsed.status));
const badId = await call("GET", `/tests/questions/not-an-id`);
check("bad id -> 400 not 500", badId.status === 400, String(badId.status));
const badFilter = await call("GET", `/tests/assignments?test=zzz`);
check("bad assignment filter -> 400 not 500", badFilter.status === 400, String(badFilter.status));

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
