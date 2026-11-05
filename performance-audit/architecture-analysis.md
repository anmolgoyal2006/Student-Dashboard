# Backend Architecture Analysis: StudentAI Productivity Platform

**Author**: Senior Backend Performance Engineer  
**Date**: November 2026  
**Project**: StudentAI Backend (Node.js / Express / MongoDB)

---

## 1. Executive Summary & System Overview

StudentAI is a full-stack student productivity platform designed to centralize academic management (attendance tracking, marks, SGPA/CGPA forecasting, timetable management) alongside AI-assisted learning (Gemini-powered chat, RAG-based document retrieval over study notes, and smart placement/study recommendations).

The backend is built as a monolithic RESTful service in **Node.js (v24.x)** using **Express.js (v4.18.2)** and **Mongoose (v7.8.9)** connecting to **MongoDB**.

### Technology Stack Mapping
* **Runtime**: Node.js v24.19.0
* **Web Framework**: Express.js 4.18.2
* **Database & ODM**: MongoDB with Mongoose 7.8.9
* **Authentication**: JWT (`jsonwebtoken` v9.0.2) with revocation tracking via `tokenVersion` and Passport.js Google OAuth 2.0
* **AI & RAG Engine**: Google Gemini API (`@google/genai` / REST) with in-memory cosine similarity over vector embeddings (`text-embedding-004`)
* **Notifications**: Firebase Cloud Messaging (`firebase-admin` v13.7.0)
* **Scheduling**: `node-cron` v4.2.1
* **Observability**: `@sentry/node` v9.0.0
* **Compression**: `compression` v1.8.1 (gzip/deflate)
* **Security**: `helmet` v8.2.0, `cors` v2.8.5, `cookie-parser` v1.4.7

---

## 2. Server Configuration & Request Lifecycle

### 2.1 Entry Point Separation (`app.js` vs `server.js`)
* **`app.js`**: Pure Express application setup.
  - Requires `./instrument` as the absolute first line to initialize Sentry error tracking before any other modules load.
  - Applies security middleware: `helmet()`, CORS configuration with dynamic regex matching for preview deployments, `cookieParser()`, `compression()` with 1 KB threshold.
  - Body parsers configured with `express.json({ limit: '10mb' })` and `urlencoded({ extended: true })`.
  - Global `Cache-Control: no-store` header applied to all `/api` routes.
  - Request timeout middleware set to 600 seconds (10 minutes) to accommodate long-running PDF extraction and Python OCR worker scripts.
  - Registers 20 route modules under `/api/*`.
* **`server.js`**: Runtime harness.
  - Establishes connection to MongoDB via `mongoose.connect()`.
  - Performs runtime startup migrations (drops stale indexes on `Attendance` and `User`, ensures partial unique index on `Notification.dedupKey`).
  - Spawns background cron jobs (`dailyNotificationJob`, `classroomSyncJob`, `notificationSyncJob`, `digestJobs`, `collectorScheduler`).
  - Implements graceful shutdown traps for `SIGTERM` and `SIGINT` to safely stop cron jobs and drain pending HTTP connections.

---

## 3. Middleware, Authentication & Authorization Overhead

### 3.1 Authentication Flow (`authMiddleware.js`)
* **JWT Verification**: Validates `Authorization: Bearer <token>` against `JWT_SECRET`.
* **Token Invalidation Layer (`tokenVersion`)**:
  - JWT tokens are valid for 7 days. To allow instant revocation upon logout or password reset, each user has a `tokenVersion` number in MongoDB.
  - **In-Memory TTL Cache (`TTLCache`)**: Implemented with a 30-second TTL and 10,000 max entries.
  - On a cache hit, the token version check completes in sub-millisecond memory time.
  - On a cache miss, an async query `User.findById(userId).select('tokenVersion').lean()` is executed before every authenticated request.
* **Overhead Assessment**:
  - Under load tests with a single user or fixed token pool, the cache hit rate approaches 100%, adding < 0.05ms overhead.
  - When cache expires or under cold bursts, additional single-document index lookups occur against the `User` collection.

### 3.2 Rate Limiting (`rateLimitMiddleware.js`)
* `authLimiter`: 10 requests per 15-minute window per IP. Applied strictly to `/api/auth/login`, `/signup`, `/forgot-password`.
* `aiLimiter`: 30 requests per 15-minute window per user. Applied strictly to `/api/ai/chat`, `/upload`, `/transcribe`, `/generate-study-plan`.
* Standard read endpoints (`/api/attendance/*`, `/api/marks/*`, `/api/timetable/*`, `/api/decision/*`) do not have rate limiters, permitting high-throughput benchmarking.

---

## 4. Key Endpoints Architecture & Data Access Patterns

### 4.1 Student Dashboard / Decision Engine (`GET /api/decision/today-plan`)
* **Purpose**: Generates daily personalized academic and placement priorities, calculating aggregate risk level (Low/Medium/High) and next 3 high-leverage actions.
* **Query Flow**:
  1. `getAttendanceScore(userId)`:
     - `Subject.find({ userId }).lean()`
     - `Attendance.find({ userId }).populate('subjectId', 'name').lean()`
  2. `getCGPA(userId)`:
     - `Marks.find({ userId, examType: 'final' }).populate('subjectId', 'credits')`
  3. `getCareerData(userId)`:
     - `CareerProgress.findOne({ userId })`
  4. `getClassroomAssignments(userId)`:
     - `ClassroomAssignment.find({ userId, status: { $ne: 'submitted' } }).sort({ dueDate: 1 }).limit(5)`
