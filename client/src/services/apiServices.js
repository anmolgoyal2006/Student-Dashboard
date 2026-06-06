import API, { apiRequest } from '../api/axios';

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authService = {
  signup: (data) => apiRequest('post', '/auth/signup', data),
  login:  (data) => apiRequest('post', '/auth/login',  data),
  getMe:  ()     => apiRequest('get',  '/auth/me'),
  update: (data) => apiRequest('put',  '/auth/profile', data),
};

// ─── Subjects (Timetable) ──────────────────────────────────────────────────
export const subjectService = {
  getAll: ()      => apiRequest('get',    '/timetable'),
  add:    (data)  => apiRequest('post',   '/timetable', data),
  update: (id, d) => apiRequest('put',    `/timetable/${id}`, d),
  remove: (id)    => apiRequest('delete', `/timetable/${id}`),
};

// ─── Attendance ───────────────────────────────────────────────────────────
export const attendanceService = {
  mark:            (data) => apiRequest('post', '/attendance', data),
  getClassSummary: ()     => apiRequest('get',  '/attendance/class-summary'),

  // [UNCHANGED] summary now returns { summary, overview } — overview used for insight cards
  getSummary: () => apiRequest('get', '/attendance/summary'),

  // [CHANGED] accepts optional months param (default 6, max 12)
  getTrends: (months = 6) => apiRequest('get', '/attendance/trends', null, {
    params: { months },
  }),

  // [CHANGED] accepts optional pagination + date range params
  getBySubject: (id, params = {}) => apiRequest('get', `/attendance/${id}`, null, {
    params,
  }),
};

