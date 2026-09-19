# OMR Grading 📝⚡

> **Zero-Marginal-Cost, 100% Client-Side Optical Mark Recognition (OMR) & Real-Time Mobile Camera Scanner**

[![CI & Deployment](https://github.com/gilesluong/omr-grading/actions/workflows/deploy.yml/badge.svg)](https://github.com/gilesluong/omr-grading/actions/workflows/deploy.yml)
[![Tests](https://img.shields.io/badge/tests-79%2F79%20passed-brightgreen.svg)](https://github.com/gilesluong/omr-grading)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Live Web App: **[https://gilesluong.github.io/omr-grading/](https://gilesluong.github.io/omr-grading/)**

---

## 🌟 Overview

**OMR Grading** is a modern, high-performance web application designed for teachers, schools, and tutoring centers to print standardized bubble answer sheets and grade them in seconds using nothing more than a smartphone camera or laptop webcam.

- **100% Client-Side**: All computer vision, homography transforms, and grading algorithms run directly in your browser. Video feeds and exam papers never leave your device.
- **Zero Heavy WASM / OpenCV Dependency**: Written in pure, optimized TypeScript with custom homography projection and Rec. 601 luminance sampling (< 360KB total gzipped bundle).
- **Physical Millimeter Precision**: Built on standard ISO 216 A4 paper geometry where `1 SVG unit = 1.0 mm`, guaranteeing exact physical alignment on any printer.
- **Offline Capable**: Works entirely offline without backend servers, databases, or third-party OCR API keys.

---

## ✨ Features

### 📄 Standardized Printable Sheets
- **Multiple Exam Sizes**: Supports 10, 20, 40, and 50 multiple-choice question formats.
- **2-Up Double Printing on A4**: Automatically fits two 10-question or 20-question half-sheets ($210\text{ mm} \times 148.5\text{ mm}$) onto a single A4 page with a dashed scissor cutting line (`✂ - - - ✂`) to save 50% paper.
- **Vector Fiducial Markers**: Four $8\text{ mm}$ corner registration markers for sub-millimeter perspective correction.
- **QR Code Auto-Detection**: Embedded micro QR code links directly to the grading webapp.
- **Student Information Block**: Pre-formatted fields for Name, Class, Date, and Test ID.

### 📷 Real-Time Mobile Camera Scanner & AR Grading
- **Live AR Bubble Overlay**: Directly identifies student marks on the live camera viewfinder and projects **green dots** (`✓`) over correct choices, **red dots** (`✕`) over incorrect choices, and dashed guide rings over missed answer targets.
- **Floating Real-Time Score HUD**: Instant score calculation appearing right above the live feed displaying score fraction (e.g. `8/10`), letter grade (`A`/`B`/`C`), percentage, and quick breakdown pills.
- **Multi-Lens Camera Switching**: Seamlessly switch between physical camera lenses (`0.5x` Ultra-Wide, `1x` Main, `2x`/`3x` Telephoto, or Front) via quick on-screen pill buttons or settings. Ideal for smartphones with a damaged primary lens, with selection saved in `localStorage`.
- **Shrink-Proof Full-Screen Viewfinder**: Edge-to-edge camera preview locked full-bleed across sheet popups, toasts, and error states without WebKit viewport collapse.
- **1-Tap Memory Commit**: The shutter button commits the active scan directly into local memory history with haptic vibration and screen flash for rapid, frictionless multi-sheet scanning.
- **Perspective Distortion Immunity**: Perspective-corrected homography projects tilted, angled, or handheld camera captures back to flat coordinates.
- **Half-Sheet Auto-Detection**: Seamlessly grades cut half-sheets without requiring manual template changes.
- **Robust Under Varied Lighting**: Multi-point dark-pixel sampling with quantile background subtraction handles shadows, desk backgrounds, and uneven lighting.

### 🎯 Instant Master Answer Key & Grading Engine
- **Bulk Answer Key Import**: Supports continuous letter strings (`ABCDABCDAB`), numbered pairs (`1:A, 2:B`), CSV, or JSON formats.
- **Flexible Scoring Rules**:
  - Correct answer points
  - Negative marking penalty (e.g., $-0.25$ or custom deductions for wrong answers)
  - Blank answer penalties
- **Interactive Sheet Editor**: Tap on-screen bubbles to preview, test, or manually adjust marks.

### 📊 AI-Ready CSV Gradebook Export
- **One-Click Export**: Generates RFC 4180 compliant CSV gradebooks.
- **Dedicated Ground-Truth Row**: Automatically exports the official master answer key row (`ANSWER_KEY`) for every template used.
- **Inline Question Context**: Includes clear question-level evaluation (`A ✓`, `B ✗ (Key: A)`, `BLANK (Key: A)`) so AI models (Gemini, Claude, GPT) and data analysis tools can immediately analyze distractor distributions and question difficulty.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ 
- npm v9+

### Installation

```bash
# Clone repository
git clone https://github.com/gilesluong/omr-grading.git
cd omr-grading

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173/` in your browser.

---

## 🧪 Testing & Verification

The test suite covers geometry specifications, homography math, camera perspective transforms, real sheet image processing, and grading calculations:

```bash
# Run all 79 automated tests
npm test

# Run tests in watch mode
npm run test -- --watch
```

### Production Build

```bash
npm run build
```

The output bundle will be compiled into the `dist/` directory.

---

## 📐 Architecture & Coordinate Specifications

```
ISO 216 A4 (210mm x 297mm)
┌────────────────────────────────────────────────────────┐
│ [TL Marker] (16, 16)             (194, 16) [TR Marker] │
│                                                        │
│  NAME: __________________   CLASS:   _________         │
│  DATE: __________________   TEST ID: _________  [ QR ] │
│ ─────────────────────────────────────────────── (164mm)│
│                                                        │
│      01  (A) (B) (C) (D)        21  (A) (B) (C) (D)    │
│      02  (A) (B) (C) (D)        22  (A) (B) (C) (D)    │
│      ...                        ...                    │
│                                                        │
│ [BL Marker] (16, 281)           (194, 281) [BR Marker] │
└────────────────────────────────────────────────────────┘
```

For complete technical specifications, mathematical derivations, and agent instructions, refer to [`AGENT.md`](./AGENT.md).

---

## 📄 License

Distributed under the MIT License.
