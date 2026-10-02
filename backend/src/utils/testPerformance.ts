import { TestStats } from "../models/TestStats.model.js";
import { StudentPerformance } from "../models/StudentPerformance.model.js";

interface AttemptQuestionResult {
  questionId: string;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  isCorrect: boolean;
  isPartiallyCorrect: boolean;
  isUnanswered: boolean;
}

interface AttemptTopicResult {
  topic: string;
  percentage: number;
  questionCount: number;
}

interface PerformanceAttemptSource {
  test: string;
  course: string;
  student: string;
  attemptId: string;
  testTitle: string;
  score: number;
  percentage: number;
  passed: boolean;
  submittedAt: Date;
  questionResults: AttemptQuestionResult[];
  topicPerformance: AttemptTopicResult[];
  testSnapshot: {
    questions: {
      questionId: string;
      snapshot: { options: { id: string; text: string }[] };
    }[];
  };
}

function getScoreBucketLabel(percentage: number) {
  const bucketStart = Math.min(90, Math.floor(percentage / 10) * 10);
  if (bucketStart === 90) return "90-100";
  return `${bucketStart}-${bucketStart + 9}`;
}

function findQuestionText(
  attempt: PerformanceAttemptSource,
  questionId: string,
  optionId: string
): string {
  const question = attempt.testSnapshot.questions.find((item) => item.questionId === questionId);
  return question?.snapshot.options.find((option) => option.id === optionId)?.text ?? "";
}

