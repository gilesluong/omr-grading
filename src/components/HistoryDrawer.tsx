import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import React, { useState } from "react";
import { ScanResult } from "../scanner/types";
import {
  AnswerKey,
  formatGradedSlackMessage,
  gradeExam,
} from "../scanner/grading";
import { downloadGradebookCsv } from "../export/csvExport";
import { TemplateId } from "../omr/types";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreFocus: () => void;
  history: ScanResult[];
  answerKeys: Record<TemplateId, AnswerKey>;
  onDeleteScan: (id: string) => void;
  onClearHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  onRestoreFocus,
  history,
  answerKeys,
  onDeleteScan,
  onClearHistory,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`✓ Copied ${label} to clipboard!`);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(`✓ Copied ${label} to clipboard!`);
    }
  };

  const handleExportCsv = () => {
    downloadGradebookCsv(history, answerKeys);
    showToast("✓ Gradebook CSV downloaded!");
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
        className="scan-history-sheet"
      >
        <SheetDescription className="sr-only">
          Review, copy, and export saved scans.
        </SheetDescription>
        <div className="drawer-header">
          <div className="drawer-title-group">
            <SheetTitle>History</SheetTitle>
            <span className="drawer-count-badge">{history.length}</span>
          </div>

          <div className="drawer-header-actions">
            {history.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn-text-export"
                  onClick={handleExportCsv}
                  title="Export all scans to CSV spreadsheet"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="btn-text-danger"
                  onClick={() => {
                    if (window.confirm("Clear all scan history?")) {
                      onClearHistory();
                    }
                  }}
                >
                  Clear All
                </button>
              </>
            )}
          </div>
        </div>

        {toastMessage && <div className="drawer-toast">{toastMessage}</div>}

        <div className="drawer-content">
          {history.length === 0 ? (
            <div className="drawer-empty-state">
              <h4>No scans yet</h4>
              <p>Your results will appear here.</p>
            </div>
          ) : (
            <div className="scans-list">
              {history.map((scan) => {
                const isExpanded =
                  expandedScanId === scan.id || history.length === 1;
                const formattedTime = new Date(scan.timestamp).toLocaleString();
                const key = answerKeys[scan.templateId] || {};
                const score = gradeExam(scan, key);

                return (
                  <div key={scan.id} className="scan-card">
                    <div
                      className="scan-card-header"
                      onClick={() =>
                        setExpandedScanId(isExpanded ? null : scan.id)
                      }
                    >
                      <div className="scan-card-title-row">
                        <span className="scan-template-tag">
                          {scan.templateId}
                          {scan.testId ? ` • ${scan.testId}` : ""}
                          {scan.className ? ` (${scan.className})` : ""}
                        </span>
                        <span className="scan-score-badge">
                          Score: {score.correctCount}/{score.totalQuestions} (
                          {score.percentage}%) • Grade {score.letterGrade}
                        </span>
                      </div>

                      {scan.studentName && (
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#f8fafc",
                            marginBottom: "4px",
                          }}
                        >
                          {scan.studentName}
                        </div>
                      )}

                      <div className="scan-summary-row">
                        <span className="badge-answered">
                          {score.correctCount} Correct
                        </span>
                        {score.incorrectCount > 0 && (
                          <span className="badge-multiple">
                            {score.incorrectCount} Wrong
                          </span>
                        )}
                        {score.blankCount > 0 && (
                          <span className="badge-blank">
                            {score.blankCount} Blank
                          </span>
                        )}
                        <span
                          className="scan-timestamp"
                          style={{ marginLeft: "auto" }}
                        >
                          {formattedTime}
                        </span>
                      </div>
                    </div>

                    <div className="scan-card-actions">
                      <button
                        type="button"
                        className="btn-copy-slack"
                        onClick={() =>
                          copyToClipboard(
                            formatGradedSlackMessage(
                              scan,
                              score,
                              scan.studentName,
                              scan.testId,
                              scan.className,
                            ),
                            "result",
                          )
                        }
                      >
                        Copy result
                      </button>

                      <div className="scan-card-sub-actions">
                        <button
                          type="button"
                          className="btn-card-delete"
                          onClick={() => onDeleteScan(scan.id)}
                          title="Delete scan"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="answers-grid">
                        {Object.entries(score.results).map(([q, res]) => {
                          const isBlank = res.studentChoice === "BLANK";
                          const isCorrect = res.isCorrect;

                          return (
                            <div
                              key={`ans-${scan.id}-${q}`}
                              className={`answer-pill ${
                                isCorrect
                                  ? "marked"
                                  : isBlank
                                    ? "blank"
                                    : "multiple"
                              }`}
                            >
                              <span className="q-num">
                                {String(q).padStart(2, "0")}:
                              </span>
                              <span className="q-choice">
                                {isBlank ? "—" : res.studentChoice}
                                {isCorrect ? " ✓" : ` ✗ (${res.correctChoice})`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
