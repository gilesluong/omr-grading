import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { Choice, TemplateId } from "../omr/types";
import {
  AnswerKey,
  loadAnswerKeys,
  loadScoringRules,
  parseAnswerKeyInput,
  saveAnswerKey,
  saveScoringRules,
  ScoringRules,
  generateDefaultKey,
  getTemplateForQuestionCount,
} from "../scanner/grading";

interface AnswerKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreFocus: () => void;
  onKeysUpdated: (keys: Record<TemplateId, AnswerKey>) => void;
  activeTemplateId?: TemplateId;
  onTemplateChange?: (templateId: TemplateId) => void;
}

const CHOICES: Choice[] = ["A", "B", "C", "D"];

export const AnswerKeyModal: React.FC<AnswerKeyModalProps> = ({
  isOpen,
  onClose,
  onRestoreFocus,
  onKeysUpdated,
  activeTemplateId,
  onTemplateChange,
}) => {
  const [activeTab, setActiveTab] = useState<"edit" | "import" | "rules">(
    "edit",
  );
  const [keys, setKeys] =
    useState<Record<TemplateId, AnswerKey>>(loadAnswerKeys());
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>(() => {
    return activeTemplateId || "MCQ40";
  });
  const [scoringRules, setScoringRules] =
    useState<ScoringRules>(loadScoringRules());
  const [rulesSaved, setRulesSaved] = useState<boolean>(false);

  // Sync selected template with activeTemplateId if valid
  React.useEffect(() => {
    if (activeTemplateId && isOpen) {
      setSelectedTemplate(activeTemplateId);
    }
  }, [activeTemplateId, isOpen]);

  // Import state
  const [importText, setImportText] = useState<string>("");
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const currentKey = keys[selectedTemplate] || {};
  const questionCount = parseInt(selectedTemplate.replace("MCQ", ""), 10);

  const definedQuestions = React.useMemo(() => {
    return Object.keys(currentKey)
      .map(Number)
      .filter((q) => q >= 1 && currentKey[q]);
  }, [currentKey]);

  const highestDefined =
    definedQuestions.length > 0 ? Math.max(...definedQuestions) : 0;
  const configuredCount = definedQuestions.length;

  const [testLength, setTestLength] = useState<number>(() => {
    if (highestDefined > 0) return highestDefined;
    return questionCount;
  });

  React.useEffect(() => {
    const defs = Object.keys(keys[selectedTemplate] || {})
      .map(Number)
      .filter((q) => q >= 1 && keys[selectedTemplate]?.[q]);
    const maxQ = defs.length > 0 ? Math.max(...defs) : questionCount;
    setTestLength(maxQ);
  }, [selectedTemplate, questionCount]);

  const handleSelectChoice = (q: number, choice: Choice) => {
    const updatedKey = { ...currentKey };
    let newTestLength = testLength;
    if (updatedKey[q] === choice) {
      delete updatedKey[q];
    } else {
      updatedKey[q] = choice;
      if (q > testLength) {
        newTestLength = q;
        setTestLength(q);
      }
    }

    const targetTemplate = getTemplateForQuestionCount(newTestLength);
    if (targetTemplate !== selectedTemplate) {
      setSelectedTemplate(targetTemplate);
      onTemplateChange?.(targetTemplate);
    }

    const updatedAll = { ...keys, [targetTemplate]: updatedKey };
    setKeys(updatedAll);
    saveAnswerKey(targetTemplate, updatedKey);
    onKeysUpdated(updatedAll);
  };

  const handleSetTestLength = (newLength: number) => {
    const clamped = Math.max(1, Math.min(50, newLength));
    const targetTemplate = getTemplateForQuestionCount(clamped);

    setTestLength(clamped);
    if (targetTemplate !== selectedTemplate) {
      setSelectedTemplate(targetTemplate);
      onTemplateChange?.(targetTemplate);
    }

    const updatedKey: AnswerKey = {};
    for (let q = 1; q <= clamped; q++) {
      if (currentKey[q]) {
        updatedKey[q] = currentKey[q];
      }
    }
    const updatedAll = { ...keys, [targetTemplate]: updatedKey };
    setKeys(updatedAll);
    saveAnswerKey(targetTemplate, updatedKey);
    onKeysUpdated(updatedAll);
  };

  const handleClearAll = () => {
    const updatedAll = { ...keys, [selectedTemplate]: {} };
    setKeys(updatedAll);
    saveAnswerKey(selectedTemplate, {});
    onKeysUpdated(updatedAll);
  };

  const handleResetToDefault = () => {
    const defaultKey = generateDefaultKey(testLength);
    const targetTemplate = getTemplateForQuestionCount(testLength);
    const updatedAll = { ...keys, [targetTemplate]: defaultKey };
    setKeys(updatedAll);
    saveAnswerKey(targetTemplate, defaultKey);
    onKeysUpdated(updatedAll);
  };

  // Handle parsing and importing
  const handleApplyImport = () => {
    // Parse up to 50 questions
    const result = parseAnswerKeyInput(importText, 50);
    if (result.parsedCount === 0) {
      setImportFeedback(
        `❌ Error: ${result.errors[0] || "No valid answers found"}`,
      );
      return;
    }

    const maxParsed = Math.max(...Object.keys(result.key).map(Number));
    const newLength = maxParsed > 0 ? maxParsed : result.parsedCount;
    const currentCapacity =
      selectedTemplate === "MCQ10"
        ? 10
        : selectedTemplate === "MCQ20"
          ? 20
          : selectedTemplate === "MCQ40"
            ? 40
            : 50;
    const targetTemplate =
      newLength <= currentCapacity
        ? selectedTemplate
        : getTemplateForQuestionCount(newLength);

    setSelectedTemplate(targetTemplate);
    setTestLength(newLength);
    onTemplateChange?.(targetTemplate);

    const updatedKey = { ...result.key };
    const updatedAll = { ...keys, [targetTemplate]: updatedKey };
    setKeys(updatedAll);
    saveAnswerKey(targetTemplate, updatedKey);
    onKeysUpdated(updatedAll);

    setImportFeedback(
      `✓ Successfully imported ${result.parsedCount} questions! Using ${targetTemplate.replace("MCQ", "")}-question sheet.`,
    );
    setTimeout(() => {
      setActiveTab("edit");
      setImportFeedback(null);
      setImportText("");
    }, 1200);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
      const testParse = parseAnswerKeyInput(content, 50);
      setImportFeedback(`Ready to import ${testParse.parsedCount} questions.`);
    };
    reader.readAsText(file);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
        className="answer-key-dialog"
      >
        <div className="modal-header">
          <div>
            <DialogTitle>Answer key</DialogTitle>
            <DialogDescription className="modal-subtitle">
              Sheet layout adapts to test length automatically.
            </DialogDescription>
          </div>
        </div>

        {/* Sub-mode navigation: Edit vs Import */}
        <div
          className="modal-actions-bar"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              className={`btn-secondary ${activeTab === "edit" ? "active" : ""}`}
              onClick={() => setActiveTab("edit")}
            >
              Edit
            </button>
            <button
              type="button"
              className={`btn-secondary ${activeTab === "import" ? "active" : ""}`}
              onClick={() => setActiveTab("import")}
            >
              Import
            </button>
            <button
              type="button"
              className={`btn-secondary ${activeTab === "rules" ? "active" : ""}`}
              onClick={() => setActiveTab("rules")}
            >
              Scoring
            </button>
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {highestDefined > 28 && (
              <button
                type="button"
                className="btn-trim-action"
                onClick={() => handleSetTestLength(28)}
                title="Trim to 28 questions and clear Q29–40"
              >
                ✂️ Trim to 28 Qs
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: "11px", padding: "4px 8px" }}
              onClick={handleClearAll}
              title="Clear all answers"
            >
              Clear
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: "11px", padding: "4px 8px" }}
              onClick={handleResetToDefault}
              title="Fill standard A, B, C, D pattern"
            >
              Fill ABCD
            </button>
          </div>
        </div>

        {activeTab === "edit" && (
          <div className="test-length-bar">
            <div className="test-length-info">
              <span className="test-length-label">Test Length:</span>
              <span className="test-length-value">
                {configuredCount} / {testLength} Qs
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  background: "rgba(255, 255, 255, 0.06)",
                  padding: "2px 8px",
                  borderRadius: "8px",
                }}
              >
                Sheet: {questionCount} Qs (Auto)
              </span>
            </div>
            <div className="test-length-stepper">
              <button
                type="button"
                className="stepper-btn"
                onClick={() => handleSetTestLength(testLength - 1)}
                disabled={testLength <= 1}
                title="Decrease number of questions"
              >
                −
              </button>
              <input
                type="number"
                className="stepper-input"
                min={1}
                max={50}
                value={testLength}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) handleSetTestLength(val);
                }}
              />
              <span className="stepper-max">/ 50</span>
              <button
                type="button"
                className="stepper-btn"
                onClick={() => handleSetTestLength(testLength + 1)}
                disabled={testLength >= 50}
                title="Increase number of questions"
              >
                +
              </button>
            </div>
          </div>
        )}

        {activeTab === "edit" ? (
          /* Interactive Questions Grid */
          <div className="modal-questions-grid">
            {Array.from({ length: testLength }, (_, idx) => {
              const q = idx + 1;
              const selected = currentKey[q];

              return (
                <div key={`modal-q-${q}`} className="key-row">
                  <span className="key-q-num">
                    Q{String(q).padStart(2, "0")}:
                  </span>
                  <div className="key-choice-group">
                    {CHOICES.map((c) => (
                      <button
                        key={`q-${q}-${c}`}
                        type="button"
                        className={`key-choice-btn ${selected === c ? "active" : ""}`}
                        onClick={() => handleSelectChoice(q, c)}
                        title={selected === c ? `Deselect ${c}` : `Select ${c}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {testLength < questionCount && (
              <div className="excluded-questions-banner">
                <span className="excluded-title">
                  Sheet questions {testLength + 1}–{questionCount} are excluded from grading.
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-include-more"
                    onClick={() => handleSetTestLength(testLength + 1)}
                  >
                    + Add Q{testLength + 1}
                  </button>
                  {testLength < questionCount - 1 && (
                    <button
                      type="button"
                      className="btn-include-more"
                      onClick={() => handleSetTestLength(questionCount)}
                    >
                      Show all {questionCount}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "import" ? (
          /* Import Answer Key Panel */
          <div
            style={{
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              flex: 1,
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Paste answer key as continuous letters (<code>ABCDABCD...</code>),
              numbered pairs (<code>1:A, 2:B...</code>), CSV, or JSON.
              The sheet layout will automatically match your question count.
            </div>

            <textarea
              style={{
                width: "100%",
                height: "110px",
                background: "#111111",
                border: "1px solid var(--border-color)",
                color: "#f8fafc",
                borderRadius: "8px",
                padding: "10px",
                fontSize: "13px",
                fontFamily: "ui-monospace, monospace",
                resize: "none",
                outline: "none",
              }}
              placeholder={`Example:\nADCA BCAB CABC ABAC ABDC BBCA BABC\nor\n1: A, 2: B, 3: C...\nor\n{"1":"A", "2":"B"}`}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportFeedback(null);
              }}
            />

            {importFeedback && (
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: importFeedback.startsWith("✓") ? "#34d399" : "#f87171",
                }}
              >
                {importFeedback}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="btn-action"
                style={{ background: "#10b981", borderColor: "#10b981" }}
                onClick={handleApplyImport}
                disabled={!importText.trim()}
              >
                Apply Answer Key
              </button>

              <label className="btn-secondary" style={{ cursor: "pointer" }}>
                Choose file
                <input
                  type="file"
                  accept=".txt,.csv,.json"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        ) : null}

        {activeTab === "rules" && (
          <div
            style={{
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div>
              <h4
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "14px",
                  color: "#f8fafc",
                }}
              >
                Scoring
              </h4>
              <p style={{ margin: 0, fontSize: "12px", color: "#a1a1a6" }}>
                Set points for correct and incorrect answers.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div
                style={{
                  background: "#111111",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #353537",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "#f5f5f7",
                  }}
                >
                  Points Per Correct Answer
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  className="student-input"
                  style={{ width: "100%" }}
                  value={scoringRules.correctPoints ?? 1}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 1;
                    setScoringRules({ ...scoringRules, correctPoints: val });
                    setRulesSaved(false);
                  }}
                />
              </div>

              <div
                style={{
                  background: "#111111",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #353537",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "#f87171",
                  }}
                >
                  Incorrect Answer Penalty
                </label>
                <select
                  className="student-input"
                  style={{ width: "100%" }}
                  value={scoringRules.incorrectPenalty ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setScoringRules({ ...scoringRules, incorrectPenalty: val });
                    setRulesSaved(false);
                  }}
                >
                  <option value={0}>0 (No penalty)</option>
                  <option value={0.25}>-0.25</option>
                  <option value={0.33}>-0.33</option>
                  <option value={0.5}>-0.50</option>
                  <option value={1}>-1.00</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                marginTop: "6px",
              }}
            >
              <button
                type="button"
                className="btn-action"
                style={{ background: "#eeeeef", borderColor: "#eeeeef" }}
                onClick={() => {
                  saveScoringRules(scoringRules);
                  setRulesSaved(true);
                  setTimeout(() => setRulesSaved(false), 2000);
                }}
              >
                {rulesSaved ? "✓ Saved Scoring Rules!" : "Save Scoring Rules"}
              </button>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
