import {
  ImagePlus,
  SwitchCamera,
  Camera,
  Key,
  RotateCcw,
  Check,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileCheck,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { previewCrop } from "../scanner/preview";
import React, { useEffect, useRef, useState } from "react";
import { TEMPLATES } from "../omr/templates";
import { TemplateId } from "../omr/types";
import { generateGeometry } from "../omr/geometry";
import { processOMRSheet } from "../scanner/omrDetector";
import { CornerPoints, ScanResult } from "../scanner/types";
import {
  AnswerKey,
  gradeExam,
  loadScoringRules,
} from "../scanner/grading";
import { detectRegistrationMarkers } from "../scanner/markerDetector";
import {
  CameraDeviceOption,
  loadSavedCameraId,
  parseCameraDevices,
  saveSelectedCameraId,
  getRearLenses,
  getFrontCamera,
} from "../scanner/camera";
import { warpPerspective, imageDataToDataUrl } from "../scanner/warp";
import {
  BatchItem,
  detectFlaggedQuestions,
  calculateBatchItemConfidence,
} from "../scanner/batch";

interface CameraScannerProps {
  selectedTemplateId: TemplateId;
  answerKeys: Record<TemplateId, AnswerKey>;
  onScanComplete: (result: ScanResult) => void;
  onOpenAnswerKey?: () => void;
  onUpdateAnswerKey?: (key: AnswerKey) => void;
  isDetailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
  batch: BatchItem[];
  onKeepBatchItem: (item: BatchItem) => void;
  onOpenBatchSummary: () => void;
}

export type ScannerMode = "CAMERA" | "PROCESSING" | "REVIEW";

export const CameraScanner: React.FC<CameraScannerProps> = ({
  answerKeys,
  selectedTemplateId,
  onScanComplete,
  onOpenAnswerKey,
  onUpdateAnswerKey: _onUpdateAnswerKey,
  isDetailsOpen,
  onDetailsOpenChange,
  batch,
  onKeepBatchItem,
  onOpenBatchSummary,
}) => {
  const [scannerMode, setScannerMode] = useState<ScannerMode>("CAMERA");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [availableCameras, setAvailableCameras] = useState<CameraDeviceOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(() =>
    loadSavedCameraId(),
  );
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlashing, setShutterFlashing] = useState<boolean>(false);
  const [internalDetailsOpen, setInternalDetailsOpen] = useState(false);
  const detailsOpen = isDetailsOpen !== undefined ? isDetailsOpen : internalDetailsOpen;
  const setDetailsOpen = onDetailsOpenChange || setInternalDetailsOpen;

  const [testId, setTestId] = useState<string>("");
  const [className, setClassName] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMarkerAligned, setIsMarkerAligned] = useState<boolean>(false);
  const [liveCorners, setLiveCorners] = useState<CornerPoints | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Review State for Frozen Capture
  const [currentReviewItem, setCurrentReviewItem] = useState<BatchItem | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const detailsTriggerRef = useRef<HTMLButtonElement>(null);
  const shutterRef = useRef<HTMLButtonElement>(null);
  const viewfinderRef = useRef<HTMLDivElement>(null);

  const [displayCorners, setDisplayCorners] = useState<CornerPoints | null>(null);
  const displayedCornersRef = useRef<CornerPoints | null>(null);
  const cameraRequestRef = useRef(0);

  // Auto-capture stability tracking
  const stabilityRef = useRef<{
    lastCorners: CornerPoints | null;
    stableSince: number | null;
    isCapturing: boolean;
  }>({
    lastCorners: null,
    stableSince: null,
    isCapturing: false,
  });

  // Reticle animation
  useEffect(() => {
    const from = displayedCornersRef.current;
    if (
      !liveCorners ||
      !from ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      displayedCornersRef.current = liveCorners;
      setDisplayCorners(liveCorners);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / 250, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = {} as CornerPoints;
      for (const corner of ["tl", "tr", "br", "bl"] as const) {
        next[corner] = {
          x: from[corner].x + (liveCorners[corner].x - from[corner].x) * eased,
          y: from[corner].y + (liveCorners[corner].y - from[corner].y) * eased,
        };
      }
      displayedCornersRef.current = next;
      setDisplayCorners(next);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [liveCorners]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const alignIntervalRef = useRef<any>(null);

  const geometry = generateGeometry(TEMPLATES[selectedTemplateId]);
  const currentKey = answerKeys[selectedTemplateId] || {};

  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const currentKeyRef = useRef(currentKey);
  currentKeyRef.current = currentKey;
  const metadataRef = useRef({ studentName, testId, className });
  metadataRef.current = { studentName, testId, className };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const updateVideoSizing = () => {
    if (!videoRef.current || !viewfinderRef.current) return;
    const video = videoRef.current;
    const view = viewfinderRef.current;
    const viewW = view.clientWidth;
    const viewH = view.clientHeight;
    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    if (!viewW || !viewH || !vidW || !vidH) return;

    const coverScale = Math.max(viewW / vidW, viewH / vidH);
    const renderW = Math.ceil(vidW * coverScale);
    const renderH = Math.ceil(vidH * coverScale);
    const currentStyleW = `${renderW}px`;
    const currentStyleH = `${renderH}px`;
    if (video.style.width !== currentStyleW) {
      video.style.width = currentStyleW;
    }
    if (video.style.height !== currentStyleH) {
      video.style.height = currentStyleH;
    }
  };

  useEffect(() => {
    window.addEventListener("resize", updateVideoSizing);
    return () => window.removeEventListener("resize", updateVideoSizing);
  }, []);

  // Start Camera Stream
  const startCamera = async (overrideCameraId?: string) => {
    const request = ++cameraRequestRef.current;
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const activeCameraId =
        overrideCameraId !== undefined ? overrideCameraId : selectedCameraId;

      let stream: MediaStream;
      try {
        if (activeCameraId) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: activeCameraId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        }
      } catch (idealErr) {
        console.warn("Targeted camera constraints failed, trying basic fallback:", idealErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: activeCameraId
              ? { deviceId: { ideal: activeCameraId } }
              : { facingMode: { ideal: facingMode } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          updateVideoSizing();
          videoRef.current?.play().catch((e) => console.warn("Play error:", e));
        };
        try {
          await videoRef.current.play();
          updateVideoSizing();
        } catch (playErr) {
          console.warn("Direct play warning:", playErr);
        }
      }

      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const raw = await navigator.mediaDevices.enumerateDevices();
          const parsed = parseCameraDevices(raw);
          setAvailableCameras(parsed);

          const activeTrack = stream.getVideoTracks()[0];
          const settings = activeTrack?.getSettings?.();
          if (settings?.deviceId && !activeCameraId) {
            setSelectedCameraId(settings.deviceId);
            saveSelectedCameraId(settings.deviceId);
          }
        } catch (enumErr) {
          console.warn("Could not enumerate camera devices:", enumErr);
        }
      }
    } catch (err: any) {
      if (request !== cameraRequestRef.current) return;
      console.warn("getUserMedia failed:", err);
      setCameraError(
        'Camera permission was blocked or is unavailable. Use "Upload Photo" below for direct photo capture.',
      );
      setCameraActive(false);
    }
  };

  const handleSelectCamera = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    saveSelectedCameraId(deviceId);
    await startCamera(deviceId);
    const cam = availableCameras.find((c) => c.deviceId === deviceId);
    if (cam) {
      showToast(`Switched to ${cam.label} (${cam.shortLabel})`);
    }
  };

  const handleCycleCamera = async () => {
    const rearLenses = getRearLenses(availableCameras);
    const frontCam = getFrontCamera(availableCameras);
    const activeCam = availableCameras.find((c) => c.deviceId === selectedCameraId);
    const isBack = activeCam ? activeCam.isBack : facingMode === "environment";

    if (isBack && frontCam) {
      await handleSelectCamera(frontCam.deviceId);
      setFacingMode("user");
    } else if (!isBack && rearLenses.length > 0) {
      const savedId = loadSavedCameraId();
      const targetRear =
        rearLenses.find((c) => c.deviceId === savedId) ||
        rearLenses.find((c) => c.shortLabel === "1x") ||
        rearLenses[0];
      await handleSelectCamera(targetRear.deviceId);
      setFacingMode("environment");
    } else if (availableCameras.length > 1) {
      const currentIndex = availableCameras.findIndex(
        (c) => c.deviceId === selectedCameraId,
      );
      const nextIndex = (currentIndex + 1) % availableCameras.length;
      const nextCamera = availableCameras[nextIndex];
      if (nextCamera) {
        await handleSelectCamera(nextCamera.deviceId);
      }
    } else {
      setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    }
  };

  const stopCamera = () => {
    cameraRequestRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (alignIntervalRef.current) {
      clearInterval(alignIntervalRef.current);
    }
    setCameraActive(false);
    setIsMarkerAligned(false);
    setLiveCorners(null);
  };

  useEffect(() => {
    startCamera();
    const handleDeviceChange = async () => {
      if (navigator.mediaDevices?.enumerateDevices) {
        const raw = await navigator.mediaDevices.enumerateDevices();
        setAvailableCameras(parseCameraDevices(raw));
      }
    };
    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
      stopCamera();
    };
  }, [facingMode]);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current
        .play()
        .then(() => updateVideoSizing())
        .catch((e) => console.warn("Play attachment error:", e));
    }
  }, [cameraActive]);

  /**
   * LIGHTWEIGHT LIVE ACQUISITION LOOP
   * Only detects 4 sheet corners and evaluates capture stability.
   * DOES NOT run OMR bubble sampling or live grading overlay.
   */
  useEffect(() => {
    if (!cameraActive || scannerMode !== "CAMERA") return;

    alignIntervalRef.current = setInterval(() => {
      if (
        !videoRef.current ||
        !canvasRef.current ||
        videoRef.current.readyState < 2
      )
        return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const view = viewfinderRef.current;
      if (!view || !video.videoWidth || !video.videoHeight) return;

      updateVideoSizing();
      const crop = previewCrop(
        video.videoWidth,
        video.videoHeight,
        view.clientWidth,
        view.clientHeight,
      );

      // Lightweight 480px sampling for rapid corner fiducial detection
      const scale = 480 / Math.max(crop.width, crop.height);
      const w = Math.round(crop.width * scale);
      const h = Math.round(crop.height * scale);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);

      try {
        const imgData = ctx.getImageData(0, 0, w, h);
        const padX = w * 0.1;
        const padY = h * 0.08;
        const defaultCorners: CornerPoints = {
          tl: { x: padX, y: padY },
          tr: { x: w - padX, y: padY },
          br: { x: w - padX, y: h - padY },
          bl: { x: padX, y: h - padY },
        };

        const detection = detectRegistrationMarkers(imgData, defaultCorners);
        setIsMarkerAligned(detection.detected);

        if (detection.detected) {
          const cornersNorm: CornerPoints = {
            tl: { x: (detection.corners.tl.x / w) * 100, y: (detection.corners.tl.y / h) * 100 },
            tr: { x: (detection.corners.tr.x / w) * 100, y: (detection.corners.tr.y / h) * 100 },
            br: { x: (detection.corners.br.x / w) * 100, y: (detection.corners.br.y / h) * 100 },
            bl: { x: (detection.corners.bl.x / w) * 100, y: (detection.corners.bl.y / h) * 100 },
          };
          setLiveCorners(cornersNorm);

          // Evaluate Stability & Quality:
          // 1. Minimum Sheet Size in Frame: Area of quadrilateral > 18% of viewfinder
          const c = cornersNorm;
          const quadArea =
            0.5 *
            Math.abs(
              (c.tl.x * c.tr.y - c.tr.x * c.tl.y) +
              (c.tr.x * c.br.y - c.br.x * c.tr.y) +
              (c.br.x * c.bl.y - c.bl.x * c.br.y) +
              (c.bl.x * c.tl.y - c.bl.x * c.tl.y)
            );

          const isLargeEnough = quadArea >= 1800; // >= 18% of 100x100 area

          // 2. Corner displacement stability check
          const last = stabilityRef.current.lastCorners;
          let isStationary = false;
          if (last) {
            const shiftTL = Math.hypot(c.tl.x - last.tl.x, c.tl.y - last.tl.y);
            const shiftTR = Math.hypot(c.tr.x - last.tr.x, c.tr.y - last.tr.y);
            const shiftBR = Math.hypot(c.br.x - last.br.x, c.br.y - last.br.y);
            const shiftBL = Math.hypot(c.bl.x - last.bl.x, c.bl.y - last.bl.y);
            const maxShift = Math.max(shiftTL, shiftTR, shiftBR, shiftBL);
            isStationary = maxShift < 2.0; // Corner moved less than 2.0% of frame
          }

          stabilityRef.current.lastCorners = c;

          if (isLargeEnough && isStationary) {
            if (stabilityRef.current.stableSince === null) {
              stabilityRef.current.stableSince = Date.now();
            } else if (
              Date.now() - stabilityRef.current.stableSince >= 380 &&
              !stabilityRef.current.isCapturing
            ) {
              // Sheet stable for 380ms -> Trigger AUTO-CAPTURE!
              triggerFreezeCapture();
            }
          } else {
            stabilityRef.current.stableSince = null;
          }
        } else {
          setLiveCorners(null);
          stabilityRef.current.stableSince = null;
          stabilityRef.current.lastCorners = null;
        }
      } catch {
        // Ignore sampling glitches
      }
    }, 180);

    return () => {
      if (alignIntervalRef.current) clearInterval(alignIntervalRef.current);
    };
  }, [cameraActive, scannerMode]);

  /**
   * FREEZE & GRADE PIPELINE
   * Grabs static high-res frame, rectifies geometry, runs OMR once, and freezes for Review.
   */
  const triggerFreezeCapture = (customCanvas?: HTMLCanvasElement) => {
    if (stabilityRef.current.isCapturing || scannerMode === "PROCESSING" || scannerMode === "REVIEW") {
      return;
    }
    stabilityRef.current.isCapturing = true;
    setScannerMode("PROCESSING");

    // Haptic feedback
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([35]);
      } catch {}
    }

    setShutterFlashing(true);
    setTimeout(() => setShutterFlashing(false), 200);

    try {
      let captureCanvas = customCanvas;
      if (!captureCanvas) {
        if (!videoRef.current) throw new Error("Video source unavailable");
        const video = videoRef.current;
        const view = viewfinderRef.current;
        if (!view) throw new Error("Viewfinder unavailable");

        const crop = previewCrop(
          video.videoWidth,
          video.videoHeight,
          view.clientWidth,
          view.clientHeight,
        );

        const highResCanvas = document.createElement("canvas");
        const scale = Math.min(1, 1920 / Math.max(crop.width, crop.height));
        highResCanvas.width = Math.round(crop.width * scale);
        highResCanvas.height = Math.round(crop.height * scale);
        const ctx = highResCanvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Could not create capture canvas");

        ctx.drawImage(
          video,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          highResCanvas.width,
          highResCanvas.height,
        );
        captureCanvas = highResCanvas;
      }

      const ctx = captureCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas context missing");
      const imgWidth = captureCanvas.width;
      const imgHeight = captureCanvas.height;
      const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);

      // Detect exact fiducials on high-res frame
      const guidedCorners: CornerPoints = {
        tl: { x: imgWidth * 0.1, y: imgHeight * 0.08 },
        tr: { x: imgWidth * 0.9, y: imgHeight * 0.08 },
        br: { x: imgWidth * 0.9, y: imgHeight * 0.92 },
        bl: { x: imgWidth * 0.1, y: imgHeight * 0.92 },
      };

      const markerCheck = detectRegistrationMarkers(imageData, guidedCorners);
      if (!markerCheck.detected) {
        throw new Error("Could not detect all 4 corner markers clearly. Please realign sheet.");
      }

      // 1. Perspective rectify sheet into static orthogonal image
      const rectified = warpPerspective(imageData, markerCheck.corners, 360, 509);
      const rectifiedUrl = imageDataToDataUrl(rectified);

      // 2. Run OMR Analysis & Grading ONCE on the frozen capture
      const activeGeom = geometryRef.current;
      const key = currentKeyRef.current;
      const meta = metadataRef.current;

      const scanResult = processOMRSheet(imageData, activeGeom, markerCheck.corners);
      scanResult.studentName = meta.studentName.trim() || undefined;
      scanResult.testId = meta.testId.trim() || undefined;
      scanResult.className = meta.className.trim() || undefined;

      const examScore = gradeExam(scanResult, key, loadScoringRules());
      const flagged = detectFlaggedQuestions(scanResult, examScore);
      const confidence = calculateBatchItemConfidence(scanResult, examScore);

      const reviewItem: BatchItem = {
        id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        studentId: meta.studentName.trim() || undefined,
        studentName: meta.studentName.trim() || undefined,
        testId: meta.testId.trim() || undefined,
        className: meta.className.trim() || undefined,
        score: examScore.correctCount,
        maxScore: examScore.totalQuestions,
        percentage: examScore.percentage,
        letterGrade: examScore.letterGrade,
        answers: Object.entries(examScore.results).map(([_, r]) => r.studentChoice),
        flaggedQuestions: flagged,
        confidence,
        scanResult,
        examScore,
        rectifiedImageUrl: rectifiedUrl,
      };

      setCurrentReviewItem(reviewItem);
      setSwipeOffset(0);
      setScannerMode("REVIEW");
    } catch (err: any) {
      console.warn("Capture processing failed:", err);
      setScanError(err.message || "Failed to process sheet. Realign and try again.");
      setTimeout(() => setScanError(null), 3500);
      setScannerMode("CAMERA");
    } finally {
      stabilityRef.current.isCapturing = false;
      stabilityRef.current.stableSince = null;
    }
  };

  /**
   * REVIEW ACTIONS: KEEP vs RETAKE
   */
  const handleKeep = () => {
    if (!currentReviewItem) return;

    // Haptic confirmation
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([25, 20, 25]);
      } catch {}
    }

    onKeepBatchItem(currentReviewItem);
    onScanComplete(currentReviewItem.scanResult);

    showToast(`✓ Kept #${batch.length + 1} (${currentReviewItem.score}/${currentReviewItem.maxScore})`);

    // Reset immediately back to camera for the next paper!
    setCurrentReviewItem(null);
    setSwipeOffset(0);
    setScannerMode("CAMERA");
  };

  const handleRetake = () => {
    setCurrentReviewItem(null);
    setSwipeOffset(0);
    setScannerMode("CAMERA");
  };

  // Touch Swipe Handlers for One-Handed Review
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scannerMode !== "REVIEW") return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (scannerMode !== "REVIEW" || !touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Favor horizontal swipe
    if (Math.abs(dx) > Math.abs(dy)) {
      setSwipeOffset(dx);
    }
  };

  const handleTouchEnd = () => {
    if (scannerMode !== "REVIEW") return;
    if (swipeOffset > 85) {
      // Swiped Right -> KEEP
      handleKeep();
    } else if (swipeOffset < -85) {
      // Swiped Left -> RETAKE
      handleRetake();
    } else {
      // Snap back
      setSwipeOffset(0);
    }
    touchStartRef.current = null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const uploadCanvas = document.createElement("canvas");
        const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
        uploadCanvas.width = Math.round(img.width * scale);
        uploadCanvas.height = Math.round(img.height * scale);
        const ctx = uploadCanvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, uploadCanvas.width, uploadCanvas.height);
        triggerFreezeCapture(uploadCanvas);
      };
      img.onerror = () => setScanError("Could not open image. Try another photo.");
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const rearLenses = getRearLenses(availableCameras);
  const activeCam = availableCameras.find((c) => c.deviceId === selectedCameraId);
  const isBackActive = activeCam ? activeCam.isBack : facingMode === "environment";

  return (
    <div className="scanner-container">
      {/* Viewfinder / Frozen Frame Area */}
      <div className="viewfinder-section">
        <div className="viewfinder-wrapper" ref={viewfinderRef}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="viewfinder-video"
            style={{
              opacity: cameraActive && scannerMode === "CAMERA" ? 1 : 0,
              pointerEvents: cameraActive && scannerMode === "CAMERA" ? "auto" : "none",
            }}
          />

          {/* Shutter flash animation */}
          {shutterFlashing && <div className="shutter-flash-overlay" aria-hidden="true" />}

          {/* Camera Unavailable Placeholder */}
          {!cameraActive && (
            <div className="viewfinder-placeholder">
              <Camera size={36} strokeWidth={1.25} />
              <p>{cameraError ? "Camera unavailable" : "Ready to scan"}</p>
              <Button onClick={() => startCamera()}>Enable camera</Button>
              <button
                className="text-button"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose a photo
              </button>
            </div>
          )}

          {/* LIVE CAMERA OVERLAY: Minimal Fiducials & Alignment Guide ONLY */}
          {cameraActive && scannerMode === "CAMERA" && (
            <div className="viewfinder-overlay">
              <div
                className={`standby-document-guide ${displayCorners ? "guide-hidden" : ""}`}
                aria-hidden="true"
              >
                <div className="guide-corner guide-tl" />
                <div className="guide-corner guide-tr" />
                <div className="guide-corner guide-br" />
                <div className="guide-corner guide-bl" />
              </div>

              <svg
                className="viewfinder-svg"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {displayCorners && (
                  <>
                    <polygon
                      points={`${displayCorners.tl.x},${displayCorners.tl.y} ${displayCorners.tr.x},${displayCorners.tr.y} ${displayCorners.br.x},${displayCorners.br.y} ${displayCorners.bl.x},${displayCorners.bl.y}`}
                      className="detected-quad"
                    />
                    {(["tl", "tr", "br", "bl"] as const).map((cornerKey) => {
                      const pt = displayCorners[cornerKey];
                      return (
                        <g key={`pin-${cornerKey}`} className="corner-lock-pin">
                          <circle cx={pt.x} cy={pt.y} r="2.2" className="corner-pin-glow" />
                          <circle cx={pt.x} cy={pt.y} r="1.4" className="corner-pin-ring" />
                          <circle cx={pt.x} cy={pt.y} r="0.65" className="corner-pin-pip" />
                        </g>
                      );
                    })}
                  </>
                )}
              </svg>

              {/* Minimal Status Guide Pill */}
              <div className="apple-status-pill" role="status">
                <span
                  className={`apple-status-text ${isMarkerAligned ? "status-ready" : ""}`}
                >
                  {isMarkerAligned
                    ? "Sheet detected · Hold steady..."
                    : "Align sheet inside view"}
                </span>
              </div>
            </div>
          )}

          {/* STATIC REVIEW CARD (ONE-HANDED SWIPEABLE) */}
          {scannerMode === "REVIEW" && currentReviewItem && (
            <div
              className="static-review-card-container"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="static-review-card"
                style={{
                  transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.035}deg)`,
                  transition: swipeOffset === 0 ? "transform 0.22s ease-out" : "none",
                }}
              >
                {/* Swipe Direction Hint Indicator */}
                {swipeOffset > 40 && (
                  <div className="swipe-hint swipe-hint-keep">
                    <Check size={28} /> KEEP
                  </div>
                )}
                {swipeOffset < -40 && (
                  <div className="swipe-hint swipe-hint-retake">
                    <RotateCcw size={28} /> RETAKE
                  </div>
                )}

                {/* Score & Grade Header */}
                <div className="review-card-header">
                  <div className="review-score-badge">
                    <span className="review-fraction">
                      <strong>{currentReviewItem.score}</strong> / {currentReviewItem.maxScore}
                    </span>
                    <span className={`review-grade grade-${currentReviewItem.letterGrade}`}>
                      {currentReviewItem.letterGrade}
                    </span>
                    <span className="review-pct">{currentReviewItem.percentage}%</span>
                  </div>

                  <span className="review-paper-number">
                    Paper #{batch.length + 1}
                  </span>
                </div>

                {/* Rectified Static Sheet Preview */}
                <div className="review-image-frame">
                  {currentReviewItem.rectifiedImageUrl ? (
                    <img
                      src={currentReviewItem.rectifiedImageUrl}
                      alt="Captured Exam Sheet"
                      className="review-rectified-img"
                    />
                  ) : (
                    <div className="text-xs text-slate-500 py-12">Sheet captured</div>
                  )}
                </div>

                {/* Ambiguous / Flagged Alert Bar */}
                <div className="review-flag-bar">
                  {currentReviewItem.flaggedQuestions.length > 0 ? (
                    <div className="flag-bar-alert">
                      <AlertTriangle size={14} className="text-amber-400" />
                      <span>
                        Needs Review: {currentReviewItem.flaggedQuestions.map((q) => `Q${q}`).join(", ")}
                      </span>
                    </div>
                  ) : (
                    <div className="flag-bar-clear">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span>All {currentReviewItem.maxScore} answers verified clear</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live Scanner Toast */}
          {toastMessage && (
            <div className="camera-toast" role="status">
              {toastMessage}
            </div>
          )}

          {/* Floating error alert */}
          {scanError && (
            <div className="camera-floating-error" role="alert">
              <span>{scanError}</span>
              <button
                type="button"
                className="btn-dismiss-error"
                onClick={() => setScanError(null)}
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          {/* Apple Camera-Style Minimal Zoom Switcher */}
          {cameraActive && rearLenses.length > 1 && isBackActive && scannerMode === "CAMERA" && (
            <div className="apple-zoom-bar" role="group" aria-label="Camera zoom">
              {rearLenses.map((cam) => {
                const isActive =
                  selectedCameraId === cam.deviceId ||
                  (!selectedCameraId && cam.shortLabel === "1x");
                return (
                  <button
                    key={cam.deviceId}
                    type="button"
                    className={`apple-zoom-btn ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectCamera(cam.deviceId)}
                    aria-pressed={isActive}
                    title={cam.label}
                  >
                    <span className="apple-zoom-label">
                      {isActive ? `${cam.zoomLabel}×` : cam.zoomLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM CONTROLS & BATCH STATUS */}
        {scannerMode === "REVIEW" ? (
          /* REVIEW MODE CONTROLS: Large Thumb Buttons for One-Handed Use */
          <div className="review-actions-bar">
            <button
              type="button"
              className="btn-review-action btn-review-retake"
              onClick={handleRetake}
              aria-label="Retake this sheet"
            >
              <ArrowLeft size={16} /> Retake
            </button>

            <button
              type="button"
              className="btn-review-action btn-review-keep"
              onClick={handleKeep}
              aria-label="Keep this sheet and scan next"
            >
              Keep <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          /* CAMERA CAPTURE CONTROLS */
          <div className="scanner-controls-bar">
            {/* Batch Counter / Finish Batch Button */}
            <div className="scanner-batch-indicator">
              <button
                type="button"
                className="btn-batch-counter"
                onClick={onOpenBatchSummary}
                title="View batch summary"
              >
                <FileCheck size={14} />
                <span>{batch.length} {batch.length === 1 ? 'paper' : 'papers'}</span>
              </button>

              {batch.length > 0 && (
                <button
                  type="button"
                  className="btn-finish-batch-pill"
                  onClick={onOpenBatchSummary}
                >
                  Finish Batch
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn-apple-control"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload photo"
              title="Upload photo"
            >
              <ImagePlus size={22} strokeWidth={1.8} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileUpload}
            />

            {/* Manual Shutter Fallback */}
            <button
              type="button"
              ref={shutterRef}
              className={`btn-shutter-apple ${isMarkerAligned ? "ready-capture" : ""}`}
              onClick={() => triggerFreezeCapture()}
              disabled={scannerMode === "PROCESSING"}
              aria-label="Capture exam sheet"
              title="Capture exam sheet"
            >
              <span className="btn-shutter-inner" />
            </button>

            <button
              type="button"
              className="btn-apple-control"
              onClick={handleCycleCamera}
              aria-label="Flip camera"
              title="Flip camera"
            >
              <SwitchCamera size={23} strokeWidth={1.8} />
            </button>
          </div>
        )}

        <canvas ref={canvasRef} hidden />
      </div>

      {/* Details & Setup Sheet */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent
          onCloseAutoFocus={(event: any) => {
            event.preventDefault();
            detailsTriggerRef.current?.focus();
          }}
          className="camera-bottom-sheet"
        >
          <SheetTitle>Scan details</SheetTitle>
          <SheetDescription>Optional exam labels and camera setup.</SheetDescription>
          <div className="details-fields">
            {availableCameras.length > 0 && (
              <label>
                Camera Lens
                <select
                  className="student-input"
                  value={selectedCameraId || ""}
                  onChange={(e) => handleSelectCamera(e.target.value)}
                >
                  {availableCameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label} ({cam.shortLabel})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Student
              <input
                className="student-input"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Name or ID"
              />
            </label>
            <label>
              Test
              <input
                className="student-input"
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
                placeholder="Test name"
              />
            </label>
            <label>
              Class
              <input
                className="student-input"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Class name"
              />
            </label>
            {onOpenAnswerKey && (
              <div style={{ marginTop: "4px" }}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2"
                  style={{ color: "#ffd60a", borderColor: "rgba(255, 214, 10, 0.35)" }}
                  onClick={() => {
                    setDetailsOpen(false);
                    onOpenAnswerKey();
                  }}
                >
                  <Key size={15} />
                  Configure Answer Key ({Object.keys(currentKey).length} Qs)
                </Button>
              </div>
            )}
          </div>
          <Button onClick={() => setDetailsOpen(false)}>Done</Button>
        </SheetContent>
      </Sheet>
    </div>
  );
};
