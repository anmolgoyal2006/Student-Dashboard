import API from '../api/axios';

// Attendance
export const attendanceService = {
  mark:       (data) => API.post('/api/attendance', data),
  getSummary: ()     => API.get('/api/attendance/summary'),
  getTrends:  ()     => API.get('/api/attendance/trends'),
  getBySubject: (id) => API.get(`/api/attendance/${id}`),
};

// Marks
export const marksService = {
  add:    (data) => API.post('/api/marks', data),
  getAll: ()     => API.get('/api/marks'),
  getCGPA:()     => API.get('/api/marks/cgpa'),
  remove: (id)   => API.delete(`/api/marks/${id}`),
};

// Subjects
export const subjectService = {
  getAll: ()       => API.get('/api/subjects'),
  add:    (data)   => API.post('/api/subjects', data),
  update: (id, d)  => API.put(`/api/subjects/${id}`, d),
  remove: (id)     => API.delete(`/api/subjects/${id}`),
};

// Career
export const careerService = {
  get:         ()        => API.get('/api/career'),
  update:      (data)    => API.put('/api/career', data),
  updateTopic: (name, d) => API.patch(`/api/career/topic/${name}`, d),
};

// Auth
export const authService = {
  signup:  (data) => API.post('/api/auth/signup', data),
  login:   (data) => API.post('/api/auth/login', data),
  getMe:   ()     => API.get('/api/auth/me'),
  update:  (data) => API.put('/api/auth/profile', data),
};

// AI Recommendations
export const aiService = {
  getRecommendations: () => API.get('/api/recommendations'),
};

// Notifications
export const notificationService = {
  getAll: () => API.get('/api/notifications'),
};