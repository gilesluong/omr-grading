# OMR Paper Protocol & Mobile Scanning System: Agent Reference Guide

## 1. System Overview & Core Philosophy

This system is a **zero-marginal-cost, 100% client-side Optical Mark Recognition (OMR) platform** designed for English education centers, schools, and tutoring institutions.

### Core Architectural Principles
- **Zero API Dependency**: No OpenAI, Google Cloud Vision, AWS Rekognition, or OCR web APIs.
- **Zero Cloud Image Processing**: Video frames and student exam sheets never leave the teacher's mobile browser.
- **Zero Backend Required**: Runs as a static single-page application (SPA) with no database servers or auth providers.
- **No Heavy WASM/OpenCV.js**: Instead of bundling a 10MB+ OpenCV.js binary, all 3x3 projective homography transforms, Gaussian elimination solvers, and luminance sampling algorithms are written in pure, optimized TypeScript (< 250KB total bundle size).
- **Physical Millimeter Fidelity**: Every SVG sheet directly maps `1 SVG userUnit = 1.0 mm` on ISO 216 A4 paper, ensuring sub-millimeter print accuracy across laser and inkjet printers.

---

## 2. Standardized Printable Paper Protocol (A4)

### 2.1 Coordinate Space & Dimensions
- **Standard**: ISO 216 A4 Portrait ($210\text{ mm} \times 297\text{ mm}$).
- **SVG ViewBox**: `0 0 210 297` with `preserveAspectRatio="xMidYMid meet"`.
- **CSS Print Specs**:
  ```css
  @page {
    size: A4 portrait;
    margin: 0;
  }
  ```

### 2.2 Corner Registration Markers (Fiducials)
Four solid black squares ($8.0\text{ mm} \times 8.0\text{ mm}$, fill `#000000`) placed at outer corners:
- **Top-Left (TL)**: Center `(16, 16)`, box from `(12, 12)` to `(20, 20)`
- **Top-Right (TR)**: Center `(194, 16)`, box from `(190, 12)` to `(198, 20)`
- **Bottom-Left (BL)**: Center `(16, 281)`, box from `(12, 277)` to `(20, 285)`
- **Bottom-Right (BR)**: Center `(194, 281)`, box from `(190, 277)` to `(198, 285)`
- **Quiet Zone**: $\ge 12\text{ mm}$ clear margin surrounding all markers to prevent printer margin clipping and shadow interference.

### 2.3 Micro QR Code Identification
- **Position**: Center at `(173, 37)`, bounding box $26\text{ mm} \times 26\text{ mm}$ (from `(160, 24)` to `(186, 50)`).
- **Error Correction**: Level `L` (compact module count).
- **Payload Format**: `OMR|{templateId}|{questionCount}|v1` (e.g., `OMR|MCQ40|40|v1`).
- Rendered as vector SVG `<path>` elements directly in the DOM.

### 2.4 Human-Readable Metadata Header
Positioned between $y = 24\text{ mm}$ and $y = 52\text{ mm}$:
- **Exam Title / Institution Header**: Bold 16pt sans-serif text.
- **Physical Form Fields**:
  - `STUDENT NAME:` (Width 85mm underline)
  - `CLASS:` (Width 35mm underline)
  - `DATE:` (Width 30mm underline)
  - `TEST ID:` (Width 35mm underline)
- **Instructions Box**: Instructions for 2B/dark pencil bubbling with visual positive/negative examples.

### 2.5 Bubble Grid Geometry Specifications
- **Bubble Outer Diameter**: $4.6\text{ mm}$ (Radius $r = 2.3\text{ mm}$).
- **Bubble Stroke**: $0.35\text{ mm}$ solid black (`#000000`).
- **Option Spacing**: $7.2\text{ mm}$ horizontal pitch between centers of choices A, B, C, D.
- **Option Font**: 7pt bold sans-serif centered inside unfilled bubble.
- **Question Numbering**: Right-aligned 8pt bold sans-serif, $4.0\text{ mm}$ to the left of choice A.
- **Inner Detection ROI**: Radius $r_{\text{inner}} = 1.8\text{ mm}$ ($78\%$ of radius, omitting stroke boundary).

| Template ID | Questions | Columns | Rows / Col | Left Margin (Col 1) | Left Margin (Col 2) | Row Pitch |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `MCQ10` | 10 | 1 | 10 | 80 mm | — | 8.5 mm |
| `MCQ20` | 20 | 1 | 20 | 80 mm | — | 8.0 mm |
| `MCQ40` | 40 | 2 | 20 | 36 mm | 118 mm | 8.0 mm |
| `MCQ50` | 50 | 2 | 25 | 36 mm | 118 mm | 6.8 mm |

