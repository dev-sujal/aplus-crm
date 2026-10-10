import * as React from "react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { api, setAccessToken } from "#lib/api-client"
import QuestionBankPage from "#pages/tests/QuestionBankPage"
import TestListPage from "#pages/tests/TestListPage"
import TestAssignmentsPage from "#pages/tests/TestAssignmentsPage"
import TestResultsPage from "#pages/tests/TestResultsPage"
import TestAnalyticsPage from "#pages/tests/TestAnalyticsPage"
import TestsDashboardPage from "#pages/tests/TestsDashboardPage"
import PublicTestPage from "#pages/tests/PublicTestPage"

const stamp = Date.now()
const COURSE = `UI Course ${stamp}`
const T1 = `UI Unit Test ${stamp}`
const T2 = `${T1} v2`
const STUDENT_FIRST = `Zed${stamp}`
let courseId = ""
let shareToken = ""

function mount(ui: React.ReactElement, path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {ui}
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>
  )
}
const select = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const dialog = () => screen.findByRole("dialog")

beforeAll(async () => {
  const res: any = await api.post("/auth/login", { email: "owner@aplus.test", password: "ChangeMe123!" })
  setAccessToken(res.accessToken)
  const course: any = await api.post("/courses", { title: COURSE, fee: 500 })
  courseId = course.id ?? course._id
  const s1: any = await api.post("/students", { firstName: STUDENT_FIRST, lastName: "Enrolled", email: `e${stamp}@x.com` })
  await api.post("/students", { firstName: "Outsider", lastName: `NoEnroll${stamp}` })
  await api.post("/enrollments", { student: s1.id ?? s1._id, course: courseId })
})
afterEach(cleanup)

