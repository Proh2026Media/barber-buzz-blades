import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultPrivacy, nextQuestion, nextSurvey, questions, type Survey } from "./model.ts";
import { createDemoState, demoReducer } from "../demo/model.ts";

test("optional collection starts disabled", () => {
  assert.deepEqual(defaultPrivacy, { analytics: false, surveys: false, marketing: false });
  assert.deepEqual(createDemoState().privacy, defaultPrivacy);
});

test("post-service rating requires a recent completed visit and respects cooldown", () => {
  const now = new Date("2030-04-01T12:00:00Z");
  const discovery: Survey = {
    id: "discovery",
    question: "discovery",
    answer: "referral",
    state: "answered",
    shown_at: "2030-02-01T12:00:00Z",
    version: 1,
  };
  const appointment = {
    id: "visit",
    starts_at: "2030-03-31T10:00:00Z",
    ends_at: "2030-03-31T11:00:00Z",
    status: "completed",
  };
  assert.equal(nextSurvey([discovery], now, [appointment])?.question, "satisfaction");
  assert.equal(
    nextSurvey([discovery], now, [{ ...appointment, status: "cancelled" }])?.question,
    "period",
  );
  assert.equal(
    nextSurvey([discovery], now, [{ ...appointment, ends_at: "2030-04-02T12:00:00Z" }])?.question,
    "period",
  );
  assert.equal(
    nextSurvey([{ ...discovery, shown_at: "2030-03-20T12:00:00Z" }], now, [appointment]),
    null,
  );
  assert.equal(nextSurvey([discovery], now, []), null);
});

test("improvement follows any numeric rating but never a skipped answer", () => {
  const now = new Date("2030-04-01T12:00:00Z");
  const appointment = {
    id: "visit",
    starts_at: "2030-02-20T10:00:00Z",
    ends_at: "2030-02-20T11:00:00Z",
    status: "completed",
  };
  const discovery: Survey = {
    id: "discovery",
    question: "discovery",
    answer: null,
    state: "dismissed",
    shown_at: "2030-01-01T12:00:00Z",
    version: 1,
  };
  const rating: Survey = {
    id: "rating",
    question: "satisfaction",
    answer: "5",
    state: "answered",
    shown_at: "2030-03-01T12:00:00Z",
    version: 1,
    appointment_id: appointment.id,
    appointment_starts_at: appointment.starts_at,
  };
  for (const answer of ["1", "2", "3", "4", "5"])
    assert.equal(
      nextSurvey([discovery, { ...rating, answer }], now, [appointment])?.question,
      "improvement",
    );
  assert.equal(
    nextSurvey([discovery, { ...rating, answer: "skip" }], now, [appointment])?.question,
    "period",
  );
  assert.equal(
    nextSurvey([discovery, rating], now, [{ ...appointment, id: "other" }])?.question,
    "period",
  );
});
test("survey cadence applies equally to skipped and answered questions", () => {
  for (const state of ["dismissed", "answered", "shown"] as const) {
    const row: Survey = {
      id: "test",
      question: "discovery",
      answer: null,
      state,
      shown_at: "2030-01-01T09:00:00Z",
      version: 1,
    };
    assert.equal(nextQuestion([row], new Date("2030-01-30T09:00:00Z")), null);
    assert.equal(nextQuestion([row], new Date("2030-01-31T09:00:00Z")), "period");
  }
});

test("service interest is part of the common survey sequence", () => {
  const now = new Date("2030-12-01T12:00:00Z");
  const genericQuestions = [
    "discovery",
    "period",
    "professional",
    "frequency",
    "conversation",
  ] as const;
  const rows: Survey[] = genericQuestions.map((question, index) => ({
    id: String(index),
    question,
    answer: "skip",
    state: "answered",
    shown_at: "2030-09-01T12:00:00Z",
    version: 1,
  }));
  assert.equal(nextQuestion(rows, now), "service_interest");
  assert.deepEqual(Object.keys(questions.service_interest.options), [
    "eyebrow",
    "facial",
    "hydration",
    "coloring",
    "manicure",
    "massage",
    "none",
    "other",
    "skip",
  ]);
});
test("optional erasure preserves appointments and disables permissions", () => {
  const initial = createDemoState();
  const enabled = demoReducer(initial, {
    type: "privacy.save",
    preferences: { analytics: true, surveys: true, marketing: true },
  });
  const erased = demoReducer(enabled, { type: "privacy.erase" });
  assert.deepEqual(erased.privacy, defaultPrivacy);
  assert.deepEqual(erased.appointments, initial.appointments);
  assert.deepEqual(erased.surveys, []);
});
test("demo catalog price changes cannot rewrite existing booking values", () => {
  const initial = createDemoState();
  const edited = demoReducer(initial, {
    type: "service.edit",
    service: { ...initial.services[0], price_cents: 10000 },
  });
  assert.deepEqual(edited.prices, initial.prices);
});

test("demo account deletion requests are idempotent and cancellable without erasing bookings", () => {
  const initial = createDemoState();
  const requested = demoReducer(initial, { type: "privacy.request", status: "requested" });
  const repeated = demoReducer(requested, { type: "privacy.request", status: "requested" });
  assert.equal(repeated.privacyRequests.length, 1);
  const id = repeated.privacyRequests[0].id;
  const reviewing = demoReducer(repeated, { type: "privacy.request", status: "reviewing", id });
  assert.equal(reviewing.privacyRequests[0].status, "reviewing");
  const cancelled = demoReducer(reviewing, { type: "privacy.request", status: "cancelled", id });
  assert.equal(cancelled.privacyRequests[0].status, "cancelled");
  assert.deepEqual(cancelled.appointments, initial.appointments);
  assert.equal(
    demoReducer(cancelled, { type: "privacy.request", status: "requested" }).privacyRequests.length,
    2,
  );
});

test("demo cancellation records optional reason and source", () => {
  const initial = createDemoState();
  const appointment = initial.appointments.find((row) => row.status === "confirmed")!;
  const cancelled = demoReducer(initial, {
    type: "cancel",
    id: appointment.id,
    reason: "schedule",
    source: "customer",
  });
  assert.equal(
    cancelled.appointments.find((row) => row.id === appointment.id)?.status,
    "cancelled",
  );
  assert.deepEqual(cancelled.cancellationReasons[appointment.id], {
    reason: "schedule",
    source: "customer",
  });
});
