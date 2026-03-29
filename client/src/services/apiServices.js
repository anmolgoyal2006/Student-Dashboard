import API from '../api/axios';

// Attendance
export const attendanceService = {
  mark:       (data) => API.post('/attendance', data),
  getSummary: ()     => API.get('/attendance/summary'),
  getTrends:  ()     => API.get('/attendance/trends'),
  getBySubject: (id) => API.get(`/attendance/${id}`),
};

// Marks
export const marksService = {
  add:    (data) => API.post('/marks', data),
  getAll: ()     => API.get('/marks'),
  getCGPA:()     => API.get('/marks/cgpa'),
  remove: (id)   => API.delete(`/marks/${id}`),
};

// Subjects
export const subjectService = {
  getAll: ()       => API.get('/subjects'),
  add:    (data)   => API.post('/subjects', data),
  update: (id, d)  => API.put(`/subjects/${id}`, d),
  remove: (id)     => API.delete(`/subjects/${id}`),
};

// Career
export const careerService = {
  get:         ()        => API.get('/career'),
  update:      (data)    => API.put('/career', data),
  updateTopic: (name, d) => API.patch(`/career/topic/${name}`, d),
};

// Auth
export const authService = {
  signup:  (data) => API.post('/auth/signup', data),
  login:   (data) => API.post('/auth/login', data),
  getMe:   ()     => API.get('/auth/me'),
  update:  (data) => API.put('/auth/profile', data),
};

// AI Recommendations
export const aiService = {
  getRecommendations: () => API.get('/recommendations'),
};

// Notifications
export const notificationService = {
  getAll: () => API.get('/notifications'),
};