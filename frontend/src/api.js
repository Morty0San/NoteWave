
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helpers
const getToken = () => localStorage.getItem('notewave_token');

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
  ...extra,
});

const handleRes = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
};

//  Auth 
export const login = async (username, password) => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await handleRes(res);
  localStorage.setItem('notewave_token', data.token);
  return data;
};

export const register = async (username, password) => {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await handleRes(res);
  localStorage.setItem('notewave_token', data.token);
  return data;
};

export const logout = () => localStorage.removeItem('notewave_token');

// Notes
export const getNotes = async (folder = null) => {
  const url = folder ? `${BASE}/notes?folder=${folder}` : `${BASE}/notes`;
  const res = await fetch(url, { headers: headers() });
  return handleRes(res);
};

export const createNote = async (folder = 'Personnel') => {
  const res = await fetch(`${BASE}/notes`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ folder }),
  });
  return handleRes(res);
};

export const updateNote = async (id, patch) => {
  const res = await fetch(`${BASE}/notes/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(patch),
  });
  return handleRes(res);
};

export const deleteNote = async (id) => {
  const res = await fetch(`${BASE}/notes/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return handleRes(res);
};

// Audio
export const uploadAudio = async (noteId, audioBlob, duration) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'memo.webm');
  formData.append('duration', String(Math.round(duration)));

  const res = await fetch(`${BASE}/notes/${noteId}/audio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` }, 
    body: formData,
  });
  return handleRes(res);
};

export const deleteAudio = async (noteId, audioId) => {
  const res = await fetch(`${BASE}/notes/${noteId}/audio/${audioId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return handleRes(res);
};
