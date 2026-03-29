import API from '../api/axios';

export const attendanceService = {
  mark:       (data)      => API.post('/attendance', data),
  getSummary: ()          => API.get('/attendance/summary'),
  getTrends:  ()          => API.get('/attendance/trends'),
  getBySubject: (id)      => API.get(`/attendance/${id}`),
};

export const marksService = {
  add:    (data) => API.post('/marks', data),
  getAll: ()     => API.get('/marks'),
  getCGPA:()     => API.get('/marks/cgpa'),
  remove: (id)   => API.delete(`/marks/${id}`),
};

export const subjectService = {
  getAll: ()       => API.get('/subjects'),
  add:    (data)   => API.post('/subjects', data),
  update: (id, d)  => API.put(`/subjects/${id}`, d),
  remove: (id)     => API.delete(`/subjects/${id}`),
};

export const careerService = {
  get:         ()          => API.get('/career'),
  update:      (data)      => API.put('/career', data),
  updateTopic: (name, d)   => API.patch(`/career/topic/${name}`, d),
};

export const authService = {
  signup:  (data) => API.post('/auth/signup', data),
  login:   (data) => API.post('/auth/login', data),
  getMe:   ()     => API.get('/auth/me'),
  update:  (data) => API.put('/auth/profile', data),
};

export const aiService = {
  getRecommendations: () => API.get('/recommendations'),
};

export const notificationService = {
  getAll: () => API.get('/notifications'),
};
