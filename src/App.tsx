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
import { CameraScanner } from "./components/CameraScanner";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { AnswerKeyModal } from "./components/AnswerKeyModal";
import {
  clearScanHistory,
  deleteScanResult,
  loadScanHistory,
  saveScanResult,
} from "./scanner/storage";
import { AnswerKey, loadAnswerKeys } from "./scanner/grading";
import { ScanResult } from "./scanner/types";
import { Menu, History, Key, FileText, Printer, ChevronDown } from "lucide-react";
import "./styles/globals.css";
import "./styles/app.css";
import "./styles/print.css";

type AppMode = "scanner" | "sheets";

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
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<TemplateId>("MCQ20");
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isAnswerKeyOpen, setIsAnswerKeyOpen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isDoublePrint, setIsDoublePrint] = useState<boolean>(true);
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
          <div className="template-select-wrapper">
            <select
              className="template-select"
              aria-label="Questions per sheet"
              value={selectedTemplateId}
              onChange={(event) =>
                setSelectedTemplateId(event.target.value as TemplateId)
              }
            >
              {TEMPLATE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} questions
                </option>
              ))}
            </select>
            <ChevronDown className="template-select-icon" aria-hidden="true" />
          </div>
          {mode === "sheets" &&
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
              onSelect={() =>
                setMode(mode === "scanner" ? "sheets" : "scanner")
              }
            >
              <FileText /> {mode === "scanner" ? "Print Sheets" : "Scan"}
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
            />
          </div>
        )}
        {mode === "sheets" && (
          <div className="page-transition page-active">
            <div className="preview-container">
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
