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
  getAll: ()      => apiRequest('get',    '/subjects'),
  add:    (data)  => apiRequest('post',   '/subjects', data),
  update: (id, d) => apiRequest('put',    `/subjects/${id}`, d),
  remove: (id)    => apiRequest('delete', `/subjects/${id}`),
};

// ─── Attendance ───────────────────────────────────────────────────────────
export const attendanceService = {
  mark:         (data) => apiRequest('post', '/attendance',         data),
  getSummary:   ()     => apiRequest('get',  '/attendance/summary'),
  getTrends:    ()     => apiRequest('get',  '/attendance/trends'),
  getBySubject: (id)   => apiRequest('get',  `/attendance/${id}`),
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

  // 🔥 ADD THIS LINE
  updateSemester:    (id, data) => apiRequest('put', `/marks/semester/${id}`, data),

  deleteSemester:    (id)   => apiRequest('delete', `/marks/semester/${id}`),
};
// ─── Career ───────────────────────────────────────────────────────────────
export const careerService = {
  get:         ()        => apiRequest('get',   '/career'),
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
  updateProfile:  (data)              => apiRequest('put',  '/user/update-profile',          data),
  changePassword: (data)              => apiRequest('put',  '/user/change-password',         data),
  forgotPassword: (data)              => apiRequest('post', '/user/forgot-password',         data),
  resetPassword:  (token, newPassword)=> apiRequest('post', `/user/reset-password/${token}`, { newPassword }),
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