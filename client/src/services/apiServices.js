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
  // Usage: attendanceService.getTrends()        → last 6 months
  //        attendanceService.getTrends(12)       → last 12 months
  getTrends: (months = 6) => apiRequest('get', '/attendance/trends', null, {
    params: { months },
  }),

  // [CHANGED] accepts optional pagination + date range params
  // Usage: attendanceService.getBySubject(id)
  //        attendanceService.getBySubject(id, { page: 2, limit: 20 })
  //        attendanceService.getBySubject(id, { from: '2025-01-01', to: '2025-06-30' })
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
  updateSemester:    (id, data) => apiRequest('put', `/marks/semester/${id}`, data),
  deleteSemester:    (id)   => apiRequest('delete', `/marks/semester/${id}`),
};

// ─── Career ───────────────────────────────────────────────────────────────
export const careerService = {
  get:         ()        => apiRequest('get',   '/career'),
  getPlan:     ()        => apiRequest('get',   '/career/plan'),
  update:      (data)    => apiRequest('put',   '/career',               data),
  updateTopic: (name, d) => apiRequest('patch', `/career/topic/${name}`, d),
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
};

export const aiCommandService = {
  send: (message) => apiRequest('post', '/ai-command', { message }),
};