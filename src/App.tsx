import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { TEMPLATES } from "./omr/templates";
import { TemplateId } from "./omr/types";
import { generateGeometry } from "./omr/geometry";
import { Sheet } from "./components/Sheet";
import { EssaySheet, EssayLayout } from "./components/EssaySheet";
import { EssayBackSheet } from "./components/EssayBackSheet";
import { CameraScanner } from "./components/CameraScanner";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { AnswerKeyModal } from "./components/AnswerKeyModal";
import {
  clearScanHistory,
  deleteScanResult,
  loadScanHistory,
  saveScanResult,
} from "./scanner/storage";
import {
  AnswerKey,
  getActiveTemplate,
  getTemplateForQuestionCount,
  loadAnswerKeys,
  saveAnswerKey,
  setActiveTemplate,
} from "./scanner/grading";
import { ScanResult } from "./scanner/types";
import {
  Menu,
  History,
  Key,
  FileText,
  Printer,
  ChevronDown,
  PenLine,
  FileCheck,
} from "lucide-react";
import { BatchItem } from "./scanner/batch";
import { BatchSummaryModal } from "./components/BatchSummaryModal";
import "./styles/globals.css";
import "./styles/app.css";
import "./styles/print.css";

type AppMode = "scanner" | "sheets";
type SheetType = "mcq" | "essay";

const TEMPLATE_OPTIONS: Array<{ id: TemplateId; label: string }> = [
  { id: "MCQ10", label: "10" },
  { id: "MCQ20", label: "20" },
  { id: "MCQ40", label: "40" },
  { id: "MCQ50", label: "50" },
];

