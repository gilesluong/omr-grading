# OMR Grading

A lightweight web app for teachers to print answer sheets and grade multiple-choice tests with a phone camera.

[![CI & Deployment](https://github.com/gilesluong/omr-grading/actions/workflows/deploy.yml/badge.svg)](https://github.com/gilesluong/omr-grading/actions/workflows/deploy.yml)
[![Tests](https://img.shields.io/badge/tests-91%20passed-brightgreen.svg)](https://github.com/gilesluong/omr-grading)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Live Web App: **[https://gilesluong.github.io/omr-grading/](https://gilesluong.github.io/omr-grading/)**

---

## Why I Built This

Teachers spend hours grading multiple-choice tests, tallying scores, and manually transferring results into spreadsheets. Commercial optical mark readers often require specialized hardware, proprietary scan sheets, or subscription-based software with slow upload queues.

I built **OMR Grading** to simplify this into a fast, everyday classroom operation that runs entirely in the browser on standard paper and standard phone cameras.

---

## The Workflow

The application follows a simple four-step loop:

$$\text{Print} \longrightarrow \text{Scan} \longrightarrow \text{Review} \longrightarrow \text{Export}$$

### 1. Print
Generate standard A4 answer sheets formatted for standard laser or inkjet printers:
- **Sheet Options**: 10, 20, 40, or 50 questions.
- **Paper-Saving 2-Up Mode**: Fits two 10- or 20-question half-sheets on a single A4 page with a cutting guide.
- **Two-Sided Duplex Layout**: Back page includes 29 ruled writing lines and an evaluation rubric for essay questions.

### 2. Scan
Point your phone camera at a completed sheet:
- Minimal viewfinder with subtle alignment guides.
- **Automatic capture** once the sheet is steady for ~400 ms (plus a manual shutter fallback).
- Instantly freezes the frame so hand movement does not affect grading.

### 3. Review
Review the static result on a single card:
- Displays score, percentage, letter grade, and detected answers.
- Flagged questions highlight ambiguous or faint bubbles for quick teacher verification.
- **One-handed gestures**: Swipe right to **Keep**, swipe left to **Retake** (with clear on-screen buttons as well).
- Keeping a scan returns immediately to the camera for the next paper.

### 4. Export
When a stack of papers is finished, open the batch summary:
- View total papers scanned, clean results, and any papers requiring review.
- **System Share Sheet**: Send results directly to Apple Shortcuts, AirDrop, or Notes via the Web Share API.
- **Standard Exports**: Download structured JSON (`Schema v1`) or a CSV gradebook for Excel and Google Sheets.

---

## Key Features

- **Stable Freeze-on-Capture UX**: The camera captures and rectifies a static image before grading, eliminating jitter and moving overlays.
- **Fast Batch Scanning**: Designed for grading stacks of 20–50 exams in minutes without navigating menus between papers.
- **Flexible Answer Keys**: Type or paste answers in multiple formats (`ABCD...`, `1:A 2:B`, CSV, or JSON).
- **Customizable Scoring**: Supports standard grading as well as negative marking penalties for competitive exams.
- **100% Client-Side Privacy**: Runs completely inside your browser. No accounts, no backend servers, and student exam papers never leave your device.
- **Multi-Lens Support**: Quickly switch between ultra-wide, standard, and telephoto lenses on mobile phones.

---

## Technical Architecture

OMR Grading is built with TypeScript, React 18, HTML5 Canvas, and SVG:
- **Perspective Rectification**: Solves an $8 \times 8$ projective homography system using Gaussian Elimination with partial pivoting to rectify angled captures into canonical coordinates.
- **Adaptive Bubble Detection**: Evaluates bubble darkness relative to local paper background brightness to handle shadows and varying indoor light.
- **Standardized Export Contract**: Emits versioned JSON (`Schema v1`) for integration with automation workflows like Apple Shortcuts.

For complete mathematical derivations, fiducial coordinate specifications, and detection algorithms, see [TECHNICAL.md](TECHNICAL.md).

---

## Running Locally

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Setup

```bash
# Clone the repository
git clone https://github.com/gilesluong/omr-grading.git
cd omr-grading

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173/` in your browser.

### Testing & Build

```bash
# Run automated tests
npm test

# Build for production
npm run build
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
