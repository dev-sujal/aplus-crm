import type {
  MultiAnswerScoringMode,
  QuestionScoreResult,
  StudentAnswerSnapshot,
  TestAttemptScoreSnapshot,
  TestQuestionSnapshot,
  TopicPerformanceSnapshot,
} from "../types/tests.js";

export interface ScoreAttemptOptions {
  passPercentage: number;
  multiAnswerScoring: MultiAnswerScoringMode;
  negativeMarking: boolean;
  negativeMarkingRate?: number;
  submissionMode: "manual" | "auto";
  timeTakenSeconds: number;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function setEquals(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function clampScore(value: number) {
  return Math.max(value, 0);
}

function getPenaltyRate(options: ScoreAttemptOptions) {
  return options.negativeMarking ? options.negativeMarkingRate ?? 0.25 : 0;
}

export function scoreQuestion(
  question: TestQuestionSnapshot,
  answer: StudentAnswerSnapshot | undefined,
  options: ScoreAttemptOptions
): QuestionScoreResult {
  const selectedOptionIds = uniqueSorted(answer?.selectedOptionIds ?? []);
  const correctOptionIds = uniqueSorted(question.snapshot.correctOptionIds);
  const isUnanswered = selectedOptionIds.length === 0;
  const isExactMatch = setEquals(selectedOptionIds, correctOptionIds);
  const selectedCorrect = selectedOptionIds.filter((optionId) => correctOptionIds.includes(optionId));
  const selectedWrong = selectedOptionIds.filter((optionId) => !correctOptionIds.includes(optionId));
  const hasAnyCorrectSelection = selectedCorrect.length > 0;
  const isPartiallyCorrect = !isUnanswered && !isExactMatch && hasAnyCorrectSelection;
  const maxMarks = question.snapshot.marks;

  let marksAwarded = 0;

  if (!isUnanswered) {
    if (question.snapshot.type === "single") {
      marksAwarded = isExactMatch ? maxMarks : -maxMarks * getPenaltyRate(options);
    } else if (options.multiAnswerScoring === "all_correct") {
      marksAwarded = isExactMatch ? maxMarks : -maxMarks * getPenaltyRate(options);
    } else {
      const correctRatio = correctOptionIds.length === 0 ? 0 : selectedCorrect.length / correctOptionIds.length;
      const wrongPoolSize = Math.max(question.snapshot.options.length - correctOptionIds.length, 1);
      const wrongPenalty =
        selectedWrong.length === 0
          ? 0
          : (selectedWrong.length / wrongPoolSize) * maxMarks * getPenaltyRate(options);
      marksAwarded = maxMarks * correctRatio - wrongPenalty;
    }
  }

  return {
    questionId: question.questionId,
    selectedOptionIds,
    correctOptionIds,
    isCorrect: isExactMatch,
    isPartiallyCorrect,
    isUnanswered,
    marksAwarded: roundToTwo(marksAwarded),
    maxMarks,
  };
}

export function scoreTestAttempt(
  questions: TestQuestionSnapshot[],
  answers: StudentAnswerSnapshot[],
  options: ScoreAttemptOptions
): TestAttemptScoreSnapshot {
  const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));
  const orderedQuestions = [...questions].sort((left, right) => left.order - right.order);
  const questionResults = orderedQuestions.map((question) =>
    scoreQuestion(question, answerByQuestionId.get(question.questionId), options)
  );

  const totalMarks = orderedQuestions.reduce((sum, question) => sum + question.snapshot.marks, 0);
  const rawScore = questionResults.reduce((sum, result) => sum + result.marksAwarded, 0);
  const score = roundToTwo(clampScore(rawScore));
  const percentage = totalMarks === 0 ? 0 : roundToTwo((score / totalMarks) * 100);

  const correctCount = questionResults.filter((result) => result.isCorrect).length;
  const partiallyCorrectCount = questionResults.filter((result) => result.isPartiallyCorrect).length;
  const unansweredCount = questionResults.filter((result) => result.isUnanswered).length;
  const wrongCount = questionResults.length - correctCount - partiallyCorrectCount - unansweredCount;

  const topicMap = new Map<string, TopicPerformanceSnapshot>();
  for (let index = 0; index < orderedQuestions.length; index += 1) {
    const question = orderedQuestions[index]!;
    const result = questionResults[index]!;
    const topic = question.snapshot.topic.trim() || "Uncategorized";
    const existing = topicMap.get(topic) ?? {
      topic,
      questionCount: 0,
      correctCount: 0,
      wrongCount: 0,
      partiallyCorrectCount: 0,
      unansweredCount: 0,
      marksAwarded: 0,
      maxMarks: 0,
      percentage: 0,
    };

    existing.questionCount += 1;
    existing.maxMarks += result.maxMarks;
    existing.marksAwarded += result.marksAwarded;
    if (result.isCorrect) existing.correctCount += 1;
    else if (result.isPartiallyCorrect) existing.partiallyCorrectCount += 1;
    else if (result.isUnanswered) existing.unansweredCount += 1;
    else existing.wrongCount += 1;
    existing.percentage = existing.maxMarks === 0 ? 0 : roundToTwo((clampScore(existing.marksAwarded) / existing.maxMarks) * 100);
    topicMap.set(topic, existing);
  }

  return {
    score,
    totalMarks,
    percentage,
    passed: percentage >= options.passPercentage,
    correctCount,
    wrongCount,
    partiallyCorrectCount,
    unansweredCount,
    timeTakenSeconds: Math.max(0, Math.round(options.timeTakenSeconds)),
    submissionMode: options.submissionMode,
    questionResults,
    topicPerformance: [...topicMap.values()].sort((left, right) => left.topic.localeCompare(right.topic)),
  };
}
