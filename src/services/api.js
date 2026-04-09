import axios from 'axios';

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const loginUser       = (data)       => API.post('/login', data);
export const createTask      = (data)       => API.post('/create-task', data);
export const getTasks        = (params)     => API.get('/tasks', { params });
export const getDeletedTasks = (params)     => API.get('/tasks/deleted', { params });
export const updateTask      = (id, data)   => API.put(`/update-task/${id}`, data);
export const reassignTask    = (id, data)   => API.put(`/reassign-task/${id}`, data);
export const deleteTask      = (id)         => API.delete(`/delete-task/${id}`);
export const exportCSV       = ()           => API.get('/tasks/export', { responseType: 'blob' });
export const getAnalytics    = ()           => API.get('/tasks/analytics');
export const getStaff        = (department) => API.get(`/staff${department ? `?department=${department}` : ''}`);
export const addStaff        = (data)       => API.post('/staff', data);
export const deleteStaff     = (id)         => API.delete(`/staff/${id}`);
