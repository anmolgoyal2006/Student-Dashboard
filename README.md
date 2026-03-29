# 🎓 AI-Powered Student Dashboard with Career Assistant

A full-stack MERN application for college students to manage academics, track performance, and get AI-based career guidance.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (free tier works)
- npm or yarn

---

### 1. Clone / Extract the project

```bash
cd student-dashboard
```

---

### 2. Backend Setup

```bash
cd server
npm install
```

Create your `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and fill in:
```
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/student_dashboard
JWT_SECRET=any_long_random_string_here
```

Start the backend:
```bash
npm run dev      # with nodemon (auto-reload)
# or
npm start        # without nodemon
```

Backend runs on: **http://localhost:5000**

Test it: open http://localhost:5000/api/ping — you should see `{"message":"Server is running!"}`

---

### 3. Frontend Setup

```bash
cd ../client
npm install
npm start
```

Frontend runs on: **http://localhost:3000**

---

## 📁 Project Structure

```
student-dashboard/
├── server/                    ← Node.js + Express backend
│   ├── config/db.js           ← MongoDB connection
│   ├── controllers/           ← Business logic
│   ├── middleware/            ← JWT auth middleware
│   ├── models/                ← Mongoose schemas
│   ├── routes/                ← API route definitions
│   ├── services/              ← AI recommendation engine
│   └── server.js              ← App entry point
│
└── client/                    ← React frontend
    └── src/
        ├── api/axios.js       ← Axios base instance + interceptors
        ├── context/           ← Auth context (global state)
        ├── pages/             ← Full page components
        ├── components/        ← Reusable UI components
        └── services/          ← API call wrappers
```

---

## 🔌 API Endpoints

| Method | Endpoint                      | Description                  | Auth |
|--------|-------------------------------|------------------------------|------|
| POST   | /api/auth/signup              | Register new user            | ❌   |
| POST   | /api/auth/login               | Login → JWT token            | ❌   |
| GET    | /api/auth/me                  | Get current user             | ✅   |
| GET    | /api/subjects                 | Get all subjects             | ✅   |
| POST   | /api/subjects                 | Add subject                  | ✅   |
| PUT    | /api/subjects/:id             | Update subject               | ✅   |
| DELETE | /api/subjects/:id             | Delete subject               | ✅   |
| POST   | /api/attendance               | Mark attendance              | ✅   |
| GET    | /api/attendance/summary       | Attendance % per subject     | ✅   |
| GET    | /api/attendance/trends        | Monthly attendance trends    | ✅   |
| POST   | /api/marks                    | Add exam marks               | ✅   |
| GET    | /api/marks                    | Get all marks                | ✅   |
| GET    | /api/marks/cgpa               | Calculate CGPA               | ✅   |
| GET    | /api/career                   | Get career progress          | ✅   |
| PUT    | /api/career                   | Update career progress       | ✅   |
| PATCH  | /api/career/topic/:name       | Toggle DSA topic             | ✅   |
| GET    | /api/recommendations          | AI suggestions               | ✅   |
| GET    | /api/notifications            | Smart notifications          | ✅   |

---

## 🧠 How the AI Works

The recommendation engine (`server/services/aiRecommendationService.js`) uses **rule-based logic** — no external AI API needed:

```
If attendance < 75%  → Warning alert with classes needed
If CGPA < 6.0        → Study plan suggestion
If problems < 50     → DSA practice roadmap
If company selected  → Company-specific preparation roadmap
Always               → Readiness badge (Beginner / Intermediate / Ready)
```

---

## 🧮 CGPA Formula

```
CGPA = Σ(gradePoint × credits) / Σ(credits)

Grade scale (auto-calculated from marks %):
90%+ → 10  |  80%+ → 9  |  70%+ → 8  |  60%+ → 7
50%+ → 6   |  40%+ → 5  |  <40% → 4
```

---

## 🛠️ Tech Stack

| Layer      | Technology              |
|------------|-------------------------|
| Frontend   | React 18, React Router 6|
| Charts     | Chart.js + react-chartjs-2 |
| HTTP       | Axios with interceptors |
| Backend    | Node.js + Express.js    |
| Database   | MongoDB + Mongoose      |
| Auth       | JWT (jsonwebtoken)      |
| Password   | bcryptjs                |
| Dev tool   | nodemon                 |

---

## 📌 Interview Explanation (1 paragraph)

> "This is a MERN stack student dashboard with JWT auth. The backend is a RESTful Express API with 5 Mongoose collections — Users, Subjects, Attendance, Marks, and CareerProgress — all linked via userId. CGPA is calculated using a weighted grade point average. The AI recommendation system is a rule-based service that reads attendance, marks, and DSA progress to return prioritized suggestions — no external API needed, which keeps it fully explainable. The React frontend uses Context API for auth state, a centralized Axios instance with request interceptors for automatic JWT attachment, and Chart.js for visualizations."

---

## 📝 Next Steps to Extend

- Add email notifications (Nodemailer)
- Add exam countdown timer
- Connect to a real AI API (OpenAI) for smarter suggestions
- Add PDF report export
- Deploy: Render (backend) + Vercel (frontend) + MongoDB Atlas
