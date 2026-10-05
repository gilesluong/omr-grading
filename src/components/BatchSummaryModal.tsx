import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  BatchItem,
  formatBatchExport,
  shareBatchResults,
  downloadJsonFile,
} from '../scanner/batch';
import { Share2, Download, AlertTriangle, CheckCircle2, ChevronRight, RotateCcw } from 'lucide-react';

interface BatchSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchItem[];
  testName?: string;
  className?: string;
  onScanMore: () => void;
  onClearBatch: () => void;
}

export const BatchSummaryModal: React.FC<BatchSummaryModalProps> = ({
  isOpen,
  onClose,
  batch,
  testName,
  className,
  onScanMore,
  onClearBatch,
}) => {
  const [filterIssuesOnly, setFilterIssuesOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BatchItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const totalScanned = batch.length;
  const flaggedItems = batch.filter((item) => item.flaggedQuestions.length > 0);
  const readyItems = batch.filter((item) => item.flaggedQuestions.length === 0);

  const displayedList = filterIssuesOnly ? flaggedItems : batch;

  const handleShare = async () => {
    setIsExporting(true);
    setExportFeedback(null);
    try {
      const payload = formatBatchExport(batch, testName, className);
      const res = await shareBatchResults(payload);
      if (res.method === 'share' && res.success) {
        setExportFeedback('✓ Results shared successfully');
      } else if (res.method === 'download') {
        setExportFeedback('✓ JSON file downloaded');
      }
    } catch (err: any) {
      setExportFeedback(`Export error: ${err.message}`);
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportFeedback(null), 3000);
    }
  };

  const handleDirectDownload = () => {
    const payload = formatBatchExport(batch, testName, className);
    const jsonStr = JSON.stringify(payload, null, 2);
    const safeName = (payload.test || 'omr-batch').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadJsonFile(jsonStr, `${safeName}-${dateStr}.json`);
    setExportFeedback('✓ JSON file downloaded');
    setTimeout(() => setExportFeedback(null), 3000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="batch-summary-dialog">
        <div className="batch-summary-header">
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Batch Summary
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {totalScanned} {totalScanned === 1 ? 'paper' : 'papers'} scanned in this session
            </DialogDescription>
          </div>
        </div>

        {/* Status Metrics Banner */}
        <div className="batch-metrics-banner">
          <div className="metric-pill metric-total">
            <span className="metric-number">{totalScanned}</span>
            <span className="metric-label">Scanned</span>
          </div>
          <div className="metric-pill metric-ready">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span className="metric-number text-emerald-400">{readyItems.length}</span>
            <span className="metric-label">Ready</span>
          </div>
          <div
            className={`metric-pill metric-issues ${flaggedItems.length > 0 ? 'metric-has-issues' : ''}`}
            onClick={() => setFilterIssuesOnly(!filterIssuesOnly)}
            role="button"
            tabIndex={0}
          >
            <AlertTriangle size={15} className={flaggedItems.length > 0 ? 'text-amber-400' : 'text-slate-500'} />
            <span className={`metric-number ${flaggedItems.length > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
              {flaggedItems.length}
            </span>
            <span className="metric-label">
              {filterIssuesOnly ? 'Show All' : 'Need Review'}
            </span>
          </div>
        </div>

        {/* Paper Detail Inspection Drawer */}
        {selectedItem ? (
          <div className="batch-item-detail">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-white">
                {selectedItem.studentName || selectedItem.studentId || `Paper #${batch.indexOf(selectedItem) + 1}`}
              </span>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white"
                onClick={() => setSelectedItem(null)}
              >
                ← Back to list
              </button>
            </div>
            <div className="text-xs text-slate-300 mb-2">
              Score: <strong>{selectedItem.score}/{selectedItem.maxScore}</strong> ({selectedItem.percentage}%) · Grade <strong>{selectedItem.letterGrade}</strong>
            </div>

            {selectedItem.flaggedQuestions.length > 0 && (
              <div className="p-2 mb-2 rounded bg-amber-950/40 border border-amber-600/30 text-amber-300 text-xs">
                ⚠️ Flagged questions: {selectedItem.flaggedQuestions.map((q) => `Q${q}`).join(', ')}
              </div>
            )}

            <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-black/40 rounded border border-white/10 text-xs">
              {Object.entries(selectedItem.examScore.results).map(([qStr, res]) => (
                <div
                  key={`detail-q-${qStr}`}
                  className={`p-1.5 rounded text-center font-mono ${
                    res.isCorrect
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      : res.studentChoice === 'BLANK'
                      ? 'bg-red-950/40 text-red-400 border border-red-500/30'
                      : 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  <span className="text-[10px] block opacity-60">Q{qStr}</span>
                  <strong>{res.studentChoice === 'BLANK' ? '—' : res.studentChoice}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Scanned Papers List */
          <div className="batch-papers-list">
            {displayedList.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                {filterIssuesOnly ? 'No flagged issues found! All papers ready.' : 'No papers in this batch yet.'}
              </div>
            ) : (
              displayedList.map((item) => {
                const isFlagged = item.flaggedQuestions.length > 0;
                return (
                  <div
                    key={item.id}
                    className="batch-paper-row"
                    onClick={() => setSelectedItem(item)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="batch-row-left">
                      <span className="batch-row-index">#{batch.indexOf(item) + 1}</span>
                      <div className="batch-row-meta">
                        <span className="batch-row-title">
                          {item.studentName || item.studentId || `Paper #${batch.indexOf(item) + 1}`}
                        </span>
                        <span className="batch-row-sub">
                          {item.score} / {item.maxScore} · {item.percentage}% ({item.letterGrade})
                        </span>
                      </div>
                    </div>

                    <div className="batch-row-right">
                      {isFlagged ? (
                        <span className="badge-flagged">
                          <AlertTriangle size={11} /> {item.flaggedQuestions.length}
                        </span>
                      ) : (
                        <span className="badge-ready">
                          <CheckCircle2 size={11} /> Ready
                        </span>
                      )}
                      <ChevronRight size={14} className="opacity-40" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {exportFeedback && (
          <div className="batch-feedback-toast" role="status">
            {exportFeedback}
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="batch-actions-footer">
          <div className="grid grid-cols-2 gap-2 w-full mb-2">
            <Button
              type="button"
              className="btn-send-results"
              onClick={handleShare}
              disabled={isExporting || totalScanned === 0}
            >
              <Share2 size={16} /> Send Results
            </Button>
            <Button
              type="button"
              variant="outline"
              className="btn-download-json"
              onClick={handleDirectDownload}
              disabled={totalScanned === 0}
            >
              <Download size={16} /> Download JSON
            </Button>
          </div>

          <div className="flex items-center justify-between w-full pt-2 border-t border-white/10">
            <button
              type="button"
              className="btn-scan-more"
              onClick={onScanMore}
            >
              + Scan More Papers
            </button>
            <button
              type="button"
              className="btn-clear-batch"
              onClick={() => {
                if (window.confirm('Clear all papers in current batch?')) {
                  onClearBatch();
                  onClose();
                }
              }}
            >
              <RotateCcw size={12} /> New Batch
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
