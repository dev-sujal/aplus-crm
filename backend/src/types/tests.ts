export const QUESTION_TYPES = ["single", "multiple"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export const TEST_STATUSES = ["draft", "published", "archived"] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

export const ASSIGNMENT_STATUSES = ["not_started", "in_progress", "submitted", "expired", "revoked"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ATTEMPT_STATUSES = ["in_progress", "submitted", "auto_submitted", "expired"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const MULTI_ANSWER_SCORING = ["all_correct", "partial"] as const;
export type MultiAnswerScoringMode = (typeof MULTI_ANSWER_SCORING)[number];

export const SUBMISSION_MODES = ["manual", "auto"] as const;
export type SubmissionMode = (typeof SUBMISSION_MODES)[number];

export interface QuestionOptionSnapshot {
  id: string;
  text: string;
}

export interface QuestionSnapshot {
  type: QuestionType;
  text: string;
  options: QuestionOptionSnapshot[];
  correctOptionIds: string[];
  marks: number;
  explanation: string;
  topic: string;
  difficulty: QuestionDifficulty;
}

export interface TestQuestionSnapshot {
  questionId: string;
  snapshot: QuestionSnapshot;
  order: number;
}

export interface StudentAnswerSnapshot {
  questionId: string;
  selectedOptionIds: string[];
  markedForReview?: boolean;
  answeredAt?: string | Date | null;
}

export interface QuestionScoreResult {
  questionId: string;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  isCorrect: boolean;
  isPartiallyCorrect: boolean;
  isUnanswered: boolean;
  marksAwarded: number;
  maxMarks: number;
}

export interface TopicPerformanceSnapshot {
  topic: string;
  questionCount: number;
  correctCount: number;
  wrongCount: number;
  partiallyCorrectCount: number;
  unansweredCount: number;
  marksAwarded: number;
  maxMarks: number;
  percentage: number;
}

export interface TestAttemptScoreSnapshot {
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  wrongCount: number;
  partiallyCorrectCount: number;
  unansweredCount: number;
  timeTakenSeconds: number;
  submissionMode: SubmissionMode;
  questionResults: QuestionScoreResult[];
  topicPerformance: TopicPerformanceSnapshot[];
}