export async function applyAttemptPerformanceUpdate(attempt: PerformanceAttemptSource) {
  const testStats = (await TestStats.findOne({ test: attempt.test } as any).lean()) ?? null;
  const nextTestStats: any = testStats
    ? { ...testStats }
    : {
        test: attempt.test,
        course: attempt.course,
        attemptsCount: 0,
        passedCount: 0,
        failedCount: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passRate: 0,
        scoreDistribution: [],
        questionStats: [],
        topicStats: [],
        updatedAtSummary: null,
      };

  nextTestStats.attemptsCount += 1;
  nextTestStats.averageScore =
    ((nextTestStats.averageScore * (nextTestStats.attemptsCount - 1)) + attempt.score) /
    nextTestStats.attemptsCount;
  nextTestStats.highestScore = Math.max(nextTestStats.highestScore, attempt.score);
  nextTestStats.lowestScore = nextTestStats.attemptsCount === 1 ? attempt.score : Math.min(nextTestStats.lowestScore, attempt.score);

  nextTestStats.passedCount += attempt.passed ? 1 : 0;
  nextTestStats.failedCount += attempt.passed ? 0 : 1;
  nextTestStats.passRate = (nextTestStats.passedCount / nextTestStats.attemptsCount) * 100;

  const distribution = new Map<string, { label: string; count: number }>();
  for (const bucket of nextTestStats.scoreDistribution as { label: string; count: number }[]) {
    distribution.set(bucket.label, { ...bucket });
  }
  const bucketLabel = getScoreBucketLabel(attempt.percentage);
  const bucket = distribution.get(bucketLabel) ?? { label: bucketLabel, count: 0 };
  bucket.count += 1;
  distribution.set(bucket.label, bucket);
  nextTestStats.scoreDistribution = [...distribution.values()].sort((left, right) => left.label.localeCompare(right.label));

  const questionStatsMap = new Map<
    string,
    {
      questionId: string;
      correctCount: number;
      wrongCount: number;
      partiallyCorrectCount: number;
      unansweredCount: number;
      wrongOptionCounts: { optionId: string; count: number }[];
      mostChosenWrongOptionId: string;
      mostChosenWrongOptionText: string;
      _passedCount?: number;
    }
    >();
  for (const existing of nextTestStats.questionStats as Array<{
    questionId: string;
    correctCount: number;
    wrongCount: number;
    partiallyCorrectCount: number;
    unansweredCount: number;
    wrongOptionCounts?: { optionId: string; count: number }[];
    mostChosenWrongOptionId?: string;
    mostChosenWrongOptionText?: string;
      _passedCount?: number;
  }>) {
    questionStatsMap.set(existing.questionId.toString(), {
      questionId: existing.questionId.toString(),
      correctCount: existing.correctCount,
      wrongCount: existing.wrongCount,
      partiallyCorrectCount: existing.partiallyCorrectCount,
      unansweredCount: existing.unansweredCount,
      wrongOptionCounts: [...(existing.wrongOptionCounts ?? [])],
      mostChosenWrongOptionId: existing.mostChosenWrongOptionId ?? "",
      mostChosenWrongOptionText: existing.mostChosenWrongOptionText ?? "",
      _passedCount: existing._passedCount ?? 0,
    });
  }

  for (const questionResult of attempt.questionResults) {
    const stats = questionStatsMap.get(questionResult.questionId) ?? {
      questionId: questionResult.questionId,
      correctCount: 0,
      wrongCount: 0,
      partiallyCorrectCount: 0,
      unansweredCount: 0,
      wrongOptionCounts: [],
      mostChosenWrongOptionId: "",
      mostChosenWrongOptionText: "",
      _passedCount: 0,
    };

    if (questionResult.isCorrect) stats.correctCount += 1;
    else if (questionResult.isPartiallyCorrect) stats.partiallyCorrectCount += 1;
    else if (questionResult.isUnanswered) stats.unansweredCount += 1;
    else stats.wrongCount += 1;

    if (!questionResult.isCorrect && !questionResult.isUnanswered) {
      for (const selectedOptionId of questionResult.selectedOptionIds) {
        if (questionResult.correctOptionIds.includes(selectedOptionId)) continue;
        const entry = stats.wrongOptionCounts.find((item) => item.optionId === selectedOptionId);
        if (entry) entry.count += 1;
        else stats.wrongOptionCounts.push({ optionId: selectedOptionId, count: 1 });
      }
    }

    questionStatsMap.set(questionResult.questionId, stats);
  }

  nextTestStats.questionStats = [...questionStatsMap.values()].map((item) => {
    const mostChosenWrongOption = item.wrongOptionCounts
      .slice()
      .sort((left, right) => right.count - left.count)[0];
    return {
      questionId: item.questionId,
      correctCount: item.correctCount,
      wrongCount: item.wrongCount,
      partiallyCorrectCount: item.partiallyCorrectCount,
      unansweredCount: item.unansweredCount,
      wrongOptionCounts: item.wrongOptionCounts,
      mostChosenWrongOptionId: mostChosenWrongOption?.optionId ?? "",
      mostChosenWrongOptionText: mostChosenWrongOption
        ? findQuestionText(attempt, item.questionId, mostChosenWrongOption.optionId)
        : "",
    };
  });
  nextTestStats.updatedAtSummary = attempt.submittedAt;

  await TestStats.findOneAndUpdate(
    { test: attempt.test },
    nextTestStats,
    { upsert: true, new: true }
  );

  const studentPerformance = (await StudentPerformance.findOne({ student: attempt.student } as any).lean()) ?? null;
  const nextStudentPerformance: any = studentPerformance
    ? { ...studentPerformance }
    : {
        student: attempt.student,
        testsTaken: 0,
        averagePercentage: 0,
        bestPercentage: 0,
        latestPercentage: 0,
        passedCount: 0,
        failedCount: 0,
        scoreTrend: [],
        weakTopics: [],
        strongTopics: [],
        updatedAtSummary: null,
      };

  nextStudentPerformance.testsTaken += 1;
  nextStudentPerformance.averagePercentage =
    ((nextStudentPerformance.averagePercentage * (nextStudentPerformance.testsTaken - 1)) + attempt.percentage) /
    nextStudentPerformance.testsTaken;
  nextStudentPerformance.bestPercentage = Math.max(nextStudentPerformance.bestPercentage, attempt.percentage);
  nextStudentPerformance.latestPercentage = attempt.percentage;
  if (attempt.passed) nextStudentPerformance.passedCount += 1;
  else nextStudentPerformance.failedCount += 1;
  nextStudentPerformance.scoreTrend = [
    ...(nextStudentPerformance.scoreTrend as Array<{
      attempt: string;
      test: string;
      title: string;
      score: number;
      percentage: number;
      takenAt: Date;
      passed: boolean;
    }>),
    {
      attempt: attempt.attemptId,
      test: attempt.test,
      title: attempt.testTitle,
      score: attempt.score,
      percentage: attempt.percentage,
      takenAt: attempt.submittedAt,
      passed: attempt.passed,
    },
  ].slice(-50);

  const topicMap = new Map<string, { topic: string; averagePercentage: number; attemptsCount: number; weakCount: number; strongCount: number }>();
  for (const existing of nextStudentPerformance.weakTopics as Array<{
    topic: string;
    averagePercentage: number;
    attemptsCount: number;
    weakCount: number;
    strongCount: number;
  }>) {
    topicMap.set(existing.topic, { ...existing });
  }
  for (const existing of nextStudentPerformance.strongTopics as Array<{
    topic: string;
    averagePercentage: number;
    attemptsCount: number;
    weakCount: number;
    strongCount: number;
  }>) {
    topicMap.set(existing.topic, { ...existing });
  }

  for (const topicResult of attempt.topicPerformance) {
    const topicName = topicResult.topic || "Uncategorized";
    const current = topicMap.get(topicName) ?? {
      topic: topicName,
      averagePercentage: 0,
      attemptsCount: 0,
      weakCount: 0,
      strongCount: 0,
    };
    current.attemptsCount += 1;
    current.averagePercentage =
      ((current.averagePercentage * (current.attemptsCount - 1)) + topicResult.percentage) / current.attemptsCount;
    if (topicResult.percentage >= 70) current.strongCount += 1;
    if (topicResult.percentage <= 40) current.weakCount += 1;
    topicMap.set(topicName, current);
  }

  nextStudentPerformance.weakTopics = [...topicMap.values()].filter((topic) => topic.weakCount > 0);
  nextStudentPerformance.strongTopics = [...topicMap.values()].filter((topic) => topic.strongCount > 0);
  nextStudentPerformance.updatedAtSummary = attempt.submittedAt;

  await StudentPerformance.findOneAndUpdate(
    { student: attempt.student },
    nextStudentPerformance,
    { upsert: true, new: true }
  );
}
