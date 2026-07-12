// Tüm istekler API Gateway'e gider, gateway ilgili servise yönlendirir.
// Lokal geliştirmede varsayılan: http://localhost:8080
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  owner: string;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `İstek başarısız oldu (${res.status})`);
  }

  // 204 No Content gibi durumlarda body olmayabilir
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export const api = {
  register: (username: string, email: string, password: string) =>
    request<{ token: string; username: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  login: (username: string, password: string) =>
    request<{ token: string; username: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getTasks: () => request<Task[]>('/api/tasks'),

  createTask: (title: string, description: string) =>
    request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    }),

  updateTask: (id: number, data: Partial<Task>) =>
    request<Task>(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTask: (id: number) =>
    request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
};

export function saveSession(token: string, username: string) {
  localStorage.setItem('token', token);
  localStorage.setItem('username', username);
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
}

export function getUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('username');
}

export { getToken };
