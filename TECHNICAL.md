# Technical Reference & Architecture

This document describes the engineering architecture, printable geometry standards, computer vision algorithms, and data contracts used in **OMR Grading**.

---

## 1. System Architecture

OMR Grading is a client-side web application designed to run directly in modern mobile and desktop web browsers. It requires no backend servers, database infrastructure, or cloud image processing APIs.

### Core Stack
- **Application Framework**: React 18 with TypeScript.
- **Build System**: Vite with relative base path support (`base: './'`).
- **Styling**: Tailwind CSS with custom print style sheets.
- **Image Processing**: Canvas 2D API with TypeScript mathematical primitives for projective geometry and pixel sampling.
- **Storage**: Browser `localStorage` for offline persistence of answer keys, history, and user preferences.

---

## 2. Standardized Printable Paper Geometry

All bubble sheets and essay writing pages are defined in an ISO 216 A4 coordinate system ($210\text{ mm} \times 297\text{ mm}$), where $1\text{ unit} = 1.0\text{ mm}$ in SVG user space. This ensures sub-millimeter printing accuracy across laser and inkjet printers.

### 2.1 Corner Registration Markers
Four solid black squares ($8.0\text{ mm} \times 8.0\text{ mm}$) are positioned at the sheet corners to establish the reference coordinate frame:
- **Top-Left (TL)**: Center `(16, 16)`, bounding box `(12, 12)` to `(20, 20)`
- **Top-Right (TR)**: Center `(194, 16)`, bounding box `(190, 12)` to `(198, 20)`
- **Bottom-Left (BL)**: Center `(16, 281)`, bounding box `(12, 277)` to `(20, 285)`
- **Bottom-Right (BR)**: Center `(194, 281)`, bounding box `(190, 277)` to `(198, 285)`
- **Quiet Zone**: $\ge 12\text{ mm}$ margin around markers to prevent printer clipping and shadows.

### 2.2 Template Specifications
| Template | Questions | Layout | Row Pitch | Columns |
| :--- | :--- | :--- | :--- | :--- |
| `MCQ10` | 10 | 1 column, 10 rows | 8.5 mm | 1 |
| `MCQ20` | 20 | 1 column, 20 rows | 8.0 mm | 1 |
| `MCQ40` | 40 | 2 columns, 20 rows | 8.0 mm | 2 |
| `MCQ50` | 50 | 2 columns, 25 rows | 6.8 mm | 2 |

- **Bubble Outer Diameter**: $4.6\text{ mm}$ (Radius $r = 2.3\text{ mm}$).
- **Bubble Stroke**: $0.35\text{ mm}$ solid black.
- **Choice Pitch**: $7.2\text{ mm}$ horizontal spacing between choices A, B, C, D.
- **Duplex Print Support**: Standard A4 duplex layout includes ruled essay writing lines on the back with grading rubric fields.
- **2-Up Half-Sheet Support**: Two 10- or 20-question half-sheets ($210\text{ mm} \times 148.5\text{ mm}$) fit onto a single A4 page with a dashed scissor cut line to conserve paper.

---

## 3. Computer Vision & Recognition Pipeline

The camera scanning workflow follows a discrete state machine:

```
LIVE CAMERA → DETECT CORNERS → STABILITY CHECK → CAPTURE & FREEZE → WARP PERSPECTIVE → OMR EVALUATION → REVIEW (KEEP / RETAKE)
```

### 3.1 Live Corner Detection (`src/scanner/markerDetector.ts`)
- Video frames are downsampled onto a processing canvas for responsive frame-rate tracking.
- The detector searches the four outer quadrants (TL, TR, BL, BR) for dark square shapes.
- Grayscale luminance is calculated as:
  $$L = 0.299R + 0.587G + 0.114B$$
- Pixels are segmented with an adaptive threshold ($L < L_{\text{avg}} \times 0.55$).
- Candidate blobs are filtered by aspect ratio ($0.6 \le \frac{w}{h} \le 1.6$) and minimum pixel area.
- Centroids are computed using intensity-weighted moments for sub-pixel accuracy.

### 3.2 Stability Check & Auto-Capture
- Corner coordinates are tracked across successive frames.
- If all four corners remain stable within a bounded Euclidean distance for approximately 300–500 ms, the system automatically captures a full-resolution static frame.
- A manual shutter button is also provided for challenging lighting conditions or handheld movement.

