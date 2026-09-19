import {
  ImagePlus,
  SwitchCamera,
  SlidersHorizontal,
  Camera,
  Copy,
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
  ExamScore,
  formatGradedSlackMessage,
  gradeExam,
  loadScoringRules,
} from "../scanner/grading";
import { detectRegistrationMarkers } from "../scanner/markerDetector";
import { ARBubbleOverlay, computeARBubbleOverlays } from "../scanner/arOverlay";
import {
  CameraDeviceOption,
  loadSavedCameraId,
  parseCameraDevices,
  saveSelectedCameraId,
  getRearLenses,
  getFrontCamera,
} from "../scanner/camera";

interface CameraScannerProps {
  selectedTemplateId: TemplateId;
  answerKeys: Record<TemplateId, AnswerKey>;
  onScanComplete: (result: ScanResult) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  answerKeys,
  selectedTemplateId,
  onScanComplete,
}) => {
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [availableCameras, setAvailableCameras] = useState<
    CameraDeviceOption[]
  >([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(() =>
    loadSavedCameraId(),
  );
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [lastExamScore, setLastExamScore] = useState<ExamScore | null>(null);
  const [liveOverlays, setLiveOverlays] = useState<ARBubbleOverlay[]>([]);
  const [liveExamScore, setLiveExamScore] = useState<ExamScore | null>(null);
  const [liveScanResult, setLiveScanResult] = useState<ScanResult | null>(null);
  const [shutterFlashing, setShutterFlashing] = useState<boolean>(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [testId, setTestId] = useState<string>("");
  const [className, setClassName] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMarkerAligned, setIsMarkerAligned] = useState<boolean>(false);
  const [liveCorners, setLiveCorners] = useState<CornerPoints | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const detailsTriggerRef = useRef<HTMLButtonElement>(null);
  const shutterRef = useRef<HTMLButtonElement>(null);
  const viewfinderRef = useRef<HTMLDivElement>(null);

  const [displayCorners, setDisplayCorners] = useState<CornerPoints | null>(
    null,
  );
  const displayedCornersRef = useRef<CornerPoints | null>(null);
  const cameraRequestRef = useRef(0);

  // Animate only the reticle; grading always uses the original detected geometry.
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
        console.warn(
          "Targeted camera constraints failed, trying basic fallback:",
          idealErr,
        );
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
          videoRef.current?.play().catch((e) => console.warn("Play error:", e));
        };
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Direct play warning:", playErr);
        }
      }

      // Enumerate devices once permission has been granted
      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const raw = await navigator.mediaDevices.enumerateDevices();
          const parsed = parseCameraDevices(raw);
          setAvailableCameras(parsed);

          // Track current device id if not explicitly set
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
      console.warn("getUserMedia failed, falling back to file input:", err);
      setCameraError(
        'Camera permission was blocked or is unavailable. Use "📁 Upload Photo" below for direct photo capture.',
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
    const activeCam = availableCameras.find(
      (c) => c.deviceId === selectedCameraId,
    );
    const isBack = activeCam ? activeCam.isBack : facingMode === "environment";

    if (isBack && frontCam) {
      // Flip from rear to front camera
      await handleSelectCamera(frontCam.deviceId);
      setFacingMode("user");
    } else if (!isBack && rearLenses.length > 0) {
      // Flip from front back to preferred rear lens (or default 1x)
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

  // Stop Camera
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
    setLiveOverlays([]);
    setLiveExamScore(null);
    setLiveScanResult(null);
  };

  useEffect(() => {
    startCamera();
    const handleDeviceChange = async () => {
      if (navigator.mediaDevices?.enumerateDevices) {
        const raw = await navigator.mediaDevices.enumerateDevices();
        setAvailableCameras(parseCameraDevices(raw));
      }
    };
    navigator.mediaDevices?.addEventListener(
      "devicechange",
      handleDeviceChange,
    );
    return () => {
      navigator.mediaDevices?.removeEventListener(
        "devicechange",
        handleDeviceChange,
      );
      stopCamera();
    };
  }, [facingMode]);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current
        .play()
        .catch((e) => console.warn("Play attachment error:", e));
    }
  }, [cameraActive]);

  // Periodic Auto-Marker Alignment & Real-Time OMR Grading Detection
  useEffect(() => {
    if (!cameraActive) return;

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
      const crop = previewCrop(
        video.videoWidth,
        video.videoHeight,
        view.clientWidth,
        view.clientHeight,
      );
      const scale = 720 / Math.max(crop.width, crop.height);
      const w = Math.round(crop.width * scale),
        h = Math.round(crop.height * scale);
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
          setLiveCorners({
            tl: {
              x: (detection.corners.tl.x / w) * 100,
              y: (detection.corners.tl.y / h) * 100,
            },
            tr: {
              x: (detection.corners.tr.x / w) * 100,
              y: (detection.corners.tr.y / h) * 100,
            },
            br: {
              x: (detection.corners.br.x / w) * 100,
              y: (detection.corners.br.y / h) * 100,
            },
            bl: {
              x: (detection.corners.bl.x / w) * 100,
              y: (detection.corners.bl.y / h) * 100,
            },
          });

          try {
            const activeGeom = geometryRef.current;
            const key = currentKeyRef.current;
            const meta = metadataRef.current;

            const result = processOMRSheet(imgData, activeGeom, detection.corners);
            result.studentName = meta.studentName.trim() || undefined;
            result.testId = meta.testId.trim() || undefined;
            result.className = meta.className.trim() || undefined;

            const score = gradeExam(result, key, loadScoringRules());
            const { overlays } = computeARBubbleOverlays(
              detection.corners,
              w,
              h,
              activeGeom,
              result,
              score,
            );

            setLiveScanResult(result);
            setLiveExamScore(score);
            setLiveOverlays(overlays);
          } catch {
            // Transient frame error, keep corners but clear overlays
            setLiveOverlays([]);
            setLiveExamScore(null);
            setLiveScanResult(null);
          }
        } else {
          setLiveCorners(null);
          setLiveOverlays([]);
          setLiveExamScore(null);
          setLiveScanResult(null);
        }
      } catch {
        // ignore fast sampling errors
      }
    }, 320);

    return () => {
      if (alignIntervalRef.current) clearInterval(alignIntervalRef.current);
    };
  }, [cameraActive]);

  // Scan current frame from video or image
  const executeScan = (sourceCanvas: HTMLCanvasElement) => {
    setIsProcessing(true);
    setScanError(null);
    setToastMessage(null);
    setLastScanResult(null);
    setLastExamScore(null);
    try {
      const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const imgWidth = sourceCanvas.width;
      const imgHeight = sourceCanvas.height;
      const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);

      // Default guided corner reticle coordinates
      const paddingX = imgWidth * 0.1;
      const paddingY = imgHeight * 0.08;
      const frameWidth = imgWidth - 2 * paddingX;
      const frameHeight = imgHeight - 2 * paddingY;

      const markerFracX = 16 / 210;
      const markerFracY = 16 / 297;

      const guidedCorners: CornerPoints = {
        tl: {
          x: paddingX + frameWidth * markerFracX,
          y: paddingY + frameHeight * markerFracY,
        },
        tr: {
          x: paddingX + frameWidth * (1 - markerFracX),
          y: paddingY + frameHeight * markerFracY,
        },
        br: {
          x: paddingX + frameWidth * (1 - markerFracX),
          y: paddingY + frameHeight * (1 - markerFracY),
        },
        bl: {
          x: paddingX + frameWidth * markerFracX,
          y: paddingY + frameHeight * (1 - markerFracY),
        },
      };

      // Check if auto-detector found the exact black markers
      const markerCheck = detectRegistrationMarkers(imageData, guidedCorners);
      if (!markerCheck.detected) {
        throw new Error(
          "Include all four markers on a sheet printed from this app. Try again.",
        );
      }
      const result = processOMRSheet(imageData, geometry, markerCheck.corners);
      result.studentName = studentName.trim() || undefined;
      result.testId = testId.trim() || undefined;
      result.className = className.trim() || undefined;
      const score = gradeExam(result, currentKey, loadScoringRules());

      setResultOpen(true);
      setLastScanResult(result);
      setLastExamScore(score);
      onScanComplete(result);

      setShutterFlashing(true);
      setTimeout(() => setShutterFlashing(false), 220);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([40, 30, 40]);
        } catch {}
      }
      showToast(
        `✓ Saved to history: ${score.correctCount}/${score.totalQuestions} (${score.percentage}%)`,
      );
    } catch (err: any) {
      console.error("Scan processing error:", err);
      setScanError(`Scan failed: ${err.message}`);
      setTimeout(() => setScanError(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommitScan = () => {
    if (liveScanResult && liveExamScore) {
      // 1-tap instant commit to local memory
      const committed: ScanResult = {
        ...liveScanResult,
        id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        studentName: studentName.trim() || undefined,
        testId: testId.trim() || undefined,
        className: className.trim() || undefined,
      };
      onScanComplete(committed);
      setLastScanResult(committed);
      setLastExamScore(liveExamScore);

      setShutterFlashing(true);
      setTimeout(() => setShutterFlashing(false), 220);

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([40, 30, 40]);
        } catch {}
      }

      showToast(
        `✓ Saved to history: ${liveExamScore.correctCount}/${liveExamScore.totalQuestions} (${liveExamScore.percentage}%)`,
      );
    } else {
      handleCaptureVideo();
    }
  };

  const handleCaptureVideo = () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (videoRef.current.readyState < 2 || !videoRef.current.videoWidth) {
      setScanError(
        "Camera is not ready yet. Wait for the preview or upload a photo.",
      );
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const view = viewfinderRef.current;
    if (!view) return;
    const crop = previewCrop(
      video.videoWidth,
      video.videoHeight,
      view.clientWidth,
      view.clientHeight,
    );
    const scale = Math.min(1, 2000 / Math.max(crop.width, crop.height));
    canvas.width = Math.round(crop.width * scale);
    canvas.height = Math.round(crop.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      video,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    executeScan(canvas);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        executeScan(canvas);
      };
      img.onerror = () =>
        setScanError(
          "This image could not be opened. Try a JPEG or PNG photo.",
        );
      img.src = event.target?.result as string;
    };
    reader.onerror = () =>
      setScanError("Could not read the photo. Please try again.");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${label}`);
    } catch {
      showToast("Could not copy. Please try again.");
    }
  };

  const rearLenses = getRearLenses(availableCameras);
  const activeCam = availableCameras.find(
    (c) => c.deviceId === selectedCameraId,
  );
  const isBackActive = activeCam
    ? activeCam.isBack
    : facingMode === "environment";

  return (
    <div className="scanner-container">
      <button
        ref={detailsTriggerRef}
        className="scan-details-trigger"
        aria-label="Scan details"
        onClick={() => setDetailsOpen(true)}
      >
        <SlidersHorizontal size={20} />
      </button>
      <div className="viewfinder-section">
        <div className="viewfinder-wrapper" ref={viewfinderRef}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="viewfinder-video"
            style={{ display: cameraActive ? "block" : "none" }}
          />
          {/* Apple Camera 3x3 Rule-of-Thirds Grid */}
          {cameraActive && (
            <div className="apple-camera-grid" aria-hidden="true">
              <div className="grid-line-v grid-line-v-1" />
              <div className="grid-line-v grid-line-v-2" />
              <div className="grid-line-h grid-line-h-1" />
              <div className="grid-line-h grid-line-h-2" />
            </div>
          )}
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
          {cameraActive && (
            <div className="viewfinder-overlay">
              <svg
                className="viewfinder-svg"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {displayCorners && (
                  <polygon
                    points={`${displayCorners.tl.x},${displayCorners.tl.y} ${displayCorners.tr.x},${displayCorners.tr.y} ${displayCorners.br.x},${displayCorners.br.y} ${displayCorners.bl.x},${displayCorners.bl.y}`}
                    className="detected-quad"
                  />
                )}
                {liveOverlays.map((bubble) => {
                  if (bubble.type === "correct") {
                    return (
                      <g key={bubble.id} className="ar-bubble-correct">
                        <circle
                          cx={bubble.xPct}
                          cy={bubble.yPct}
                          r={bubble.radiusPct * 1.25}
                          className="ar-dot-glow ar-glow-correct"
                        />
                        <circle
                          cx={bubble.xPct}
                          cy={bubble.yPct}
                          r={bubble.radiusPct}
                          className="ar-dot-circle ar-circle-correct"
                        />
                        <text
                          x={bubble.xPct}
                          y={bubble.yPct}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={bubble.radiusPct * 1.15}
                          className="ar-bubble-symbol"
                        >
                          ✓
                        </text>
                      </g>
                    );
                  } else if (bubble.type === "incorrect") {
                    return (
                      <g key={bubble.id} className="ar-bubble-incorrect">
                        <circle
                          cx={bubble.xPct}
                          cy={bubble.yPct}
                          r={bubble.radiusPct * 1.25}
                          className="ar-dot-glow ar-glow-incorrect"
                        />
                        <circle
                          cx={bubble.xPct}
                          cy={bubble.yPct}
                          r={bubble.radiusPct}
                          className="ar-dot-circle ar-circle-incorrect"
                        />
                        <text
                          x={bubble.xPct}
                          y={bubble.yPct}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={bubble.radiusPct * 1.15}
                          className="ar-bubble-symbol"
                        >
                          ✕
                        </text>
                      </g>
                    );
                  } else if (bubble.type === "target") {
                    return (
                      <g key={bubble.id} className="ar-bubble-target">
                        <circle
                          cx={bubble.xPct}
                          cy={bubble.yPct}
                          r={bubble.radiusPct * 1.25}
                          className="ar-target-ring"
                        />
                        <circle
                          cx={bubble.xPct}
                          cy={bubble.yPct}
                          r={bubble.radiusPct * 0.35}
                          className="ar-target-center"
                        />
                      </g>
                    );
                  }
                  return null;
                })}
              </svg>
            </div>
          )}

          {/* Shutter flash animation overlay */}
          {shutterFlashing && (
            <div className="shutter-flash-overlay" aria-hidden="true" />
          )}

          {/* Real-time Floating Live Score HUD */}
          {cameraActive && liveExamScore && (
            <button
              type="button"
              className="live-score-hud"
              onClick={() => {
                setLastScanResult(liveScanResult);
                setLastExamScore(liveExamScore);
                setResultOpen(true);
              }}
              aria-label={`Live score: ${liveExamScore.correctCount} of ${liveExamScore.totalQuestions}, ${liveExamScore.percentage} percent, Grade ${liveExamScore.letterGrade}. Tap for details.`}
            >
              <div className="live-score-main">
                <span className="live-score-fraction">
                  <span className="live-score-correct">
                    {liveExamScore.correctCount}
                  </span>
                  <span className="live-score-slash">/</span>
                  <span className="live-score-total">
                    {liveExamScore.totalQuestions}
                  </span>
                </span>
                <span
                  className={`live-score-grade-badge grade-${liveExamScore.letterGrade}`}
                >
                  {liveExamScore.letterGrade}
                </span>
                <span className="live-score-percentage">
                  {liveExamScore.percentage}%
                </span>
              </div>
              <div className="live-score-breakdown">
                <span className="hud-pill hud-pill-correct">
                  {liveExamScore.correctCount} ✓
                </span>
                <span className="hud-pill hud-pill-incorrect">
                  {liveExamScore.incorrectCount} ✕
                </span>
                {liveExamScore.blankCount > 0 && (
                  <span className="hud-pill hud-pill-blank">
                    {liveExamScore.blankCount} blank
                  </span>
                )}
              </div>
            </button>
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
          {cameraActive && rearLenses.length > 1 && isBackActive && (
            <div
              className="apple-zoom-bar"
              role="group"
              aria-label="Camera zoom"
            >
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

          {/* Apple Minimal Guidance / Status Pill */}
          {cameraActive && (
            <div className="apple-status-pill" role="status">
              <span
                className={`apple-status-text ${isMarkerAligned ? "status-ready" : ""}`}
              >
                {isMarkerAligned
                  ? liveExamScore
                    ? "Tap shutter to save"
                    : "Sheet aligned"
                  : "Align 4 corners in view"}
              </span>
            </div>
          )}
        </div>
        <div className="scanner-controls-bar">
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
          <button
            type="button"
            ref={shutterRef}
            className={`btn-shutter-apple ${isMarkerAligned ? "ready-capture" : ""}`}
            onClick={
              cameraActive
                ? handleCommitScan
                : () => fileInputRef.current?.click()
            }
            disabled={isProcessing}
            aria-label={liveExamScore ? "Save scan to memory" : "Scan sheet"}
            title={liveExamScore ? "Tap to save score to history" : "Scan sheet"}
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
        <canvas ref={canvasRef} hidden />
      </div>
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            detailsTriggerRef.current?.focus();
          }}
          side="bottom"
          className="camera-bottom-sheet"
        >
          <SheetTitle>Scan details</SheetTitle>
          <SheetDescription>Optional labels and lens setup.</SheetDescription>
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
                placeholder="Name"
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
          </div>
          <Button onClick={() => setDetailsOpen(false)}>Done</Button>
        </SheetContent>
      </Sheet>
      <Sheet open={resultOpen && !!lastScanResult} onOpenChange={setResultOpen}>
        <SheetContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            shutterRef.current?.focus();
          }}
          side="bottom"
          className="camera-bottom-sheet result-sheet"
        >
          <SheetTitle>
            {lastExamScore
              ? `${lastExamScore.correctCount} / ${lastExamScore.totalQuestions}`
              : "Result"}
          </SheetTitle>
          <SheetDescription>
            {lastExamScore?.percentage}% correct · Saved to history
            {lastScanResult?.studentName
              ? ` · ${lastScanResult.studentName}`
              : ""}
          </SheetDescription>
          <div className="result-answers-preview">
            {lastExamScore &&
              Object.entries(lastExamScore.results).map(([q, res]) => (
                <div
                  key={q}
                  className={`pill ${res.isCorrect ? "marked" : res.studentChoice === "BLANK" ? "blank" : "multiple"}`}
                >
                  <span>{q}</span>
                  <strong>
                    {res.studentChoice === "BLANK" ? "—" : res.studentChoice}
                  </strong>
                  {!res.isCorrect && <span>→ {res.correctChoice}</span>}
                </div>
              ))}
          </div>
          {toastMessage && <p role="status">{toastMessage}</p>}
          <div className="result-sheet-actions">
            <Button
              variant="outline"
              onClick={() => {
                if (lastScanResult && lastExamScore)
                  copyToClipboard(
                    formatGradedSlackMessage(
                      lastScanResult,
                      lastExamScore,
                      studentName,
                      testId,
                      className,
                    ),
                    "result",
                  );
              }}
            >
              <Copy size={16} />
              Copy result
            </Button>
            <Button onClick={() => setResultOpen(false)}>Scan next</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
