# Benchmark Reproduction Guide: StudentAI Performance Audit

This directory contains the reproducible benchmarking harness, profiling scripts, and raw metric datasets for the StudentAI backend performance audit.

---

## 1. Prerequisites

* **Node.js**: v20+ (tested on Node.js v24.19.0)
* **MongoDB**: A running MongoDB instance on `127.0.0.1:27017` (local Windows MongoDB service or container)
* **Dependencies**:
  Ensure server dependencies are installed:
  ```bash
  cd server
  npm install
  ```

---

## 2. Directory Structure

```
performance-audit/
├── architecture-analysis.md       # Complete system & architecture breakdown
├── bottleneck-analysis.md         # Identified bottlenecks, query patterns, and root causes
├── before-after-comparison.md     # Comparative tables, latency reductions, and throughput metrics
├── optimization-log.md            # Detailed incremental changes and trade-offs
├── baseline-results.json          # Pre-optimization Autocannon benchmark results
├── optimized-results.json         # Post-optimization Autocannon benchmark results
├── seed-benchmark-db.js           # Seeds isolated local MongoDB database ('student-benchmark')
├── profile-db.js                  # MongoDB explain('executionStats') query profiler
├── benchmark-server.js            # Standalone HTTP test server instance (Port 5050)
├── run-benchmarks.js              # Automated Autocannon load testing matrix harness
└── instructions-to-reproduce.md   # This guide
```

---

## 3. Step-by-Step Reproduction Procedure

### Step 1: Seed the Isolated Benchmark Database
Populate the dedicated `student-benchmark` database with realistic test datasets (users, subjects, 220 attendance records, marks, semesters, career progress, classroom assignments, and 150 NoteChunk vector embedding documents):
```powershell
cd server
node ../performance-audit/seed-benchmark-db.js
```

### Step 2: Run Database Explain Profiling
Profile database execution plans, total documents examined, keys examined, and query stages:
```powershell
node ../performance-audit/profile-db.js
```
Look for:
* `COLLSCAN` vs `IXSCAN`
* `totalDocsExamined` vs `totalKeysExamined`
* In-memory `SORT` stages

### Step 3: Run Baseline Benchmarks
Execute the Autocannon HTTP load testing matrix across concurrency levels [1, 10, 25, 50] with 2-second warm-ups and 5-second sampling intervals:
```powershell
node ../performance-audit/run-benchmarks.js --mode=baseline
```
Output will be written to `performance-audit/baseline-results.json`.

### Step 4: Run Post-Optimization Benchmarks
Run the identical benchmark suite in optimized mode:
```powershell
node ../performance-audit/run-benchmarks.js --mode=optimized
```
Output will be written to `performance-audit/optimized-results.json`.

### Step 5: Run Regression Test Suite
Verify that all unit and integration tests pass with zero regressions:
```powershell
# Run performance and data isolation regression suite
npx jest tests/performanceRegression.test.js --runInBand --forceExit

# Run full project test suite
npx jest --runInBand --forceExit
```

---

## 4. Key Target Endpoints Tested

| Endpoint | Method | Path | Description |
| :--- | :---: | :--- | :--- |
| **Student Dashboard** | `GET` | `/api/decision/today-plan` | Smart academic priority plan aggregating 4 distinct services |
| **Attendance Retrieval** | `GET` | `/api/attendance/summary` | Attendance totals, 75% shortage predictions, and streaks |
| **Attendance Trends** | `GET` | `/api/attendance/trends` | Monthly historical attendance progression |
| **Marks Retrieval** | `GET` | `/api/marks/cgpa-semester` | Multi-semester SGPA breakdown and cumulative CGPA |
| **Timetable Retrieval** | `GET` | `/api/timetable` | Student course schedule, meeting slots, and credits |
| **AI Notes Retrieval** | `GET` | `/api/ai/notes` | RAG note document metadata and chunk tallies |
