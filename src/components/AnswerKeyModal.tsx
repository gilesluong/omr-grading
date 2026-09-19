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
} from "../scanner/grading";

interface AnswerKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreFocus: () => void;
  onKeysUpdated: (keys: Record<TemplateId, AnswerKey>) => void;
}

const CHOICES: Choice[] = ["A", "B", "C", "D"];

export const AnswerKeyModal: React.FC<AnswerKeyModalProps> = ({
  isOpen,
  onClose,
  onRestoreFocus,
  onKeysUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<"edit" | "import" | "rules">(
    "edit",
  );
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("MCQ20");
  const [keys, setKeys] =
    useState<Record<TemplateId, AnswerKey>>(loadAnswerKeys());
  const [scoringRules, setScoringRules] =
    useState<ScoringRules>(loadScoringRules());
  const [rulesSaved, setRulesSaved] = useState<boolean>(false);

  // Import state
  const [importText, setImportText] = useState<string>("");
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const currentKey = keys[selectedTemplate] || {};
  const questionCount = parseInt(selectedTemplate.replace("MCQ", ""), 10);

  const handleSelectChoice = (q: number, choice: Choice) => {
    const updatedKey = { ...currentKey, [q]: choice };
    const updatedAll = { ...keys, [selectedTemplate]: updatedKey };
    setKeys(updatedAll);
    saveAnswerKey(selectedTemplate, updatedKey);
    onKeysUpdated(updatedAll);
  };

  // Handle parsing and importing
  const handleApplyImport = () => {
    const result = parseAnswerKeyInput(importText, questionCount);
    if (result.parsedCount === 0) {
      setImportFeedback(
        `❌ Error: ${result.errors[0] || "No valid answers found"}`,
      );
      return;
    }

    const updatedKey = { ...currentKey, ...result.key };
    const updatedAll = { ...keys, [selectedTemplate]: updatedKey };
    setKeys(updatedAll);
    saveAnswerKey(selectedTemplate, updatedKey);
    onKeysUpdated(updatedAll);

    setImportFeedback(
      `✓ Successfully imported ${result.parsedCount} of ${questionCount} questions!`,
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
      const testParse = parseAnswerKeyInput(content, questionCount);
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
              Changes are saved automatically.
            </DialogDescription>
          </div>
        </div>

        {/* Template Switcher */}
        <div className="modal-template-tabs">
          {(["MCQ10", "MCQ20", "MCQ40", "MCQ50"] as TemplateId[]).map((id) => (
            <button
              key={`key-tab-${id}`}
              type="button"
              className={`tab-btn ${selectedTemplate === id ? "active" : ""}`}
              onClick={() => {
                setSelectedTemplate(id);
                setImportFeedback(null);
              }}
            >
              {id}
            </button>
          ))}
        </div>

        {/* Sub-mode navigation: Edit vs Import */}
        <div
          className="modal-actions-bar"
          style={{ justifyContent: "space-between" }}
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
        </div>

        {activeTab === "edit" ? (
          /* Interactive Questions Grid */
          <div className="modal-questions-grid">
            {Array.from({ length: questionCount }, (_, idx) => {
              const q = idx + 1;
              const selected = currentKey[q] || "A";

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
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
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
              numbered pairs (<code>1:A, 2:B...</code>), CSV, or JSON:
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
              placeholder={`Example:\nABCDABCDAB...\nor\n1: A, 2: B, 3: C...\nor\n{"1":"A", "2":"B"}`}
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
                Apply Import to {selectedTemplate}
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
