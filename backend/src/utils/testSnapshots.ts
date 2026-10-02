import type { QuestionSnapshot, TestQuestionSnapshot } from "../types/tests.js";
import type { QuestionDoc } from "../models/Question.model.js";

function cloneOptions(options: QuestionSnapshot["options"]) {
  return options.map((option) => ({ ...option }));
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

export function cloneQuestionSnapshot(snapshot: QuestionSnapshot): QuestionSnapshot {
  return {
    ...snapshot,
    options: cloneOptions(snapshot.options),
    correctOptionIds: [...snapshot.correctOptionIds],
  };
}

export function stripCorrectAnswers(snapshot: QuestionSnapshot): QuestionSnapshot {
  return {
    ...cloneQuestionSnapshot(snapshot),
    correctOptionIds: [],
  };
}

export function buildAttemptQuestionSnapshots(
  questions: TestQuestionSnapshot[],
  shuffleQuestions: boolean,
  shuffleOptions: boolean
): TestQuestionSnapshot[] {
  const orderedQuestions = shuffleQuestions ? shuffleArray(questions) : [...questions];
  return orderedQuestions.map((question, index) => ({
    questionId: question.questionId,
    order: index,
    snapshot: {
      ...cloneQuestionSnapshot(question.snapshot),
      options: shuffleOptions ? shuffleArray(cloneOptions(question.snapshot.options)) : cloneOptions(question.snapshot.options),
    },
  }));
}

export function stripCorrectAnswersFromQuestions(questions: TestQuestionSnapshot[]) {
  return questions.map((question) => ({
    ...question,
    snapshot: stripCorrectAnswers(question.snapshot),
  }));
}

export function buildQuestionSnapshot(question: QuestionDoc): QuestionSnapshot {
  return {
    type: question.type,
    text: question.text,
    options: question.options.map((option) => ({ id: option.id, text: option.text })),
    correctOptionIds: [...question.correctOptionIds],
    marks: question.marks,
    explanation: question.explanation ?? "",
    topic: question.topic ?? "",
    difficulty: question.difficulty,
  };
}

export function buildTestQuestionSnapshots(questions: QuestionDoc[]): TestQuestionSnapshot[] {
  return questions.map((question, index) => ({
    questionId: (question as any)._id.toString(),
    snapshot: buildQuestionSnapshot(question),
    order: index,
  }));
}