// ─── Marks ────────────────────────────────────────────────────────────────
export const marksService = {
  add:    (data) => apiRequest('post',   '/marks',      data),
  getAll: ()     => apiRequest('get',    '/marks'),
  getCGPA:()     => apiRequest('get',    '/marks/cgpa'),
  remove: (id)   => apiRequest('delete', `/marks/${id}`),

  // ── SGPA / semester ──
  getSemesters:      ()     => apiRequest('get',    '/marks/semesters'),
  getGradeOptions:   ()     => apiRequest('get',    '/marks/grade-options'),
  getCGPAbySemester: ()     => apiRequest('get',    '/marks/cgpa-semester'),

  addSemester:       (data) => apiRequest('post',   '/marks/semester', data),
  addManualSGPA:     (data) => apiRequest('post',   '/marks/semester/manual', data),
  updateSemester:    (id, data) => apiRequest('put', `/marks/semester/${id}`, data),
  deleteSemester:    (id)   => apiRequest('delete', `/marks/semester/${id}`),

  // PDF leaderboard (multi-PDF dynamic)
  parsePdfs: (formData) =>
    API.post('/marks/parse-pdfs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  generateLeaderboard: (payload) =>
    apiRequest('post', '/marks/generate-leaderboard', payload),
  generateSgpaLeaderboard: (payload) =>
    apiRequest('post', '/marks/generate-sgpa-leaderboard', payload),
  uploadPdf: (formData) =>
    API.post('/marks/upload-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // OCR review & AI correction
  ocrAiCorrect: (payload) =>
    apiRequest('post', '/ocr-ai-correct', payload),
  ocrReviewGenerate: (payload) =>
    apiRequest('post', '/ocr-review-generate', payload),

  // Saved PDFs
  savePdf: (formData) =>
    API.post('/marks/saved-pdfs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getSavedPdfs: () =>
    apiRequest('get', '/marks/saved-pdfs'),
  deleteSavedPdf: (id) =>
    apiRequest('delete', `/marks/saved-pdfs/${id}`),
  parseSavedPdf: (id) =>
    apiRequest('post', `/marks/saved-pdfs/${id}/parse`),
};

// ─── Career ───────────────────────────────────────────────────────────────
export const careerService = {
  get:         ()        => apiRequest('get',   '/career'),
  getPlan:     ()        => apiRequest('get',   '/career/plan'),
  update:      (data)    => apiRequest('put',   '/career',               data),
  updateTopic: (name, d) => apiRequest('patch', `/career/topic/${name}`, d),
  analyzeResume: (resumeText) => apiRequest('post', '/career/analyze-resume', { resumeText }),
  getMockQuestions: (topic) => apiRequest('post', '/career/mock-questions', { topic }),
  evaluateAnswer: (question, userAnswer, topic) => apiRequest('post', '/career/evaluate-answer', { question, userAnswer, topic }),
  uploadResume: (formData) =>
    API.post('/career/upload-resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateActiveIndex: (index) => apiRequest('patch', '/career/active-interview/index', { index }),
  resetActiveInterview: () => apiRequest('delete', '/career/active-interview'),

  // AI DSA Coach
  getDsaCoach: (refresh = false) => apiRequest('post', '/career/dsa/coach', { refresh }),
  getDsaTopicGuide: (topic) => apiRequest('post', '/career/dsa/topic-guide', { topic }),
  logDsaPractice: (text) => apiRequest('post', '/career/dsa/log-practice', { text }),
  getDsaHint: (topic, problemTitle, attempt) =>
    apiRequest('post', '/career/dsa/hint', { topic, problemTitle, attempt }),

  linkLeetcode: (username) => apiRequest('put', '/career/leetcode', { username }),
  unlinkLeetcode: () => apiRequest('delete', '/career/leetcode'),
  syncLeetcode: (username) => apiRequest('post', '/career/leetcode/sync', username ? { username } : {}),
  getCompanyQuestions: (params = {}) => apiRequest('get', '/career/leetcode/company-questions', null, { params }),
};

// ─── AI Recommendations ───────────────────────────────────────────────────
export const aiService = {
  getRecommendations: () => apiRequest('get', '/recommendations'),
};

// ─── Notifications ────────────────────────────────────────────────────────
export const notificationService = {
  getAll: () => apiRequest('get', '/notifications'),
};

// ─── Tasks / Scheduler ───────────────────────────────────────────────────
export const taskService = {
  getAll:  (params) => apiRequest('get',    '/tasks', null, { params }),
  getOne:  (id)     => apiRequest('get',    `/tasks/${id}`),
  create:  (data)   => apiRequest('post',   '/tasks', data),
  update:  (id, d)  => apiRequest('put',    `/tasks/${id}`, d),
  remove:  (id)     => apiRequest('delete', `/tasks/${id}`),
  toggle:  (id)     => apiRequest('patch',  `/tasks/${id}/toggle`),
};

// ─── User ─────────────────────────────────────────────────────────────────
export const userService = {
  updateProfile:  (data)               => apiRequest('put',  '/user/update-profile',          data),
  changePassword: (data)               => apiRequest('put',  '/user/change-password',         data),
  forgotPassword: (data)               => apiRequest('post', '/user/forgot-password',         data),
  resetPassword:  (token, newPassword) => apiRequest('post', `/user/reset-password/${token}`, { newPassword }),
  updateSID:      (data)               => apiRequest('put',  '/user/update-sid',              data),
};

// ─── AI Chat / Study Assistant ────────────────────────────────────────────
export const aiChatService = {
  chat: (message, mode) =>
    apiRequest('post', '/ai/chat', { message, mode }),

  uploadNotes: (file) => {
    const form = new FormData();
    form.append('file', file);
    return API.post('/ai/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  transcribeAudio: (blob) => {
    const ext = blob.type?.includes('ogg') ? 'ogg' : blob.type?.includes('wav') ? 'wav' : 'webm';
    const form = new FormData();
    form.append('file', blob, `voice.${ext}`);
    return API.post('/ai/transcribe', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getNotes: () =>
    apiRequest('get', `/ai/notes?t=${Date.now()}`),

  deleteNote: (filename) =>
    apiRequest('delete', `/ai/notes/${encodeURIComponent(filename)}`),
};

// ─── Decision / Smart Plan ────────────────────────────────────────────────
export const decisionService = {
  getTodayPlan: () => API.get('/decision/today-plan'),
};

// ─── Prediction ───────────────────────────────────────────────────────────
export const predictionService = {
  getPredict: (params) => apiRequest('get', '/predict', null, { params }),
  getAIAnalysis: (params) => apiRequest('get', '/predict/ai-analysis', null, { params }),
};

export const aiCommandService = {
  send: (payload) => apiRequest('post', '/ai-command', typeof payload === 'string' ? { message: payload } : payload),
};
