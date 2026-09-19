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
import { AnswerKey, loadAnswerKeys, saveAnswerKey } from "./scanner/grading";
import { ScanResult } from "./scanner/types";
import {
  Menu,
  History,
  Key,
  FileText,
  Printer,
  ChevronDown,
  PenLine,
} from "lucide-react";
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
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<TemplateId>("MCQ20");
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isAnswerKeyOpen, setIsAnswerKeyOpen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isDoublePrint, setIsDoublePrint] = useState<boolean>(true);
  const [includeEssayBack, setIncludeEssayBack] = useState<boolean>(true);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [answerKeys, setAnswerKeys] =
    useState<Record<TemplateId, AnswerKey>>(loadAnswerKeys());

  useEffect(() => {
    setHistory(loadScanHistory());
  }, []);

  const config = TEMPLATES[selectedTemplateId];
  const geometry = useMemo(() => generateGeometry(config), [config]);

  const handlePrint = () => {
    setIsMenuOpen(false);
    window.print();
  };

  const handleScanComplete = (result: ScanResult) => {
    const updated = saveScanResult(result);
    setHistory(updated);
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
          {mode === "sheets" && (
            <button
              className="topbar-back-btn"
              onClick={() => setMode("scanner")}
            >
              ← Scan
            </button>
          )}
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

          {mode === "scanner" && (
            <button
              type="button"
              className="topbar-key-btn"
              onClick={() => setIsAnswerKeyOpen(true)}
              title="Configure master answer key for this test"
              aria-label="Answer key"
            >
              <Key size={13} />
              <span>Key ({Object.keys(answerKeys[selectedTemplateId] || {}).length} Qs)</span>
            </button>
          )}

          {mode === "sheets" && sheetType === "mcq" && (
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

          {mode === "sheets" && sheetType === "essay" && (
            <button
              type="button"
              className="topbar-toggle-btn"
              onClick={() => setSheetType("mcq")}
              title="Return to OMR bubble sheets"
            >
              <FileText size={13} /> OMR Bubbles
            </button>
          )}

          {mode === "sheets" && sheetType === "essay" && (
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

          {mode === "sheets" &&
            sheetType === "mcq" &&
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

          {mode === "sheets" && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Print sheet"
              onClick={handlePrint}
            >
              <Printer />
            </Button>
          )}
        </div>

        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              ref={menuTriggerRef}
              variant="outline"
              size="icon"
              aria-label="Menu"
            >
              <Menu size={22} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="no-print w-72 max-h-[80dvh] overflow-y-auto"
            onCloseAutoFocus={(event) => {
              // Let the newly opened dialog keep focus instead of returning it to the menu.
              if (isHistoryOpen || isAnswerKeyOpen) event.preventDefault();
            }}
          >
            <DropdownMenuItem onSelect={() => setIsHistoryOpen(true)}>
              <History /> History{" "}
              <span className="ml-auto text-muted-foreground">
                {history.length}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIsAnswerKeyOpen(true)}>
              <Key /> Answer Key
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setSheetType("mcq");
                setIncludeEssayBack(false);
                setMode("sheets");
              }}
            >
              <FileText /> Print Bubble Sheets (Front only)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setSheetType("mcq");
                setIncludeEssayBack(true);
                setMode("sheets");
              }}
            >
              <PenLine /> Print 2-Sided (Front: Bubbles, Back: Lines)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setSheetType("essay");
                setMode("sheets");
              }}
            >
              <PenLine /> Print Standalone Essay (2-in-1)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                const updated = { ...answerKeys, [selectedTemplateId]: key };
                setAnswerKeys(updated);
                saveAnswerKey(selectedTemplateId, key);
              }}
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

      {/* Master Answer Key Modal */}
      <AnswerKeyModal
        isOpen={isAnswerKeyOpen}
        onClose={() => setIsAnswerKeyOpen(false)}
        onRestoreFocus={restoreMenuFocus}
        onKeysUpdated={(updated) => setAnswerKeys(updated)}
        activeTemplateId={selectedTemplateId}
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
    </div>
  );
};

export default App;