describe("Test module UI (real pages, real API)", () => {
  it("dashboard cards link to the sub pages", async () => {
    mount(<TestsDashboardPage />)
    const links = screen.getAllByText("Open").map((el) => el.closest("a")!)
    expect(links.length).toBe(5)
    expect(links.every(Boolean)).toBe(true)
    expect(links[0].getAttribute("href")).toBe("/tests/questions")
  })

  it("question bank: create two questions, edit one", async () => {
    mount(<QuestionBankPage />)
    const courseSelect = (await screen.findAllByRole("combobox"))[0]
    await waitFor(() => expect(within(courseSelect).getByText(COURSE)).toBeTruthy())
    select(courseSelect, courseId)

    for (const [text, type, correct] of [["What is 2+2?", "single", 1], ["Pick even numbers", "multiple", 2]] as const) {
      await waitFor(() => expect((screen.getByRole("button", { name: /Add question/ }) as HTMLButtonElement).disabled).toBe(false))
      fireEvent.click(screen.getByRole("button", { name: /Add question/ }))
      const dlg = await dialog()
      fireEvent.change(within(dlg).getByLabelText("Type"), { target: { value: type } })
      fireEvent.change(within(dlg).getByLabelText("Question text"), { target: { value: text } })
      const inputs = within(dlg).getAllByPlaceholderText(/Option \d/)
      fireEvent.change(inputs[0], { target: { value: "2" } })
      fireEvent.change(inputs[1], { target: { value: "4" } })
      // add 2 more options
      fireEvent.click(within(dlg).getByRole("button", { name: /Add option/ }))
      fireEvent.click(within(dlg).getByRole("button", { name: /Add option/ }))
      const more = within(dlg).getAllByPlaceholderText(/Option \d/)
      fireEvent.change(more[2], { target: { value: "6" } })
      fireEvent.change(more[3], { target: { value: "7" } })
      const markers = within(dlg).getAllByRole("button", { name: /^(Correct|Select|Selected)$/ })
      fireEvent.click(markers[1]) // "4"
      if (correct === 2) fireEvent.click(markers[0]) // "2" too
      fireEvent.click(within(dlg).getByRole("button", { name: "Create question" }))
      await screen.findByText(text)
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    }

    // edit
    const row = (await screen.findByText("What is 2+2?")).closest("div.flex.flex-col.gap-3")!
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: /Edit/ }))
    const dlg = await dialog()
    fireEvent.change(within(dlg).getByLabelText("Question text"), { target: { value: "What is 2+2 (edited)?" } })
    fireEvent.click(within(dlg).getByRole("button", { name: "Save question" }))
    await screen.findByText("What is 2+2 (edited)?")
  })

  it("tests page: create a published test with picked questions; edit keeps questions", async () => {
    mount(<TestListPage />)
    const addBtn = await screen.findByRole("button", { name: /Add test/ })
    await waitFor(() => expect((addBtn as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(addBtn)
    const dlg = await dialog()
    const courseSel = within(dlg).getAllByRole("combobox")[0]
    await waitFor(() => expect(within(courseSel).getByText(COURSE)).toBeTruthy())
    select(courseSel, courseId)
    const q1 = await within(dlg).findByText("What is 2+2 (edited)?")
    const q2 = await within(dlg).findByText("Pick even numbers")
    fireEvent.click(q1.closest("button")!)
    fireEvent.click(q2.closest("button")!)
    expect(within(dlg).getByText("2 selected")).toBeTruthy()
    const inputs = within(dlg).getAllByRole("textbox")
    fireEvent.change(inputs[0], { target: { value: T1 } }) // title
    // status -> published (last combobox in left column is Status)
    const statusSel = within(dlg).getAllByRole("combobox").find((c) => within(c as HTMLElement).queryByText(/published/))!
    select(statusSel, "published")
    fireEvent.click(within(dlg).getByRole("button", { name: "Create test" }))
    const rowOf = async (title: string) =>
      (await screen.findByText(title)).closest("div.flex.flex-col.gap-3") as HTMLElement
    const row = await rowOf(T1)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(within(row).getByText(/2 question\(s\)/)).toBeTruthy()
    expect(within(row).getByText(new RegExp(COURSE))).toBeTruthy() // course title, not an id

    // edit title only -> questions must survive (was a real bug)
    fireEvent.click(within(row).getByRole("button", { name: /Edit/ }))
    const edlg = await dialog()
    await within(edlg).findByText("2 selected")
    fireEvent.change(within(edlg).getAllByRole("textbox")[0], { target: { value: T2 } })
    fireEvent.click(within(edlg).getByRole("button", { name: "Save test" }))
    const row2 = await rowOf(T2)
    expect(within(row2).getByText(/2 question\(s\)/)).toBeTruthy()
  })

  it("assign page: shows only enrolled students, assigns, shows link", async () => {
    mount(<TestAssignmentsPage />)
    fireEvent.click(await screen.findByRole("button", { name: /Assign test/ }))
    const dlg = await dialog()
    const testSel = within(dlg).getAllByRole("combobox")[0]
    await waitFor(() => expect(within(testSel).getByText(new RegExp(T2))).toBeTruthy())
    const opt = within(testSel).getByText(new RegExp(T2)) as HTMLOptionElement
    select(testSel, opt.value)
    // enrolled student appears, outsider does not
    await within(dlg).findByText(new RegExp(`${STUDENT_FIRST} Enrolled`))
    expect(within(dlg).queryByText(new RegExp(`NoEnroll${stamp}`))).toBeNull()
    fireEvent.click(within(dlg).getByText(new RegExp(`${STUDENT_FIRST} Enrolled`)).closest("button")!)
    expect(within(dlg).getByText("1 selected")).toBeTruthy()
    fireEvent.click(within(dlg).getByRole("button", { name: /^Assign \(1\)/ }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await screen.findByText(new RegExp(`${STUDENT_FIRST} Enrolled`))
    expect(screen.getAllByRole("button", { name: /Copy link/ }).length).toBeGreaterThan(0)
    const list: any = await api.get("/tests/assignments")
    shareToken = list.find((a: any) => a.student.firstName === STUDENT_FIRST).shareToken
    expect(shareToken).toBeTruthy()
  })

  it("assign page opens pre-selected from the Tests page link (?test=)", async () => {
    const tests: any = await api.get("/tests?status=published&limit=100")
    const t = tests.items.find((x: any) => x.title === T2)
    mount(<TestAssignmentsPage />, `/?test=${t.id}`)
    const dlg = await dialog()
    await within(dlg).findByText(new RegExp(`${STUDENT_FIRST} Enrolled`))
  })

  it("student page: start, answer, submit, see score", async () => {
    mount(
      <Routes><Route path="/tests/share/:shareToken" element={<PublicTestPage />} /></Routes>,
      `/tests/share/${shareToken}`
    )
    fireEvent.click(await screen.findByRole("button", { name: /Start test/ }))
    await screen.findByText(/Question 1 of 2/)
    const answerFirst = async (label: string[]) => {
      for (const l of label) {
        await screen.findAllByRole("button", { name: l })
        // option buttons are full-width; the palette buttons (1,2,..) are not
        const optionBtn = screen.getAllByRole("button", { name: l }).find((b) => b.className.includes("w-full"))!
        fireEvent.click(optionBtn)
      }
    }
    // question order = order picked: "What is 2+2?" then "Pick even numbers"
    await screen.findByText("What is 2+2 (edited)?")
    await answerFirst(["4"])
    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    await screen.findByText(/Pick even numbers/)
    await answerFirst(["2", "4"])
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }))
    await screen.findByText("Passed")
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("results page lists the attempt with question text; analytics page renders", async () => {
    mount(<TestResultsPage />)
    const row = await screen.findByText(new RegExp(`${STUDENT_FIRST} Enrolled · attempt #1`))
    fireEvent.click(row.closest("button")!)
    await screen.findByText(/1\. What is 2\+2 \(edited\)\?/)
    cleanup()
    mount(<TestAnalyticsPage />)
    await screen.findByText("Leaderboard")
    await waitFor(() => expect(screen.getAllByText(/Enrolled/).length).toBeGreaterThan(0))
  })
})