---

## 3. Computer Vision & Recognition Algorithms

### 3.1 3x3 Projective Homography Solver (`src/scanner/homography.ts`)
Maps 4 distorted camera coordinates $(x_i, y_i)$ to standard canonical millimeter coordinates $(u_i, v_i)$ via projective transform:

$$\begin{bmatrix} u \\ v \\ 1 \end{bmatrix} \sim H \begin{bmatrix} x \\ y \\ 1 \end{bmatrix} = \begin{bmatrix} h_{00} & h_{01} & h_{02} \\ h_{10} & h_{11} & h_{12} \\ h_{20} & h_{21} & 1 \end{bmatrix} \begin{bmatrix} x \\ y \\ 1 \end{bmatrix}$$

- Constructed as an $8 \times 8$ linear system $A h = b$.
- Solved using Gaussian Elimination with row partial pivoting for numerical stability.
- Reverse transform $H^{-1}$ maps physical canonical bubble centers $(u, v)$ into live camera pixel coordinates $(x, y)$.

### 3.2 Registration Marker Centroid Detection (`src/scanner/markerDetector.ts`)
- Frame downsampled onto processing canvas (default $640 \times 640$ or $800 \times 800$).
- Evaluates 4 outer quadrants:
  - Top-Left: $x \in [0, 0.35W], y \in [0, 0.35H]$
  - Top-Right: $x \in [0.65W, W], y \in [0, 0.35H]$
  - Bottom-Left: $x \in [0, 0.35W], y \in [0.65H, H]$
  - Bottom-Right: $x \in [0.65W, W], y \in [0.65H, H]$
- Calculates local average luminance $L_{\text{avg}} = \frac{1}{N}\sum (0.299R + 0.587G + 0.114B)$.
- Binarizes pixels with dark threshold: $L < L_{\text{avg}} \times 0.55$.
- Finds dark connected clusters matching expected square aspect ratio ($0.6 \le \frac{w}{h} \le 1.6$) and size ($\ge 8\text{px}$).
- Computes weighted center of mass $(\bar{x}, \bar{y})$ for sub-pixel registration accuracy.

### 3.3 Bubble Luminance & Relative Strip Separation (`src/scanner/omrDetector.ts`)
- **Center Mapping**: Computes $(x, y) = H^{-1}(u_{\text{bubble}}, v_{\text{bubble}})$.
- **Inner Core Sampling**: Iterates pixels within $r_{\text{sample}} = 1.8\text{ mm} \times \text{scale}$.
- **Local Paper Calibration**: Samples ambient paper brightness in a 4-point halo $3.5\text{ mm}$ outside the bubble to dynamically compensate for shadows, phone tilt, and uneven indoor lighting:
  $$\Delta_{\text{darkness}} = \max\left(0, \frac{L_{\text{halo}} - L_{\text{bubble}}}{L_{\text{halo}}}\right)$$
- **OMRChecker-Inspired Relative Strip Separation**:
  Rather than relying on a rigid fixed global threshold, the decision engine evaluates the darkness spread across choices $A, B, C, D$ in the question strip:
  - Finds top choice $d_{\max}$, runner-up $d_{\text{runner\_up}}$, and separation margin $\Delta d = d_{\max} - d_{\text{runner\_up}}$.
  - **Single Intentional Mark**: $d_{\max} \ge 0.16$ with $\Delta d \ge 0.08$ (or $d_{\max} \ge 0.22$ with $\Delta d \ge 0.05$). Confidently detects faint 2B pencil, pen strokes, and xeroxed sheets.
  - **Multiple Marks / Conflict**: $d_{\max} \ge 0.20$ and $d_{\text{runner\_up}} \ge 0.18$ with low separation ($\Delta d < 0.08$).
  - **Blank / Unmarked**: $d_{\max} < 0.16$ or low uniform noise across all bubbles.
  - Generates a per-question **Confidence Metric** ($0-100\%$) and margin $\Delta d$ displayed in the real-time **🔬 CV Inspector**.

---

## 4. Master Answer Key Ingestion Protocol

The system supports real-time editing and multi-format bulk imports via `parseAnswerKeyInput`:

### Supported Import Formats:
1. **Continuous String**:
   `ABCDABCDAB...`
2. **Numbered Lines & Pairs**:
   ```text
   1: A
   2: B
   3. C
   Q4 = D
   5 - A
   ```
3. **Comma / Tab Delimited CSV**:
   ```csv
   1,A
   2,B
   3,C
   ```
4. **JSON Key-Value Object or Array**:
   ```json
   {"1": "A", "2": "B", "3": "C"}
   ```
   or
   ```json
   ["A", "B", "C", "D"]
   ```