### 3.3 Perspective Rectification (`src/scanner/warp.ts` & `src/scanner/homography.ts`)
- The four detected camera coordinates $(x_i, y_i)$ and canonical paper coordinates $(u_i, v_i)$ define an $8 \times 8$ linear system:
  $$A h = b$$
- The system is solved using Gaussian Elimination with partial pivoting to compute the $3 \times 3$ projective homography matrix $H$.
- `warpPerspective` maps the captured camera frame into an orthogonal canonical canvas. This freezes the sheet and decouples grading from subsequent device movement.

### 3.4 Bubble Darkness & Relative Strip Separation (`src/scanner/omrDetector.ts`)
- Canonical bubble centers $(u, v)$ are mapped onto the rectified sheet coordinate space.
- Bubble inner cores ($r = 1.8\text{ mm}$) are sampled for average luminance.
- A background halo is sampled around each bubble to adapt to shadows, paper tint, and non-uniform illumination:
  $$\Delta_{\text{darkness}} = \max\left(0, \frac{L_{\text{halo}} - L_{\text{bubble}}}{L_{\text{halo}}}\right)$$
- Answer classification uses relative strip separation across choices A, B, C, D:
  - Top choice darkness $d_{\max}$ and runner-up darkness $d_{\text{runner\_up}}$ are identified, with separation margin $\Delta d = d_{\max} - d_{\text{runner\_up}}$.
  - **Marked Answer**: Distinct peak darkness with separation from alternative options.
  - **Multiple / Conflicted**: Multiple marks with low separation margin.
  - **Blank**: All bubbles remain near the background threshold.
  - Generates a confidence score and flags ambiguous questions for teacher review.

---

## 4. Batch Queue & Data Contracts

### 4.1 Batch Processing
- Accepted sheets are added to an in-memory batch queue without database overhead.
- The review interface displays the static rectified sheet alongside detected answers and scores.
- One-handed gestures allow rapid navigation (swipe right to Keep, swipe left to Retake), backed by visible buttons.
- A batch summary screen displays totals, clean results, and flagged questions requiring confirmation.

### 4.2 Standardized JSON Schema (Version 1)
Batch results can be exported as a versioned JSON payload:

```typescript
interface BatchExportPayload {
  schemaVersion: 1;
  createdAt: string;       // ISO 8601 timestamp
  test?: string;           // Test name or ID
  class?: string;          // Class name
  count: number;           // Total papers in batch
  results: Array<{
    id: string;            // Unique scan identifier
    studentId?: string;    // Student ID if entered
    studentName?: string;  // Student Name if entered
    score: number;         // Points earned
    maxScore: number;      // Maximum possible score
    percentage: number;    // Score percentage (0-100)
    answers: Record<string, string>; // e.g. { "1": "A", "2": "C" }
    flaggedQuestions: number[];      // Low-confidence or ambiguous question numbers
    confidence: number;    // Overall sheet confidence (0.00-1.00)
    timestamp: string;     // Scan ISO timestamp
  }>;
}
```

### 4.3 Export Mechanisms
- **Web Share API**: Native system share sheet on iOS and macOS, enabling direct transmission to Apple Shortcuts, AirDrop, Messages, or cloud storage.
- **File Download**: Fallback browser download of `.json` or `.csv` files.
- **Gradebook CSV**: Standard spreadsheet format compatible with Excel, Google Sheets, and school information systems.

---

## 5. Storage & Privacy Model

- **Zero Cloud Image Processing**: Camera video and photos remain strictly inside browser memory.
- **No Third-Party Analytics**: No tracking scripts, cookies, or external font/library CDNs.
- **LocalStorage Keys**:
  - `omr_scan_history_v3`: Saved historical scans.
  - `omr_answer_keys_v3`: Stored answer keys by template ID.
  - `omr_scoring_rules_v1`: Points per correct answer and penalty rules.
  - `omr_active_template_v1`: Active template selection.
  - `omr_selected_camera_id_v1`: Preferred camera lens selection.

---

## 6. Testing & Build Commands

### Unit Testing
Automated unit tests use Vitest and verify sheet geometry, matrix operations, perspective warping, OMR mark detection, scoring logic, and export schemas:
```bash
npm test
```

### Production Build
```bash
npm run build
```
Runs TypeScript compilation (`tsc`) and Vite bundling into `/dist`.