export const App: React.FC = () => {
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreMenuFocus = () => menuTriggerRef.current?.focus();
  const [mode, setMode] = useState<AppMode>("scanner");
  const [sheetType, setSheetType] = useState<SheetType>("mcq");
  const [essayLayout, setEssayLayout] = useState<EssayLayout>("side-by-side");
  const [answerKeys, setAnswerKeys] =
    useState<Record<TemplateId, AnswerKey>>(loadAnswerKeys());
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<TemplateId>(() => getActiveTemplate(loadAnswerKeys()));
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isAnswerKeyOpen, setIsAnswerKeyOpen] = useState<boolean>(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isDoublePrint, setIsDoublePrint] = useState<boolean>(true);
  const [includeEssayBack, setIncludeEssayBack] = useState<boolean>(true);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [isBatchSummaryOpen, setIsBatchSummaryOpen] = useState<boolean>(false);

  useEffect(() => {
    setHistory(loadScanHistory());
  }, []);

  const config = TEMPLATES[selectedTemplateId];
  const geometry = useMemo(() => generateGeometry(config), [config]);

  const currentKey = answerKeys[selectedTemplateId] || {};
  const currentQuestionCount = Object.keys(currentKey).length;

  const handlePrint = () => {
    setIsMenuOpen(false);
    window.print();
  };

  const handleScanComplete = (result: ScanResult) => {
    const updated = saveScanResult(result);
    setHistory(updated);
  };

  const handleKeepBatchItem = (item: BatchItem) => {
    setBatch((prev) => [item, ...prev]);
  };

  const handleDeleteScan = (id: string) => {
    const updated = deleteScanResult(id);
    setHistory(updated);
  };

  const handleClearHistory = () => {
    clearScanHistory();
    setHistory([]);
  };

  return (
    <div
      className={`app-container ${mode === "scanner" ? "camera-mode" : "sheets-mode"}`}
    >
      {/* Dynamic print orientation styles for A4 sheet printing */}
      {mode === "sheets" &&
      sheetType === "essay" &&
      essayLayout === "side-by-side" ? (
        <style>{`
          @page {
            size: 297mm 210mm !important;
            margin: 0 !important;
          }
          @media print {
            html, body, #root, .app-container {
              width: 297mm !important;
              height: 210mm !important;
            }
            .essay-sheet-wrapper {
              width: 297mm !important;
              height: 210mm !important;
            }
            .essay-sheet-svg {
              width: 297mm !important;
              height: 210mm !important;
            }
          }
        `}</style>
      ) : (
        <style>{`
          @page {
            size: 210mm 297mm !important;
            margin: 0 !important;
          }
          @media print {
            html, body, #root, .app-container {
              width: 210mm !important;
              min-height: 297mm !important;
              height: auto !important;
            }
            .omr-sheet-wrapper, .essay-sheet-wrapper {
              width: 210mm !important;
              height: 297mm !important;
            }
            .omr-sheet-svg, .essay-sheet-svg {
              width: 210mm !important;
              height: 297mm !important;
            }
          }
        `}</style>
      )}

      {/* Minimal Top Bar */}
      <header className="app-topbar no-print">
        <div className="topbar-left">
          {mode === "scanner" ? (
            <button
              type="button"
              className="topbar-key-btn"
              onClick={() => setIsAnswerKeyOpen(true)}
              title="Configure answer key for this test"
              aria-label="Answer key"
            >
              <Key size={14} />
              <span>
                {currentQuestionCount > 0 ? `${currentQuestionCount} Qs Key` : "Set Key"}
              </span>
              <span style={{ fontSize: "10px", opacity: 0.7, fontWeight: 500 }}>
                ({selectedTemplateId.replace("MCQ", "")}-sheet)
              </span>
            </button>
          ) : (
            <>
              <button
                className="topbar-back-btn"
                onClick={() => setMode("scanner")}
              >
                ← Scan
              </button>
              {sheetType === "mcq" ? (
                <div className="template-select-wrapper">
                  <select
                    className="template-select"
                    aria-label="Questions per sheet"
                    value={selectedTemplateId}
                    onChange={(event) => {
                      const val = event.target.value;
                      if (val === "ESSAY") {
                        setSheetType("essay");
                      } else {
                        setSelectedTemplateId(val as TemplateId);
                        setActiveTemplate(val as TemplateId);
                      }
                    }}
                  >
                    <optgroup label="OMR Bubble Sheets">
                      {TEMPLATE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label} questions
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Essay Answer Sheets">
                      <option value="ESSAY">Essay Lines (2-in-1)</option>
                    </optgroup>
                  </select>
                  <ChevronDown className="template-select-icon" aria-hidden="true" />
                </div>
              ) : (
                <div className="template-select-wrapper">
                  <select
                    className="template-select"
                    aria-label="Essay layout"
                    value={essayLayout}
                    onChange={(event) => {
                      const val = event.target.value;
                      if (val === "MCQ") {
                        setSheetType("mcq");
                      } else {
                        setEssayLayout(val as EssayLayout);
                      }
                    }}
                  >
                    <optgroup label="Essay Layout (2 pages in 1)">
                      <option value="side-by-side">Booklet (Side-by-side)</option>
                      <option value="top-bottom">Stacked (Top-Bottom)</option>
                    </optgroup>
                    <optgroup label="OMR Bubble Sheets">
                      <option value="MCQ">← Back to OMR Bubbles</option>
                    </optgroup>
                  </select>
                  <ChevronDown className="template-select-icon" aria-hidden="true" />
                </div>
              )}

              {sheetType === "mcq" && (
                <button
                  type="button"
                  className={`topbar-toggle-btn ${includeEssayBack ? "active" : ""}`}
                  onClick={() => setIncludeEssayBack(!includeEssayBack)}
                  title={
                    includeEssayBack
                      ? "Back page has essay lines (click to disable)"
                      : "Add essay writing lines on back (2-sided print)"
                  }
                >
                  <PenLine size={13} />
                  {includeEssayBack ? "Lines on Back: ON" : "+ Lines on Back"}
                </button>
              )}

              {sheetType === "essay" && (
                <button
                  type="button"
                  className="topbar-toggle-btn"
                  onClick={() => setSheetType("mcq")}
                  title="Return to OMR bubble sheets"
                >
                  <FileText size={13} /> OMR Bubbles
                </button>
              )}

              {sheetType === "essay" && (
                <button
                  type="button"
                  className="topbar-toggle-btn active"
                  onClick={() =>
                    setEssayLayout(
                      essayLayout === "side-by-side" ? "top-bottom" : "side-by-side",
                    )
                  }
                  title={
                    essayLayout === "side-by-side"
                      ? "Current: Side-by-side (Landscape). Click for Top-Bottom (Portrait)."
                      : "Current: Top-Bottom (Portrait). Click for Side-by-side (Landscape)."
                  }
                >
                  {essayLayout === "side-by-side"
                    ? "Booklet (A4)"
                    : "Top-Bottom (A4)"}
                </button>
              )}

              {sheetType === "mcq" &&
                (selectedTemplateId === "MCQ10" ||
                  selectedTemplateId === "MCQ20") && (
                  <button
                    type="button"
                    className={`topbar-toggle-btn ${isDoublePrint ? "active" : ""}`}
                    onClick={() => setIsDoublePrint(!isDoublePrint)}
                    title={
                      isDoublePrint
                        ? "2 sheets per A4 page (click for 1 per page)"
                        : "1 sheet per page (click for 2 per page)"
                    }
                  >
                    {isDoublePrint ? "2-up (Double)" : "1-up"}
                  </button>
                )}

              <Button
                variant="ghost"
                size="icon"
                aria-label="Print sheet"
                onClick={handlePrint}
              >
                <Printer />
              </Button>
            </>
          )}
        </div>

        <div className="topbar-right">

          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                ref={menuTriggerRef}
                variant="outline"
                size="icon"
                className="topbar-icon-btn"
                aria-label="Menu"
              >
                <Menu size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="no-print w-56 max-h-[80dvh] overflow-y-auto"
              onCloseAutoFocus={(event) => {
                if (isHistoryOpen || isAnswerKeyOpen) event.preventDefault();
              }}
            >
              <DropdownMenuItem onSelect={() => setIsHistoryOpen(true)}>
                <History /> History
                <span className="ml-auto text-muted-foreground">
                  {history.length}
                </span>
              </DropdownMenuItem>
              {batch.length > 0 && (
                <DropdownMenuItem onSelect={() => setIsBatchSummaryOpen(true)}>
                  <FileCheck /> Batch Results
                  <span className="ml-auto text-emerald-400 font-semibold">{batch.length}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setIsAnswerKeyOpen(true)}>
                <Key /> Answer Key
              </DropdownMenuItem>
              {mode === "scanner" && (
                <DropdownMenuItem onSelect={() => setIsDetailsOpen(true)}>
                  <FileText /> Details & Camera
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => {
                  setSheetType("mcq");
                  setIncludeEssayBack(true);
                  setMode("sheets");
                }}
              >
                <Printer /> Print Sheets
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {mode === "scanner" && (
          <div className="page-transition" key="scanner-page">
            <CameraScanner
              selectedTemplateId={selectedTemplateId}
              answerKeys={answerKeys}
              onScanComplete={handleScanComplete}
              onOpenAnswerKey={() => setIsAnswerKeyOpen(true)}
              onUpdateAnswerKey={(key) => {
                const count = Object.keys(key).length;
                const targetTemplate =
                  count > 0 ? getTemplateForQuestionCount(count) : selectedTemplateId;
                const updated = { ...answerKeys, [targetTemplate]: key };
                setAnswerKeys(updated);
                saveAnswerKey(targetTemplate, key);
                setSelectedTemplateId(targetTemplate);
                setActiveTemplate(targetTemplate);
              }}
              isDetailsOpen={isDetailsOpen}
              onDetailsOpenChange={setIsDetailsOpen}
              batch={batch}
              onKeepBatchItem={handleKeepBatchItem}
              onOpenBatchSummary={() => setIsBatchSummaryOpen(true)}
            />
          </div>
        )}
        {mode === "sheets" && (
          <div className="page-transition page-active">
            <div className="preview-container">
              {sheetType === "essay" ? (
                <div
                  className={`preview-wrapper ${essayLayout === "side-by-side" ? "preview-landscape" : ""}`}
                >
                  <EssaySheet layout={essayLayout} />
                </div>
              ) : includeEssayBack ? (
                <div className="sheets-duplex-container">
                  <div className="sheet-page-card">
                    <div className="sheet-page-badge no-print">
                      Page 1 (Front) • {selectedTemplateId.replace("MCQ", "")} Questions
                    </div>
                    <div className="preview-wrapper print-page-break">
                      <Sheet
                        geometry={geometry}
                        isDouble={
                          isDoublePrint &&
                          (selectedTemplateId === "MCQ10" ||
                            selectedTemplateId === "MCQ20")
                        }
                      />
                    </div>
                  </div>

                  <div className="sheet-page-card">
                    <div className="sheet-page-badge no-print">
                      Page 2 (Back) • Ruled Lines
                    </div>
                    <div className="preview-wrapper">
                      <EssayBackSheet
                        isDouble={
                          isDoublePrint &&
                          (selectedTemplateId === "MCQ10" ||
                            selectedTemplateId === "MCQ20")
                        }
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="preview-wrapper">
                  <Sheet
                    geometry={geometry}
                    isDouble={
                      isDoublePrint &&
                      (selectedTemplateId === "MCQ10" ||
                        selectedTemplateId === "MCQ20")
                    }
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Answer Key Modal */}
      <AnswerKeyModal
        isOpen={isAnswerKeyOpen}
        onClose={() => setIsAnswerKeyOpen(false)}
        onRestoreFocus={restoreMenuFocus}
        onKeysUpdated={(updated) => setAnswerKeys(updated)}
        activeTemplateId={selectedTemplateId}
        onTemplateChange={(tpl) => {
          setSelectedTemplateId(tpl);
          setActiveTemplate(tpl);
        }}
      />

      {/* Slide-over History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRestoreFocus={restoreMenuFocus}
        history={history}
        answerKeys={answerKeys}
        onDeleteScan={handleDeleteScan}
        onClearHistory={handleClearHistory}
      />

      {/* Batch Summary & Export Modal */}
      <BatchSummaryModal
        isOpen={isBatchSummaryOpen}
        onClose={() => setIsBatchSummaryOpen(false)}
        batch={batch}
        testName={TEMPLATES[selectedTemplateId]?.title}
        onScanMore={() => setIsBatchSummaryOpen(false)}
        onClearBatch={() => setBatch([])}
      />
    </div>
  );
};

export default App;
