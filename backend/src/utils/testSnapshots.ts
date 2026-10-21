import type { QuestionSnapshot, TestQuestionSnapshot } from "../types/tests.js";
import type { QuestionDoc } from "../models/Question.model.js";

function cloneOptions(options: QuestionSnapshot["options"]) {
  return options.map((option) => ({ id: option.id, text: option.text }));
}

/** Converts a mongoose subdocument (or plain object) to a plain object. */
export function toPlain<T>(value: T): T {
  const maybe = value as unknown as { toObject?: () => T };
  return typeof maybe?.toObject === "function" ? maybe.toObject() : value;
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

export function cloneQuestionSnapshot(input: QuestionSnapshot): QuestionSnapshot {
  const snapshot = toPlain(input);
  return {
    type: snapshot.type,
    text: snapshot.text,
    options: cloneOptions(snapshot.options),
    correctOptionIds: [...snapshot.correctOptionIds],
    marks: snapshot.marks,
    explanation: snapshot.explanation ?? "",
    topic: snapshot.topic ?? "",
    difficulty: snapshot.difficulty,
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
  const plain = questions.map((question) => ({
    questionId: String(question.questionId),
    order: question.order,
    snapshot: cloneQuestionSnapshot(question.snapshot),
  }));
  plain.sort((left, right) => left.order - right.order);
  const orderedQuestions = shuffleQuestions ? shuffleArray(plain) : plain;
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
    questionId: String(question.questionId),
    order: question.order,
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

