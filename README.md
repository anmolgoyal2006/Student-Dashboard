# 🎓 AI-Powered Student Dashboard with Career Assistant

## 👨‍💻 Developed by

**Anmol Goyal**

A full-stack **MERN application** designed to help students track academic performance, manage tasks, and receive intelligent insights using a rule-based AI system.

---

## 🌐 Live Demo

🔗 https://student-dashboard-ashy-rho.vercel.app/

## 💻 GitHub Repository

🔗 https://github.com/anmolgoyal2006/Student-Dashboard

---

## 🚀 Features

### 📊 Academic Performance

* SGPA calculation based on grades & credits
* CGPA calculation using semester-wise SGPA
* Real-time CGPA updates

### 📚 Marks Management

* Add & track marks (midterm, final, quizzes, assignments)
* Automatic percentage → grade → grade point conversion
* Subject-wise performance breakdown

### 📈 Analytics & Visualization

* Attendance tracking with subject-wise insights
* Interactive charts using Chart.js
* CGPA gauge visualization

### 🎯 Semester System

* Add multiple semesters with subjects, credits & grades
* Automatic SGPA calculation per semester
* CGPA derived from SGPA trend

### 🤖 AI-Based Recommendations

* Smart suggestions based on attendance, CGPA & progress
* Study improvement insights
* Career readiness tracking

### 🧠 Productivity & Management

* Task scheduler for daily planning
* Timetable & subject management
* Notification system

### 🔐 Authentication

* Secure JWT-based login & signup
* Protected routes for user-specific data

---

## 🛠️ Tech Stack

| Layer     | Technology           |
| --------- | -------------------- |
| Frontend  | React.js             |
| Backend   | Node.js + Express.js |
| Database  | MongoDB + Mongoose   |
| Charts    | Chart.js             |
| Auth      | JWT (jsonwebtoken)   |
| HTTP      | Axios                |
| Dev Tools | Nodemon              |

---

## 📁 Project Structure

```
student-dashboard/
├── server/                    # Backend (Node.js + Express)
│   ├── config/               # DB + configs
│   ├── controllers/          # Business logic
│   ├── middleware/           # Auth middleware
│   ├── models/               # Mongoose schemas
│   ├── routes/               # API routes
│   ├── utils/                # Utility functions (SGPA/CGPA)
│   └── server.js             # Entry point
│
└── client/                   # Frontend (React)
    └── src/
        ├── api/              # Axios setup
        ├── context/          # Global state
        ├── pages/            # Screens
        ├── components/       # UI components
        └── services/         # API services
```

---

## 🔌 Key API Endpoints

| Method | Endpoint                 | Description         |
| ------ | ------------------------ | ------------------- |
| POST   | /api/auth/signup         | Register user       |
| POST   | /api/auth/login          | Login (JWT)         |
| GET    | /api/marks               | Get marks           |
| GET    | /api/marks/cgpa-semester | CGPA from SGPA      |
| POST   | /api/marks/semester      | Add semester        |
| GET    | /api/attendance/summary  | Attendance analysis |
| GET    | /api/recommendations     | AI suggestions      |

---

## 🧠 AI Recommendation Logic

The system uses a **rule-based AI engine**:

* Low attendance → Warning + required classes
* Low CGPA → Study improvement suggestions
* Low DSA progress → Practice roadmap
* Career goals → Target-based preparation plan

No external API is used — fully explainable system.

---

## 🧮 CGPA Calculation

```
SGPA = Σ(credit × gradePoint) / Σ(credits)

CGPA = Average of all semester SGPAs
```

---

## ⚙️ Setup Instructions

### 1. Clone Repository

```bash
git clone https://github.com/anmolgoyal2006/Student-Dashboard.git
cd Student-Dashboard
```

---

### 2. Backend Setup

```bash
cd server
npm install
```

Create `.env` file:

```
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
```

Run server:

```bash
npm run dev
```

---

### 3. Frontend Setup

```bash
cd client
npm install
npm start
```

---

## 📌 Interview Explanation

> This is a MERN stack application with JWT authentication. The backend is built using RESTful APIs with MongoDB, where SGPA and CGPA are calculated using weighted averages. The AI system is rule-based and generates recommendations from academic data. The frontend uses React with Context API and Axios interceptors for secure communication, along with Chart.js for data visualization.

---

## ⚠️ Note

This project is publicly available for learning purposes.
If you are using this project, please ensure you understand the implementation details.

I can explain every part of this system including:

* Backend architecture
* SGPA/CGPA logic
* API design
* AI recommendation engine

---

## 📄 License

This project is licensed under the **MIT License**.

You are free to use and modify the code, but proper credit must be given to the original author.

© Anmol Goyal

---
