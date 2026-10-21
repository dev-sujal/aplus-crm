// End-to-end checks for: Aadhaar field, list pagination, certificate name + edit,
// and editing an enrollment's fee.
// Usage: node scripts/crm-features-smoke.mjs
// Requires the API running (default http://localhost:5000/api/v1) and the seeded owner.
const BASE = process.env.API_URL ?? "http://localhost:5000/api/v1";
const EMAIL = process.env.OWNER_EMAIL ?? "owner@aplus.test";
const PASSWORD = process.env.OWNER_PASSWORD ?? "ChangeMe123!";
let token = "";
let failures = 0;

async function call(method, path, body, rawToken) {
  const t = rawToken ?? token;
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get("content-type") ?? "";
  let data = null;
  if (type.includes("application/json")) {
    try { data = await res.json(); } catch { /* empty */ }
  } else if (type.includes("pdf")) {
    data = Buffer.from(await res.arrayBuffer());
  }
  return { status: res.status, data, type };
}
function check(name, cond, extra = "") {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name} ${extra}`); }
}
const idOf = (o) => o?.id ?? o?._id;
const section = (name) => console.log(`\n== ${name}`);

const login = await call("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
token = login.data?.accessToken;
check("owner login", !!token, JSON.stringify(login.data));
const stamp = Date.now();
// Unique, valid 12-digit Aadhaar numbers per run (the API rejects duplicates).
const aadhaar = (n) => `2${String(stamp % 1e10).padStart(10, "0")}${n}`;
const A1 = aadhaar(1), A2 = aadhaar(2);
const spaced = (a) => `${a.slice(0, 4)} ${a.slice(4, 8)} ${a.slice(8)}`;
const hyphenated = (a) => `${a.slice(0, 4)}-${a.slice(4, 8)}-${a.slice(8)}`;

/* ------------------------------------------------------------------ */
section("Aadhaar number");
const a1 = await call("POST", "/students", { firstName: "Ravi", fatherName: "Mohan", lastName: "Sharma", email: `r${stamp}@x.com`, aadharNumber: spaced(A1) });
check("create with spaced aadhaar -> stored as 12 digits", a1.status === 201 && a1.data.aadharNumber === A1, JSON.stringify(a1.data));
const sid = idOf(a1.data);
const hyph = await call("POST", "/students", { firstName: "H", lastName: "Y", aadharNumber: hyphenated(A2) });
check("hyphenated aadhaar accepted", hyph.status === 201 && hyph.data.aadharNumber === A2);
for (const bad of ["12345", "1234567890ab", "1234 5678 9012 3"]) {
  const r = await call("POST", "/students", { firstName: "B", lastName: "D", aadharNumber: bad });
  check(`reject invalid aadhaar "${bad}" -> 400`, r.status === 400, String(r.status));
}
const dup = await call("POST", "/students", { firstName: "Dup", lastName: "Licate", aadharNumber: A1 });
check("duplicate aadhaar -> 409 with clear message", dup.status === 409 && /Aadhaar/.test(dup.data?.error?.message ?? ""), JSON.stringify(dup.data));
const noA1 = await call("POST", "/students", { firstName: "No", lastName: "Aadhaar1" });
const noA2 = await call("POST", "/students", { firstName: "No", lastName: "Aadhaar2" });
check("aadhaar is optional; several students may leave it blank", noA1.status === 201 && noA2.status === 201 && noA1.data.aadharNumber === "");
const selfUpdate = await call("PATCH", `/students/${sid}`, { aadharNumber: A1, phone: "9999999999" });
check("re-saving a student with their own aadhaar is not a duplicate", selfUpdate.status === 200 && selfUpdate.data.aadharNumber === A1);
const partial = await call("PATCH", `/students/${sid}`, { firstName: "Ravindra" });
check("partial PATCH keeps aadhaar/email/phone (no silent blanking)",
  partial.status === 200 && partial.data.aadharNumber === A1 && partial.data.email === `r${stamp}@x.com` && partial.data.phone === "9999999999",
  JSON.stringify(partial.data));
const clear = await call("PATCH", `/students/${sid}`, { aadharNumber: "" });
check("aadhaar can be cleared", clear.status === 200 && clear.data.aadharNumber === "");
await call("PATCH", `/students/${sid}`, { aadharNumber: A1 });
const steal = await call("PATCH", `/students/${idOf(noA1.data)}`, { aadharNumber: A1 });
check("cannot give another student an existing aadhaar -> 409", steal.status === 409);
const got = await call("GET", `/students/${sid}`);
check("GET student returns aadharNumber", got.data?.aadharNumber === A1);

/* ------------------------------------------------------------------ */
section("Pagination (courses / students)");
const cTag = `PG${stamp}`;
for (let i = 1; i <= 25; i++) await call("POST", "/courses", { title: `${cTag} course ${String(i).padStart(2, "0")}`, fee: 1000 + i });
const seenCourses = new Set();
let courseTotal = 0, courseTotalPages = 0, courseLastLen = 0;
for (let p = 1; p <= 3; p++) {
  const r = await call("GET", `/courses?search=${cTag}&page=${p}&limit=10`);
  courseTotal = r.data.total; courseTotalPages = r.data.totalPages; courseLastLen = r.data.items.length;
  r.data.items.forEach((c) => seenCourses.add(c.id));
  check(`courses page ${p}: page/limit echoed`, r.status === 200 && r.data.page === p && r.data.limit === 10);
}
check("courses: total=25, totalPages=3, last page has 5", courseTotal === 25 && courseTotalPages === 3 && courseLastLen === 5);
check("courses: 25 distinct rows across 3 pages (no repeats/skips)", seenCourses.size === 25);
const beyond = await call("GET", `/courses?search=${cTag}&page=9&limit=10`);
check("page beyond the end -> empty items, 200", beyond.status === 200 && beyond.data.items.length === 0 && beyond.data.total === 25);
const badPage = await call("GET", `/courses?page=0`);
check("page=0 -> 400", badPage.status === 400);

const sTag = `Pgs${stamp}`;
for (let i = 1; i <= 23; i++) await call("POST", "/students", { firstName: sTag, lastName: `N${String(i).padStart(2, "0")}` });
const seenStudents = new Set();
let sTotal = 0, sPages = 0;
for (let p = 1; p <= 3; p++) {
  const r = await call("GET", `/students?search=${sTag}&page=${p}&limit=10`);
  sTotal = r.data.total; sPages = r.data.totalPages;
  r.data.items.forEach((s) => seenStudents.add(s.id));
}
check("students: total=23, totalPages=3", sTotal === 23 && sPages === 3);
check("students: 23 distinct rows across pages", seenStudents.size === 23);

/* ------------------------------------------------------------------ */
section("Pagination (questions / tests / assignments / attempts)");
const pgCourse = await call("POST", "/courses", { title: `Quiz ${stamp}`, fee: 5000 });
const pgCourseId = idOf(pgCourse.data);
const qIds = [];
for (let i = 1; i <= 7; i++) {
  const o1 = crypto.randomUUID(), o2 = crypto.randomUUID();
  const q = await call("POST", "/tests/questions", { course: pgCourseId, type: "single", text: `Q${i} ${stamp}`, options: [{ id: o1, text: "a" }, { id: o2, text: "b" }], correctOptionIds: [o1], marks: 1 });
  qIds.push(idOf(q.data));
}
const seenQ = new Set();
for (let p = 1; p <= 3; p++) {
  const r = await call("GET", `/tests/questions?course=${pgCourseId}&page=${p}&limit=3`);
  r.data.items.forEach((q) => seenQ.add(q.id));
  if (p === 1) check("questions: total=7, totalPages=3", r.data.total === 7 && r.data.totalPages === 3);
}
check("questions: 7 distinct rows across pages", seenQ.size === 7);

const testIds = [];
for (let i = 1; i <= 5; i++) {
  const t = await call("POST", "/tests", { course: pgCourseId, title: `Test ${i} ${stamp}`, questionIds: [qIds[0]], status: "published" });
  testIds.push(idOf(t.data));
}
const seenT = new Set();
for (let p = 1; p <= 3; p++) {
  const r = await call("GET", `/tests?course=${pgCourseId}&page=${p}&limit=2`);
  r.data.items.forEach((t) => seenT.add(t.id));
  if (p === 1) check("tests: total=5, totalPages=3", r.data.total === 5 && r.data.totalPages === 3);
}
check("tests: 5 distinct rows across pages", seenT.size === 5);

// 5 students enrolled in the quiz course, each assigned test #1 -> 5 assignments
const enrolled = [];
for (let i = 1; i <= 5; i++) {
  const s = await call("POST", "/students", { firstName: `Asg${stamp}`, lastName: `S${i}` });
  await call("POST", "/enrollments", { student: idOf(s.data), course: pgCourseId });
  enrolled.push(idOf(s.data));
}
const asg = await call("POST", `/tests/${testIds[0]}/assignments`, { studentIds: enrolled });
check("assign test to 5 students", asg.status === 201 && asg.data.length === 5);
const seenA = new Set();
let aMeta = null;
for (let p = 1; p <= 3; p++) {
  const r = await call("GET", `/tests/assignments?test=${testIds[0]}&page=${p}&limit=2`);
  r.data.items.forEach((a) => seenA.add(a.id));
  if (p === 1) aMeta = r.data;
}
check("assignments: paginated shape {items,total,page,limit,totalPages}", aMeta && Array.isArray(aMeta.items) && aMeta.total === 5 && aMeta.totalPages === 3 && aMeta.limit === 2 && aMeta.page === 1, JSON.stringify(aMeta)?.slice(0, 160));
check("assignments: 5 distinct rows across pages", seenA.size === 5);
const aDefault = await call("GET", `/tests/assignments?test=${testIds[0]}`);
check("assignments: default limit applies (20)", aDefault.data.limit === 20 && aDefault.data.items.length === 5);
const aBad = await call("GET", `/tests/assignments?limit=500`);
check("assignments: limit>100 -> 400", aBad.status === 400);

/* ------------------------------------------------------------------ */
section("Certificates: name field + edit");
const course = await call("POST", "/courses", { title: `Cert Course ${stamp}`, fee: 10000 });
const courseId = idOf(course.data);
const stu = await call("POST", "/students", { firstName: "Priya", fatherName: "Rajesh", lastName: "Patel" });
const stuId = idOf(stu.data);
const stu2 = await call("POST", "/students", { firstName: "Amit", fatherName: "Suresh", lastName: "Verma" });
const enr1 = await call("POST", "/enrollments", { student: stuId, course: courseId });
const enr2 = await call("POST", "/enrollments", { student: idOf(stu2.data), course: courseId });
check("enrol two students", enr1.status === 201 && enr2.status === 201);

const c1 = await call("POST", "/certificates", { enrollment: idOf(enr1.data), issueDate: "2026-10-01", completionDate: "2026-09-30" });
check("no name supplied -> defaults to 'first father last'", c1.status === 201 && c1.data.studentName === "Priya Rajesh Patel", JSON.stringify(c1.data.studentName));
const c1Id = c1.data.credentialId;
const c2 = await call("POST", "/certificates", { enrollment: idOf(enr2.data), studentName: "  Amit S. Verma  " });
check("custom name at generation is used (and trimmed)", c2.status === 201 && c2.data.studentName === "Amit S. Verma", JSON.stringify(c2.data.studentName));
const c2Id = c2.data.credentialId;

const v2 = await call("GET", `/verify/${c2Id}`);
check("verify page shows the custom name", v2.data?.valid === true && v2.data.studentName === "Amit S. Verma");
const pdf2 = await call("GET", `/certificates/${c2Id}/download`);
check("PDF downloads for custom-name certificate", pdf2.status === 200 && pdf2.type.includes("pdf") && pdf2.data.slice(0, 4).toString() === "%PDF");

// Changing the student's profile name must NOT alter an issued certificate
await call("PATCH", `/students/${stuId}`, { lastName: "Changed" });
const afterRename = await call("GET", `/certificates/${c1Id}`);
check("issued certificate name is a snapshot (student rename doesn't change it)", afterRename.data.studentName === "Priya Rajesh Patel");

const list = await call("GET", `/certificates/student/${stuId}`);
check("student certificate list includes the name", list.status === 200 && list.data[0].certificate?.studentName === "Priya Rajesh Patel");

// ---- edit
const e1 = await call("PATCH", `/certificates/${c1Id}`, { studentName: "Priya R. Patel", issueDate: "2026-10-15", completionDate: "2026-10-10", issuerName: "Director" });
check("edit name/issue/completion/issuer -> 200", e1.status === 200 && e1.data.studentName === "Priya R. Patel" && e1.data.issuerName === "Director" && e1.data.issueDate.startsWith("2026-10-15") && e1.data.completionDate.startsWith("2026-10-10"), JSON.stringify(e1.data)?.slice(0, 250));
check("credential ID unchanged by edit", e1.data.credentialId === c1Id);
const persisted = await call("GET", `/certificates/${c1Id}`);
check("edit persisted in DB", persisted.data.studentName === "Priya R. Patel" && persisted.data.issueDate.startsWith("2026-10-15") && persisted.data.issuerName === "Director");
const vEdited = await call("GET", `/verify/${c1Id}`);
check("verify reflects edited record", vEdited.data.studentName === "Priya R. Patel" && vEdited.data.issueDate.startsWith("2026-10-15") && vEdited.data.completionDate.startsWith("2026-10-10"));
const onlyDate = await call("PATCH", `/certificates/${c1Id}`, { issueDate: "2026-11-01" });
check("partial edit (date only) keeps name/issuer", onlyDate.status === 200 && onlyDate.data.studentName === "Priya R. Patel" && onlyDate.data.issuerName === "Director");
const clearCompletion = await call("PATCH", `/certificates/${c1Id}`, { completionDate: null });
check("completion date can be cleared", clearCompletion.status === 200 && clearCompletion.data.completionDate === null);
const pdfEdited = await call("GET", `/certificates/${c1Id}/download`);
check("PDF still renders after edit", pdfEdited.status === 200 && pdfEdited.data.slice(0, 4).toString() === "%PDF" && pdfEdited.data.length > 5000, String(pdfEdited.data?.length));
check("empty name -> 400", (await call("PATCH", `/certificates/${c1Id}`, { studentName: "   " })).status === 400);
check("invalid date -> 400", (await call("PATCH", `/certificates/${c1Id}`, { issueDate: "not-a-date" })).status === 400);
check("null issue date -> 400", (await call("PATCH", `/certificates/${c1Id}`, { issueDate: null })).status === 400);
check("empty body -> 400", (await call("PATCH", `/certificates/${c1Id}`, {})).status === 400);
check("unknown credential -> 404", (await call("PATCH", `/certificates/CC-0000-9999`, { studentName: "X" })).status === 404);
check("name > 120 chars -> 400", (await call("PATCH", `/certificates/${c1Id}`, { studentName: "x".repeat(121) })).status === 400);
check("unauthenticated edit -> 401", (await call("PATCH", `/certificates/${c1Id}`, { studentName: "X" }, "bad")).status === 401);
const dupCert = await call("POST", "/certificates", { enrollment: idOf(enr1.data) });
check("second certificate for same enrollment still blocked (409)", dupCert.status === 409);

/* ------------------------------------------------------------------ */
section("Enrollment fee edit");
const feeCourse = await call("POST", "/courses", { title: `Fee Course ${stamp}`, fee: 10000 });
const feeCourseId = idOf(feeCourse.data);
const fs1 = await call("POST", "/students", { firstName: "Fee", lastName: "Student" });
const fenr = await call("POST", "/enrollments", { student: idOf(fs1.data), course: feeCourseId, fee: 8000, batch: "Morning" });
const enrId = idOf(fenr.data);
check("enroll at discounted fee 8000", fenr.status === 201 && fenr.data.fee === 8000);
const pay = await call("POST", `/fees/${enrId}/payments`, { amount: 3000, mode: "cash" });
check("record 3000 payment", pay.status === 201 && pay.data.amountPaid === 3000 && pay.data.amountRemaining === 5000);

const low = await call("PATCH", `/enrollments/${enrId}`, { fee: 2000 });
check("fee below collected amount -> 400 with clear message", low.status === 400 && /already collected/.test(low.data?.error?.message ?? ""), JSON.stringify(low.data));
const stillEnr = await call("GET", `/enrollments?student=${idOf(fs1.data)}`);
check("rejected edit left the enrollment fee untouched (8000)", stillEnr.data[0].fee === 8000);
const high = await call("PATCH", `/enrollments/${enrId}`, { fee: 12000 });
check("fee above course fee -> 400", high.status === 400 && /course fee/.test(high.data?.error?.message ?? ""), JSON.stringify(high.data));
check("negative fee -> 400", (await call("PATCH", `/enrollments/${enrId}`, { fee: -5 })).status === 400);
check("non-numeric fee -> 400", (await call("PATCH", `/enrollments/${enrId}`, { fee: "abc" })).status === 400);

const ok = await call("PATCH", `/enrollments/${enrId}`, { fee: 5000, batch: "Evening" });
check("valid fee edit -> 200, populated response", ok.status === 200 && ok.data.fee === 5000 && ok.data.batch === "Evening" && ok.data.course?.title && ok.data.student?.firstName, JSON.stringify(ok.data)?.slice(0, 200));
const feeAfter = await call("GET", `/fees/${enrId}`);
check("Fee record synced: total 5000, paid 3000, remaining 2000", feeAfter.data.totalFee === 5000 && feeAfter.data.amountPaid === 3000 && feeAfter.data.amountRemaining === 2000, JSON.stringify(feeAfter.data)?.slice(0, 200));
const up = await call("PATCH", `/enrollments/${enrId}`, { fee: 10000 });
check("fee can be raised back up to the course fee", up.status === 200 && (await call("GET", `/fees/${enrId}`)).data.amountRemaining === 7000);
const exact = await call("PATCH", `/enrollments/${enrId}`, { fee: 3000 });
check("fee equal to amount collected -> fully paid (remaining 0)", exact.status === 200 && (await call("GET", `/fees/${enrId}`)).data.amountRemaining === 0);
const summary = await call("GET", "/fees/summary");
check("fee summary endpoint still works", summary.status === 200 && typeof summary.data.totalPending === "number");
const sameFee = await call("PATCH", `/enrollments/${enrId}`, { fee: 3000, batch: "Night" });
check("same fee + batch change is fine", sameFee.status === 200 && sameFee.data.batch === "Night");

// Non-owner admin with students:edit
const adminEmail = `adm${stamp}@x.com`;
const mk = await call("POST", "/users", { firstName: "Ad", lastName: "Min", email: adminEmail, password: "Password123!", permissions: { students: { view: true, edit: true } } });
check("create admin with students edit", mk.status === 201, JSON.stringify(mk.data));
const adminLogin = await call("POST", "/auth/login", { email: adminEmail, password: "Password123!" });
const adminToken = adminLogin.data?.accessToken;
const adminFee = await call("PATCH", `/enrollments/${enrId}`, { fee: 4000 }, adminToken);
check("admin cannot change fee -> 403", adminFee.status === 403, String(adminFee.status));
const adminBatch = await call("PATCH", `/enrollments/${enrId}`, { batch: "Weekend" }, adminToken);
check("admin can still change batch", adminBatch.status === 200 && adminBatch.data.batch === "Weekend");
const adminSame = await call("PATCH", `/enrollments/${enrId}`, { fee: 3000, batch: "Weekend2" }, adminToken);
check("admin sending unchanged fee alongside batch is OK", adminSame.status === 200);
check("unknown enrollment -> 404", (await call("PATCH", `/enrollments/64b000000000000000000000`, { fee: 1 })).status === 404);

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
