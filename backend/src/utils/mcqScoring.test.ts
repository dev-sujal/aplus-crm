import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreTestAttempt } from "./mcqScoring.js";

test("scores single-answer questions exactly", () => {
  const result = scoreTestAttempt(
    [
      {
        questionId: "q1",
        order: 1,
        snapshot: {
          type: "single",
          text: "Capital of India?",
          options: [
            { id: "a", text: "Delhi" },
            { id: "b", text: "Mumbai" },
          ],
          correctOptionIds: ["a"],
          marks: 2,
          explanation: "Delhi is the capital.",
          topic: "General",
          difficulty: "easy",
        },
      },
    ],
    [{ questionId: "q1", selectedOptionIds: ["a"] }],
    {
      passPercentage: 40,
      multiAnswerScoring: "partial",
      negativeMarking: false,
      submissionMode: "manual",
      timeTakenSeconds: 15,
    }
  );

  assert.equal(result.score, 2);
  assert.equal(result.percentage, 100);
  assert.equal(result.passed, true);
  assert.equal(result.questionResults[0]?.isCorrect, true);
});

test("scores multiple-answer questions with partial credit and penalty", () => {
  const result = scoreTestAttempt(
    [
      {
        questionId: "q1",
        order: 1,
        snapshot: {
          type: "multiple",
          text: "Select fruits",
          options: [
            { id: "a", text: "Apple" },
            { id: "b", text: "Carrot" },
            { id: "c", text: "Banana" },
            { id: "d", text: "Potato" },
          ],
          correctOptionIds: ["a", "c"],
          marks: 4,
          explanation: "Apple and banana are fruits.",
          topic: "Food",
          difficulty: "medium",
        },
      },
    ],
    [{ questionId: "q1", selectedOptionIds: ["a", "b"] }],
    {
      passPercentage: 40,
      multiAnswerScoring: "partial",
      negativeMarking: true,
      negativeMarkingRate: 0.25,
      submissionMode: "manual",
      timeTakenSeconds: 20,
    }
  );

  assert.equal(result.questionResults[0]?.isPartiallyCorrect, true);
  assert.ok(result.score > 0);
  assert.equal(result.topicPerformance[0]?.topic, "Food");
});