5. **Direct File Drag & Drop**: Accepts `.txt`, `.csv`, `.json` files.

---

## 5. Downstream Integration & Agent Contracts

### 5.1 Scan Result JSON Contract (`ScanResult`)
```typescript
interface ScanResult {
  id: string;               // Unique scan ID: "scan_1726639800000_abc"
  timestamp: string;        // ISO 8601 string: "2026-09-18T12:00:00.000Z"
  templateId: 'MCQ10' | 'MCQ20' | 'MCQ40' | 'MCQ50';
  totalQuestions: number;   // 10 | 20 | 40 | 50
  studentName?: string;     // e.g. "Nguyen Van A"
  testId?: string;          // e.g. "ENG-FINAL-2026"
  className?: string;       // e.g. "IELTS-Prep-01"
  answers: {
    [questionNumber: number]: {
      question: number;
      detectedChoice: 'A' | 'B' | 'C' | 'D' | 'BLANK' | 'MULTIPLE';
      choices: {
        [choice in 'A' | 'B' | 'C' | 'D']: {
          choice: choice;
          darknessRatio: number; // 0.00 - 1.00
          isFilled: boolean;
        };
      };
    };
  };
  summary: {
    answered: number;
    blank: number;
    multiple: number;
  };
}
```

### 5.2 Grading Result Contract (`GradeResult`)
```typescript
interface GradeResult {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  blankCount: number;
  multipleCount: number;
  percentage: number;       // 0 - 100
  letterGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  details: Array<{
    question: number;
    studentAnswer: 'A' | 'B' | 'C' | 'D' | 'BLANK' | 'MULTIPLE';
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    isCorrect: boolean;
  }>;
}
```

### 5.3 Slack Webhook / Bot Markdown Payload Format
```markdown
🎯 *OMR Exam Grade Report*
*Test ID:* ENG-FINAL-2026
*Class:* IELTS-Prep-01
*Student:* Nguyen Van A
*Date:* 2026-09-18 12:00:00

*Score:* 18/20 (90%) - *Grade A*
*Breakdown:* 18 Correct, 1 Incorrect, 1 Blank, 0 Multiple

❌ *Incorrect / Blank Questions:*
• Q7: Student: *C* | Correct Key: *A*
• Q12: Student: *BLANK* | Correct Key: *D*
```

### 5.4 Gradebook CSV Export Specification (RFC 4180)
Headers:
`Scan ID,Timestamp,Test ID,Class,Student Name,Template,Total Questions,Correct,Incorrect,Blank,Percentage,Grade,Q1,Q2,...`

---

## 6. Mobile Gesture System

- **Right-Edge Swipe-Left Gesture**:
  Swiping leftwards starting within $35\text{ px}$ of the right viewport edge smoothly slides open the **Scan History & Gradebook Drawer**.
- **Edge Pull Tab**: Floating orange tab (`◂ History`) on the right screen edge for instant 1-tap drawer access on desktop or mobile.
- **One-Click Clipboard Actions**:
  - `Copy for Slack`: Formats instant markdown report for Slack channel bots or dispatch webhooks.
  - `Copy JSON`: Formats complete machine-readable raw data for direct database insertions or AI agent processing.

---

## 7. Build, Test & Deployment Guide

### 7.1 Running Tests
```bash
npm test
```
Executes all 45 automated unit tests covering geometry validation, SVG millimeter layout, corner fiducial coordinates, QR code generation, pure TypeScript homography matrix solving, answer key parsing, grading calculations, and CSV serialization.

### 7.2 Production Build
```bash
npm run build
```
Typechecks via `tsc` and bundles through `vite build` into `/dist` with relative asset linking (`base: './'`).

### 7.3 GitHub Pages Deployment
A GitHub Actions workflow is pre-configured at `.github/workflows/deploy.yml`.
To deploy:
1. Ensure the repo is pushed to GitHub.
2. In GitHub repository settings: **Settings > Pages > Build and deployment > Source**, select **GitHub Actions**.
3. Any push to `master` or `main` automatically runs tests, compiles the bundle, and deploys the live site.

### 7.4 Cloudflare Pages Deployment
- **Method 1 (Git Integrated)**:
  1. Connect your GitHub repository in the Cloudflare Dashboard (**Workers & Pages > Create application > Pages > Connect to Git**).
  2. Build configuration:
     - **Framework preset**: `Vite`
     - **Build command**: `npm run build`
     - **Build output directory**: `dist`
     - **Root directory**: `/`
- **Method 2 (Cloudflare Wrangler CLI)**:
  ```bash
  npx wrangler pages deploy dist --project-name omr-paper-protocol
  ```
