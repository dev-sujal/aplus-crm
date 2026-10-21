import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFeeCap, validatePaymentAmount } from "./fee.js";
import { getNextReceiptNumber } from "./receiptNumber.js";

test("rejects payment above the remaining balance", () => {
  assert.throws(() => validatePaymentAmount(500, 400), /remaining balance/i);
  assert.throws(() => validatePaymentAmount(100, 0), /fully paid/i);
  assert.doesNotThrow(() => validatePaymentAmount(300, 400));
});

test("rejects fee totals above the course fee cap", () => {
  assert.throws(() => validateFeeCap(1200, 1000), /course fee/i);
  assert.doesNotThrow(() => validateFeeCap(1000, 1000));
  assert.doesNotThrow(() => validateFeeCap(800, 1000));
});

test("starts receipt numbering from ACC-2026-0001 and increments sequentially", () => {
  assert.equal(getNextReceiptNumber([], 2026), "ACC-2026-0001");
  assert.equal(getNextReceiptNumber(["ACC-2026-0001", "ACC-2026-0002"], 2026), "ACC-2026-0003");
  assert.equal(getNextReceiptNumber(["ACC-2025-0099", "ACC-2026-0002"], 2026), "ACC-2026-0003");
});
