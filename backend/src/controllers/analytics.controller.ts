import { Course } from "../models/Course.model.js";
import { Test } from "../models/Test.model.js";
import { TestAttempt } from "../models/TestAttempt.model.js";
import { TestAssignment } from "../models/TestAssignment.model.js";
import { TestStats } from "../models/TestStats.model.js";
import { StudentPerformance } from "../models/StudentPerformance.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getAnalyticsOverview = asyncHandler(async (_req, res) => {
  const [tests, assignments, attempts, publishedTests, testStats, studentPerformances] = await Promise.all([
    Test.countDocuments(),
    TestAssignment.countDocuments(),
    TestAttempt.countDocuments(),
    Test.countDocuments({ status: "published" }),
    TestStats.find(),
    StudentPerformance.find(),
  ]);

  const averageTestPassRate = testStats.length
    ? Math.round((testStats.reduce((sum, stat) => sum + stat.passRate, 0) / testStats.length) * 100) / 100
    : 0;
  const averageStudentPercentage = studentPerformances.length
    ? Math.round((studentPerformances.reduce((sum, item) => sum + item.averagePercentage, 0) / studentPerformances.length) * 100) / 100
    : 0;

  res.json({
    tests,
    publishedTests,
    assignments,
    attempts,
    averageTestPassRate,
    averageStudentPercentage,
    topStudents: studentPerformances
      .slice()
      .sort((left, right) => right.averagePercentage - left.averagePercentage)
      .slice(0, 10),
  });
});

export const getTestAnalytics = asyncHandler(async (req, res) => {
  const stat = await TestStats.findOne({ test: (req.params as { testId: string }).testId } as any).populate("test course");
  if (!stat) {
    const test = await Test.findById(req.params.testId);
    if (!test) return res.json(null);
    return res.json({
      test,
      attemptsCount: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passedCount: 0,
      failedCount: 0,
      passRate: 0,
      scoreDistribution: [],
      questionStats: [],
      topicStats: [],
    });
  }

  res.json(stat);
});

export const listCourseComparison = asyncHandler(async (_req, res) => {
  const stats = await TestStats.find().populate("test course");
  const courseMap = new Map<string, { courseId: string; title: string; tests: number; attempts: number; averagePassRate: number }>();

  for (const stat of stats) {
    const populatedCourse = stat.course as unknown as { _id?: string; id?: string; title?: string } | null;
    const courseId = populatedCourse?._id?.toString() ?? populatedCourse?.id ?? stat.course.toString();
    const courseTitle = populatedCourse?.title ?? "Unknown course";
    const current = courseMap.get(courseId) ?? { courseId, title: courseTitle, tests: 0, attempts: 0, averagePassRate: 0 };
    current.tests += 1;
    current.attempts += stat.attemptsCount;
    current.averagePassRate = (current.averagePassRate * (current.tests - 1) + stat.passRate) / current.tests;
    courseMap.set(courseId, current);
  }

  res.json([...courseMap.values()]);
});

export const getLeaderboard = asyncHandler(async (_req, res) => {
  const leaderboard = await StudentPerformance.find().populate("student", "firstName lastName email phone").sort({ averagePercentage: -1 }).limit(20);
  res.json(leaderboard);
});
