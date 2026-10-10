import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateGradebookCsv } from "../src/export/csvExport";
import { loadAnswerKeys, saveAnswerKey, type AnswerKey } from "../src/scanner/grading";
import { saveScanResult, deleteScanResult, loadScanHistory } from "../src/scanner/storage";
import { ScanResult } from "../src/scanner/types";

/** Minimal in-memory localStorage so these run in the node test environment. */
class MemoryStorage {
  private store = new Map<string, string>();
  failOnSet = false;
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.failOnSet) throw new DOMException("QuotaExceededError");
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  (globalThis as any).localStorage = storage;
});

afterEach(() => {
  delete (globalThis as any).localStorage;
});

const scan = (id: string): ScanResult => ({
  id,
  timestamp: "2026-10-10T12:00:00.000Z",
  templateId: "MCQ10",
  totalQuestions: 4,
  answers: {},
  summary: { answered: 0, blank: 4, multiple: 0 },
});

const EMPTY_KEYS = { MCQ10: {}, MCQ20: {}, MCQ40: {}, MCQ50: {} };

describe("CSV export safety", () => {
  it("neutralises spreadsheet formula injection in free-text fields", () => {
    const hostile = { ...scan("s1"), studentName: "=cmd|'/c calc'!A0" } as ScanResult;
    const csv = generateGradebookCsv([hostile], EMPTY_KEYS);
    expect(csv).not.toMatch(/(^|,)"?=cmd/m);
    expect(csv).toContain("'=cmd");
  });

  it("quotes cells containing a bare carriage return so rows stay intact", () => {
    const sc = { ...scan("s2"), studentName: "Ann\rSmith" } as ScanResult;
    const csv = generateGradebookCsv([sc], EMPTY_KEYS);
    expect(csv).toContain('"Ann\rSmith"');
  });

  it("leaves ordinary names untouched", () => {
    const sc = { ...scan("s3"), studentName: "Nguyễn Văn An" } as ScanResult;
    const csv = generateGradebookCsv([sc], EMPTY_KEYS);
    expect(csv).toContain("Nguyễn Văn An");
    expect(csv).not.toContain("'Nguyễn");
  });
});

describe("Answer key persistence", () => {
  it("keeps a legitimate key that reads A, B, C, D, A", () => {
    const key: AnswerKey = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "A", 6: "B" };
    saveAnswerKey("MCQ10", key);
    expect(loadAnswerKeys().MCQ10).toEqual(key);
  });

  it("does not wipe other templates' keys when saving one", () => {
    saveAnswerKey("MCQ10", { 1: "A", 2: "B", 3: "C", 4: "D", 5: "A" });
    saveAnswerKey("MCQ20", { 1: "D", 2: "C" });
    expect(loadAnswerKeys().MCQ10).toEqual({ 1: "A", 2: "B", 3: "C", 4: "D", 5: "A" });
    expect(loadAnswerKeys().MCQ20).toEqual({ 1: "D", 2: "C" });
  });
});

describe("Scan history persistence", () => {
  it("returns the updated list when the write succeeds", () => {
    expect(saveScanResult(scan("a")).map((s) => s.id)).toEqual(["a"]);
    expect(loadScanHistory().map((s) => s.id)).toEqual(["a"]);
  });

  it("never wipes the visible history when storage fails", () => {
    saveScanResult(scan("a"));
    saveScanResult(scan("b"));
    storage.failOnSet = true;
    const after = saveScanResult(scan("c"));
    // The new scan is still handed back (and stays on screen) rather than [].
    expect(after.map((s) => s.id)).toEqual(["c", "b", "a"]);
  });

  it("keeps the list intact when a delete cannot be persisted", () => {
    saveScanResult(scan("a"));
    storage.failOnSet = true;
    expect(deleteScanResult("a").map((s) => s.id)).toEqual(["a"]);
  });
});