* **Execution Pattern**:
  - All 4 functions execute concurrently via `Promise.all`.
  - However, within `getAttendanceScore`, all attendance documents for the student across all semesters are loaded into memory and populated, even though `Subject` documents were already queried.
  - `Marks.find` does not use `.lean()` and causes full Mongoose hydration.
  - `CareerProgress.findOne` does not use `.lean()`.
  - `ClassroomAssignment.find` uses `{ $ne: 'submitted' }` which cannot effectively use single-field indexes without a compound index on `{ userId: 1, status: 1, dueDate: 1 }`.

### 4.2 Attendance Retrieval (`GET /api/attendance/summary` & `GET /api/attendance/trends`)
* **`GET /api/attendance/summary`**:
  - Checks in-memory `summaryCache` (`TTLCache`, 5-minute TTL).
  - On miss: executes `Promise.all` fetching `Subject.find({ userId }).lean()` and `Attendance.find({ userId }).populate('subjectId', 'name code credits').sort({ date: 1 }).lean()`.
  - Computes streaks, shortfall calculation for 75% requirement (`neededToReach75`), and predictive penalty simulation (`miss1`, `miss2`, `miss5`).
* **`GET /api/attendance/trends`**:
  - Queries `Attendance.find({ userId, date: { $gte: since }, status: { $ne: 'cancelled' } })`.
  - **Bottleneck**: Does **not** use `.lean()`. Hydrates hundreds of Mongoose documents with complete internal state. No field projection (pulls unused fields `__v`, `slot`, `time`, `createdAt`, `updatedAt`).

### 4.3 Marks Retrieval (`GET /api/marks/cgpa-semester` & `GET /api/marks`)
* **`GET /api/marks/cgpa-semester`**:
  - Checks in-memory `cgpaCache` (`TTLCache`, 5-minute TTL).
  - On miss: executes `Semester.find({ student: userId }).sort({ semesterNumber: 1 })`.
  - **Bottleneck**: No `.lean()`. Hydrates array of nested `SubjectSchema` subdocuments. Missing compound index on `{ student: 1, semesterNumber: 1 }`.
* **`GET /api/marks`**:
  - `Marks.find({ userId: req.user.id }).populate('subjectId', 'name code credits').sort({ examDate: -1 })`.
  - **Bottleneck**: No `.lean()`. No compound index on `{ userId: 1, examDate: -1 }`.

### 4.4 Timetable Retrieval (`GET /api/timetable` / `GET /api/subjects`)
* `Subject.find({ userId: req.user.id }).sort({ name: 1 })`.
* Indexed by `{ userId: 1, name: 1 }`.
* **Bottleneck**: No `.lean()`. Hydrates full Mongoose models including nested schedule arrays.

### 4.5 AI Notes / RAG Metadata & Retrieval (`GET /api/ai/notes` & `POST /api/ai/chat`)
* **`GET /api/ai/notes`**:
  - First executes: `NoteChunk.countDocuments({ user: userId })`.
  - Then executes: `NoteChunk.aggregate([{ $match: { user: userId } }, { $group: { _id: '$filename', chunks: { $sum: 1 }, updatedAt: { $max: '$updatedAt' } } }, { $sort: { updatedAt: -1 } }])`.
  - **Critical Bottleneck**: `NoteChunk` schema has **zero** indexes! Both queries trigger complete Collection Scans (`COLLSCAN`).
  - Because `NoteChunk` stores float array embeddings (`embedding: [Number]`), each document is multi-kilobyte. A full collection scan forces MongoDB to read mega/gigabytes from disk/memory.
* **`POST /api/ai/chat` (Vector Search Pipeline)**:
  - Calls `retrieveRelevantChunks(userId, message)`:
    - Queries `NoteChunk.find({ user: userObjectId })`.
    - **Bottleneck**: COLLSCAN without index on `user`.
    - **Bottleneck**: No `.lean()` — hydrates all chunk models into memory.
    - Generates query embedding via Gemini `text-embedding-004` (external call).
    - Computes in-memory cosine similarity across all user chunks in Node.js event loop.
    - Slices top $K=4$ and passes them as untrusted context block into Gemini generative model.

---

## 5. Summary of Architecture Findings

| Component | Current State | Potential Bottlenecks Identified |
| :--- | :--- | :--- |
| **Authentication** | JWT with 30s TTL cache on `tokenVersion` | High efficiency; sub-millisecond on cache hit. |
| **Response Headers** | `Cache-Control: no-store` on `/api` | Prevents stale data; shifts full read load to server. |
| **Compression** | Gzip enabled via `compression()` | Reduces payload bytes over wire, minimal CPU footprint. |
| **Mongoose Querying** | Heavy use of Mongoose hydration | Many endpoints lack `.lean()`, causing unnecessary object overhead. |
| **Database Indexing** | Partial indexing | Missing indexes on `NoteChunk` (zero indexes), compound sort index on `Semester`, and missing query coverage on `ClassroomAssignment`. |
| **RAG Pipeline** | In-memory similarity calculation | Unindexed chunk retrieval causes collection scans before embedding matching. |
