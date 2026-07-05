<div align="center">

# 🎓 StudentAI

### Autonomous AI-Powered Academic Success Agent

**StudentAI doesn't just track your grades — it thinks, predicts, and acts on your behalf.**

A multi-agent platform that perceives your academic life, predicts risk before it happens, and autonomously plans your path to placement readiness.

[![Live Demo](https://img.shields.io/badge/Live-Demo-7C3AED?style=for-the-badge&logo=vercel&logoColor=white)](https://student-dashboard-ashy-rho.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-1E3A8A?style=for-the-badge&logo=github&logoColor=white)](https://github.com/anmolgoyal2006/Student-Dashboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](#-license)

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-LLM-F55036?style=flat-square)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)

[Live Demo](https://student-dashboard-ashy-rho.vercel.app/) · [Report Bug](https://github.com/anmolgoyal2006/Student-Dashboard/issues) · [Request Feature](https://github.com/anmolgoyal2006/Student-Dashboard/issues)

</div>

---

## 📖 Project Overview

Most "student dashboards" stop at showing you a CGPA number and a pie chart. **StudentAI is built differently.**

It's architected as a **multi-agent autonomous system** — six specialized AI agents coordinated by a central orchestrator — that continuously collects signals from your academic life (attendance, marks, classroom activity, coding practice, opportunities) and acts on them: predicting risk, generating study plans, digitizing handwritten records, simulating interviews, and surfacing hackathons before deadlines pass.

It's not a tracker. It's an **agent that works while you study.**

---

## 💡 Why StudentAI?

| Typical Student Dashboard | StudentAI |
|---|---|
| Shows your CGPA after the fact | **Predicts** attendance shortage before it happens |
| Manual data entry for every mark | **OCR pipeline** digitizes handwritten marksheets automatically |
| Static analytics | **Multi-agent loop** continuously re-plans as new data arrives |
| One feature, one purpose | **Six coordinated agents** spanning academics, placements, and opportunities |
| You search for hackathons yourself | **Opportunity Intelligence** agent discovers and tracks deadlines for you |
| Generic "study harder" advice | Personalized, explainable recommendations grounded in your actual data |

---

## ✨ Core Features

### 📊 Academic Intelligence
- Real-time attendance monitoring with subject-wise breakdowns
- **Predictive shortage detection** — know how many classes you can miss before it's a problem
- SGPA/CGPA analytics with semester-over-semester trends
- Exam readiness scoring based on syllabus coverage and performance history
- Centralized marks management across midterms, finals, quizzes, and assignments

### 🧠 AI Learning Assistant
- Upload lecture notes (PDF, image, or text) for instant processing
- AI-generated concept summaries and key-point extraction
- Automatic quiz generation from your own study material
- Personalized study suggestions based on weak areas

### 🔍 OCR Intelligence
- Upload photos or PDFs of handwritten marksheets or grade lists
- Tesseract.js + AI correction pipeline extracts marks automatically
- Auto-digitizes records into your academic profile — no manual typing
- Multi-PDF merge and ranking for bulk uploads

### 💼 Placement Intelligence
- LeetCode progress sync with topic-wise DSA strength analysis
- Placement readiness scoring across companies and roles
- Company-focused preparation roadmaps
- Coding consistency tracking over time

### 🎤 AI Mock Interview System
- Realistic interview simulations with AI-generated, role-specific questions
- Structured feedback on answers, communication, and technical depth
- Iterative practice loop tied into placement readiness scoring

### 🚀 Opportunity Intelligence
- Autonomous **Hackathon Discovery Agent** that scans and surfaces relevant competitions
- Workshop and event discovery
- Deadline monitoring with proactive reminders
- Career opportunity recommendations matched to your skill profile

### ⏰ Productivity System
- Smart timetable and task scheduling
- Cron-based reminders for deadlines, classes, and assignments
- Push notifications via Firebase Cloud Messaging

### 🔗 Smart Integrations
- **Google Classroom sync** — assignments and announcements flow in automatically
- Google OAuth for frictionless login
- Email notifications for critical academic events

---

## 🧠 Intelligence Architecture

StudentAI uses a **service-oriented architecture** with specialized controllers and services, coordinated through a central Express API. Rather than monolithic AI calls, the system routes requests through domain-specific handlers.

```
                     ┌───────────────────────┐
                     │   React (CRA) UI       │
                     │   (Framer Motion)      │
                     └───────────┬────────────┘
                                  │ REST / Axios
                                  ▼
                     ┌───────────────────────┐
                     │  Node.js + Express API  │
                     │   (JWT + Google OAuth) │
                     └───────────┬────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                    ▼
     ┌────────────────┐ ┌─────────────────┐ ┌──────────────────┐
     │  MongoDB Atlas  │ │  Service Layer   │ │   Node Cron Jobs  │
     │   (persistence) │ │  (26 services)  │ │ (scheduled tasks) │
     └────────────────┘ └────────┬────────┘ └──────────────────┘
                                  │
            ┌─────────────┬──────┼──────┬──────────────┬───────────────┐
            ▼             ▼      ▼      ▼              ▼               ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐
      │   Groq   │ │  OpenAI  │ │  Google  │ │  Firebase  │ │   LeetCode /   │
      │   SDK    │ │   SDK    │ │Classroom │ │     FCM    │ │  Hackathon Eng │
      └──────────┘ └──────────┘ └──────────┘ └────────────┘ └───────────────┘
```

**Connected Services:** Groq (LLM reasoning) · OpenAI (LLM fallback) · Google Classroom API · Firebase Cloud Messaging · LeetCode tracking · Hackathon Discovery Engine · Tesseract.js OCR

---

## 🛠️ Technology Stack

<table>
<tr>
<td valign="top" width="33%">

**Frontend**
- React.js (CRA)
- Chart.js + react-chartjs-2
- Recharts
- Framer Motion
- Lucide React
- React Router DOM v6

</td>
<td valign="top" width="33%">

**Backend**
- Node.js
- Express.js
- MongoDB Atlas + Mongoose
- JWT Authentication
- Google OAuth (Passport)
- Node Cron

</td>
<td valign="top" width="33%">

**AI / Intelligence**
- Groq SDK (LLM)
- OpenAI SDK
- Tesseract.js OCR
- AI Correction Pipeline
- AI Notes Processing
- Quiz Generation

</td>
</tr>
</table>

**Integrations:** Google Classroom API · Firebase Cloud Messaging · Email Notifications · LeetCode Tracking · Unstop & Devfolio Collectors

---

## 📸 Screenshots

### 🏠 Dashboard — Live Academic Snapshot
At-a-glance CGPA, today's classes, low-attendance alerts, and per-subject attendance trends the moment you log in.

![Dashboard Overview](../../Screenshots/dashboard.png)

### 🗓️ Smart Scheduler — Weekly Timetable Grid
Color-coded weekly grid with room numbers and time slots, auto-populated and editable in seconds.

![Weekly Timetable Grid](../../Screenshots/timetable.png)

### ✅ Attendance Intelligence — Records & Subject Breakdown
Subject-wise attendance percentage with shortage warnings ("Attend next 2 consecutive classes to reach 75%") plus a full present/absent log.

![Attendance Records](../../Screenshots/attendance.png)

### 📊 Marks & CGPA — Multi-PDF Ranking + OCR
Upload marksheet PDFs directly, auto-merge results, weight scoring, and generate ranked leaderboards — no manual data entry.

![Marks, CGPA & OCR Upload](../../Screenshots/marks-ocr.png)

### 🧮 Trajectory Analysis — Predictive CGPA Forecasting
The Predictor agent projects your CGPA semesters in advance, flags risk-area subjects, and outputs a concrete improvement plan.

![Trajectory Analysis](../../Screenshots/trajectory.png)

### 💻 AI DSA Coach — Placement Readiness
Live LeetCode sync (solved counts by difficulty), a personalized AI-generated practice plan, and a 0–100 placement readiness score.

![AI DSA Coach](../../Screenshots/dsa-coach.png)

### 🎤 Resume Scanner & AI Mock Interview
Upload a resume for keyword-gap analysis against your target role, then jump straight into an AI-generated mock interview.

![Resume Scanner & Mock Interview](../../Screenshots/mock-interview.png)

### 🚀 Opportunity Intelligence — Hackathon Discovery
Auto-aggregated hackathons, workshops, and competitions with difficulty tags and deadlines — filterable by Recommended, Closing Soon, and Saved.

![Hackathon Discovery](../../Screenshots/hackathons.png)

### 🧠 AI Study Assistant — Natural Language Dashboard Control
A Groq-powered chat interface that updates your dashboard from plain English — add a subject, mark attendance, or ask about your CGPA, conversationally.

![AI Study Assistant](../../Screenshots/notes-ai.png)

### 📈 Analytics — Productivity & Workload Insights
Assignment completion trends, subject-wise workload distribution, and deadline timelines that surface where effort is actually going.

![Analytics Dashboard](../../Screenshots/analytics.png)

---

## ⚙️ Installation Guide

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (or local MongoDB instance)
- Groq API key
- Google Gemini API key
- Google Cloud OAuth credentials
- Firebase project (for FCM)

### 1. Clone the Repository

```bash
git clone https://github.com/anmolgoyal2006/Student-Dashboard.git
cd Student-Dashboard
```

### 2. Backend Setup

```bash
cd server
npm install
npm run dev
```

### 3. Frontend Setup

```bash
cd client
npm install
npm start
```

The app will be available at `http://localhost:3000` (frontend) and `http://localhost:5000` (API).

---

## 🔑 Environment Variables

Create a `.env` file inside `/server`:

```env
# Server
PORT=5000

# Database
MONGO_URI=your_mongodb_atlas_uri

# Auth
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# AI Services
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_vision_api_key

# Google Classroom
GOOGLE_CLASSROOM_API_KEY=your_classroom_api_key

# Firebase
FIREBASE_SERVER_KEY=your_firebase_server_key
FIREBASE_PROJECT_ID=your_firebase_project_id

# Email
EMAIL_HOST=smtp.example.com
EMAIL_USER=your_email
EMAIL_PASS=your_email_app_password
```

---

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register a new user |
| `POST` | `/api/auth/login` | Login (JWT) |
| `GET` | `/api/auth/google` | Google OAuth login |
| `POST` | `/api/auth/forgot-password` | Send password reset email |
| `POST` | `/api/auth/reset-password/:token` | Reset password with token |
| `GET` | `/api/marks` | Fetch marks records |
| `POST` | `/api/marks` | Add marks |
| `GET` | `/api/marks/cgpa` | Get CGPA |
| `POST` | `/api/marks/semester` | Add a new semester |
| `GET` | `/api/marks/cgpa-semester` | Compute CGPA from semester SGPAs |
| `GET` | `/api/marks/semesters` | Get all semesters |
| `POST` | `/api/marks/upload-pdf` | Upload marksheet PDF |
| `POST` | `/api/marks/parse-pdfs` | Parse multiple PDFs at once |
| `POST` | `/api/marks/generate-leaderboard` | Generate marks leaderboard |
| `POST` | `/api/marks/ocr-ai-correct` | AI correction for OCR output |
| `GET` | `/api/attendance/summary` | Attendance breakdown + shortage prediction |
| `POST` | `/api/attendance` | Mark attendance |
| `GET` | `/api/attendance/trends` | Monthly attendance trends |
| `POST` | `/api/attendance/mark-from-notification` | Mark attendance via notification |
| `GET` | `/api/tasks` | Get all tasks |
| `GET` | `/api/timetable` | Get timetable |
| `GET` | `/api/subjects` | Get subjects |
| `GET` | `/api/career` | Career progress data |
| `POST` | `/api/ai/chat` | AI chat assistant |
| `POST` | `/api/ai/upload` | Upload notes for AI processing |
| `POST` | `/api/ai/generate-study-plan` | Generate study plan |
| `POST` | `/api/ai-command/process` | Process natural language commands |
| `GET` | `/api/predict/attendance` | Predict attendance shortage risk |
| `GET` | `/api/predict/cgpa` | Predict CGPA trajectory |
| `GET` | `/api/opportunities` | Discovered hackathons & events |
| `GET` | `/api/opportunities/recommended` | Personalized recommendations |
| `GET` | `/api/opportunities/closing-soon` | Events closing soon |
| `GET` | `/api/opportunities/trending` | Trending opportunities |
| `POST` | `/api/opportunities/:id/save` | Save an opportunity |
| `GET` | `/api/recommendations` | AI-generated personalized recommendations |
| `GET` | `/api/analytics` | Productivity & workload analytics |
| `POST` | `/api/classroom/sync` | Sync Google Classroom assignments |
| `GET` | `/api/notifications` | Get user notifications |
| `GET` | `/api/events` | Get academic events |

---

## 📁 Folder Structure

```
Student-Dashboard/
├── server/                       # Backend (Node.js + Express)
│   ├── collectors/              # Hackathon & event collectors
│   │   ├── devfolioCollector.js
│   │   ├── unstopCollector.js
│   │   └── registry.js
│   ├── config/                  # DB + Passport configs
│   ├── controllers/             # Business logic (18 controllers)
│   ├── jobs/                    # Node Cron scheduled tasks (5 jobs)
│   ├── middleware/              # Auth & validation
│   ├── models/                  # Mongoose schemas (19 models)
│   ├── routes/                  # API routes (22 route files)
│   ├── services/                # AI, OCR, ranking, notification services
│   ├── utils/                   # SGPA/CGPA, helpers
│   └── server.js                # Entry point
│
└── client/                       # Frontend (React CRA)
    └── src/
        ├── components/           # UI components (27 components)
        ├── context/              # Global state (React Context)
        ├── pages/                # Route pages (15+ pages)
        ├── services/             # API service layer
        └── styles/               # Global CSS
```

---

## 🗺️ Future Roadmap

- [ ] Mobile app (React Native)
- [ ] Multi-institution support for college-wide deployment
- [ ] Resume builder agent with ATS optimization
- [ ] Peer benchmarking (anonymized cohort comparisons)
- [ ] Voice-based mock interviews
- [ ] LinkedIn/GitHub profile intelligence integration
- [ ] Offline-first PWA support

---

## 🏆 Resume-Worthy Highlights

> Use these as talking points in interviews, resumes, or hackathon pitches.

- Designed and built an **AI-powered student platform** with specialized controllers and services for academics, placements, and opportunities
- Built an **OCR-based digitization pipeline** using Tesseract.js + AI correction to convert handwritten marksheets into structured academic records
- Implemented a **predictive attendance engine** that forecasts shortage risk rather than just reporting historical data
- Engineered **Google Classroom synchronization** for automatic assignment and announcement ingestion
- Built **autonomous hackathon collectors** (Unstop & Devfolio) for proactive opportunity surfacing and deadline tracking
- Developed an **AI chat assistant** with LLM-powered study planning and command processing
- Created a **placement readiness system** combining DSA topic analysis and coding consistency metrics
- Architected a full production stack: **React, Node/Express, MongoDB Atlas**, JWT + Google OAuth, and Firebase Cloud Messaging

---

## 🤝 Contribution Guide

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "Add: your feature"`
4. Push to your branch: `git push origin feature/your-feature-name`
5. Open a Pull Request with a clear description of the change

Please open an issue first for major changes to discuss what you'd like to add.

---

## 📄 License

This project is licensed under the **MIT License**.

You're free to use, modify, and distribute this code — proper credit to the original author is appreciated.

© Anmol Goyal

---

<div align="center">

**Built by [Anmol Goyal](https://github.com/anmolgoyal2006)**

If StudentAI helped you or inspired your own project, consider giving it a ⭐

</div>
