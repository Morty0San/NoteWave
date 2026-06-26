import { useState, useRef, useEffect, useCallback } from "react";
import './App.css';

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const getToken = () => localStorage.getItem("notewave_token");

const authHeaders = (extra = {}) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
  ...extra,
});

const handleRes = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
};

const api = {
  login: async (username, password) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await handleRes(res);
    localStorage.setItem("notewave_token", data.token);
    return data;
  },
  register: async (username, password) => {
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await handleRes(res);
    localStorage.setItem("notewave_token", data.token);
    return data;
  },
  logout: () => localStorage.removeItem("notewave_token"),
  getNotes: async (folder = null) => {
    const url = folder ? `${BASE}/notes?folder=${folder}` : `${BASE}/notes`;
    const res = await fetch(url, { headers: authHeaders() });
    return handleRes(res);
  },
  createNote: async (folder) => {
    const res = await fetch(`${BASE}/notes`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ folder }),
    });
    return handleRes(res);
  },
  updateNote: async (id, patch) => {
    const res = await fetch(`${BASE}/notes/${id}`, {
      method: "PATCH", 
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    return handleRes(res);
  },
  deleteNote: async (id) => {
    const res = await fetch(`${BASE}/notes/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return handleRes(res);
  },
  uploadAudio: async (noteId, blob, duration) => {
    const formData = new FormData();
    formData.append("audio", blob, "memo.webm");
    formData.append("duration", String(Math.round(duration)));
    const res = await fetch(`${BASE}/notes/${noteId}/audio`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    return handleRes(res);
  },
  deleteAudio: async (noteId, audioId) => {
    const res = await fetch(`${BASE}/notes/${noteId}/audio/${audioId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return handleRes(res);
  },
};

const MAX_SECS = 120;
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const fmtDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
const WBARS = Array.from({ length: 24 }, () => Math.random() * 55 + 20);
const DEFAULT_FOLDERS = [
  { name: "Personnel", color: "#f4623a", bg: "#fff1ed" },
  { name: "Travail", color: "#2bbf9b", bg: "#edfaf6" },
  { name: "Idées", color: "#7c5cbf", bg: "#f3eefc" },
  { name: "Journal", color: "#e8a020", bg: "#fef8ed" },
  { name: "Projets", color: "#3a9ef4", bg: "#edf5ff" },
];

function AudioPlayer({ audio, color, onDelete }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef(null);
  return (
    <div className="audio-player-row">
      <audio ref={ref} src={audio.url} onEnded={() => setPlaying(false)} />
      <button className="play-btn" style={{ background: playing ? "#2bbf9b" : color }}
        onClick={() => { if (playing) { ref.current.pause(); setPlaying(false); } else { ref.current.play(); setPlaying(true); } }}>
        {playing ? "⏸" : "▶"}
      </button>
      <div className="waveform-bars">
        {WBARS.map((h, i) => (
          <div key={i} className="wbar" style={{ height: `${h}%`, background: color, opacity: playing ? 0.85 : 0.3 }} />
        ))}
      </div>
      <span className="memo-dur">{fmt(audio.duration || 0)}</span>
      <button className="del-audio-btn" onClick={onDelete}>✕</button>
    </div>
  );
}

function Recorder({ noteId, color, onSaved }) {
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secsRef = useRef(0);

  const stop = useCallback(() => {
    clearInterval(timerRef.current);
    if (mrRef.current && mrRef.current.state !== "inactive") mrRef.current.stop();
    setRec(false);
  }, []);

  const start = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const duration = secsRef.current;
        setSecs(0); secsRef.current = 0;

        setUploading(true);
        try {
          const saved = await api.uploadAudio(noteId, blob, duration);
          onSaved(saved);
        } catch (e) {
          setErr("Erreur upload : " + e.message);
        } finally {
          setUploading(false);
        }
      };

      mr.start();
      mrRef.current = mr;
      secsRef.current = 0; setSecs(0); setRec(true);

      timerRef.current = setInterval(() => {
        secsRef.current += 1;
        setSecs(secsRef.current);
        if (secsRef.current >= MAX_SECS) stop();
      }, 1000);
    } catch {
      setErr("Microphone inaccessible — vérifiez les permissions.");
    }
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const pct = (secs / MAX_SECS) * 100;
  const warn = secs >= MAX_SECS * 0.75;
  const C = 48, R = 20, circ = 2 * Math.PI * R;

  return (
    <div>
      <div className="rec-controls">
        <button className={`rec-btn ${rec ? "recording" : "idle"}`}
          disabled={uploading}
          onClick={rec ? stop : start}>
          <span className="rec-dot" style={{ background: rec ? "#fff" : color }} />
          {rec ? "Arrêter" : "Enregistrer"}
        </button>
        {rec && (<>
          <span className={`timer-display ${warn ? "warn" : ""}`}>{fmt(secs)}</span>
          <div className="progress-ring-wrap">
            <svg width={C} height={C}>
              <circle className="ring-bg" cx={C / 2} cy={C / 2} r={R} />
              <circle className="ring-fg" cx={C / 2} cy={C / 2} r={R}
                stroke={warn ? "#f4623a" : color}
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - pct / 100)} />
            </svg>
            <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: "0.6rem", color: warn ? "#f4623a" : color, fontWeight: 600 }}>
              {Math.round(pct)}%
            </span>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>max 2:00</span>
        </>)}

        {uploading && (
          <div className="uploading-info">
            <span className="spinner" />
            Envoi en cours…
          </div>
        )}
      </div>
      {err && <p style={{ fontSize: "0.75rem", color: "#c0392b", marginTop: 8 }}>{err}</p>}
    </div>
  );
}

function NoteEditor({ note, folders, folderMeta, onDelete, onFolderChange, onNoteChange }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [audios, setAudios] = useState([...(note.audios || [])]);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef(null);
  const titleRef = useRef(null);
  const titleValRef = useRef(note.title);
  const contentValRef = useRef(note.content);

  const persist = (t, c) => {
    titleValRef.current = t;
    contentValRef.current = c;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await api.updateNote(note._id, {
          title: titleValRef.current,
          content: contentValRef.current
        });

        onNoteChange(note._id, { 
          title: titleValRef.current, 
          content: contentValRef.current 
        });
      } catch (e) {
        console.error("Sauvegarde échouée :", e.message);
      }
    }, 300);
  };

  const handleTitle = (e) => {
    const v = e.target.value;
    setTitle(v);
    titleValRef.current = v;
    persist(v, contentValRef.current);
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  const handleContent = (e) => {
    const v = e.target.value;
    setContent(v);
    contentValRef.current = v;
    persist(titleValRef.current, v);
  };

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = titleRef.current.scrollHeight + "px";
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      api.updateNote(note._id, {
        title: titleValRef.current,
        content: contentValRef.current,
      }).catch(err => console.error("Sauvegarde démontage:", err));
    };
  }, []);

  const handleAudioSaved = (audio) => {
    setAudios((prev) => [...prev, audio]);
  };

  const handleAudioDelete = async (audioId) => {
    try {
      await api.deleteAudio(note._id, audioId);
      setAudios((prev) => prev.filter((a) => a._id !== audioId));
    } catch (e) {
      alert("Erreur suppression audio : " + e.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer cette note et ses mémos vocaux ?")) return;
    setDeleting(true);
    try { await onDelete(); }
    catch { setDeleting(false); }
  };

  return (
    <>
      <div className="editor-toolbar">
        <span className="folder-badge" style={{ background: folderMeta.bg, color: folderMeta.color }}>
          {note.folder}
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {folders.map((f) => (
            <button key={f.name} className="fpick"
              style={note.folder === f.name
                ? { background: f.color, color: "#fff", borderColor: f.color }
                : { color: f.color, borderColor: f.color + "55" }}
              onClick={() => onFolderChange(f.name)}>
              {f.name}
            </button>
          ))}
        </div>
        <button
          className="save-note-btn"
          onClick={async () => {
            await api.updateNote(note._id, { title, content });
            onNoteChange(note._id, { title, content });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}>
          Sauvegarder
        </button>
        <div className="toolbar-spacer" />
        <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{fmtDate(note.createdAt)}</span>
        <button className="delete-note-btn" onClick={handleDelete} disabled={deleting}>
          {deleting ? <span className="spinner" /> : " Supprimer"}
        </button>
      </div>
      <div className="editor-body">
        <textarea
          ref={titleRef}
          className="note-title-input"
          value={title}
          placeholder="Titre de la note…"
          onChange={handleTitle}
          rows={1}
        />
        <textarea
          className="note-content-input"
          value={content}
          placeholder="Commencez à écrire… ou enregistrez un mémo vocal ci-dessous ↓"
          onChange={handleContent}
          rows={12}
        />
      </div>

      <div className="audio-zone">
        <div className="audio-zone-title">
          <span>🎙</span> Mémos vocaux
          <span style={{ color: "var(--muted)", fontWeight: 400, letterSpacing: 0 }}>
            — max 2:00 par mémo
          </span>
        </div>

        {audios.length > 0 && (
          <div className="audio-players">
            {audios.map((a) => (
              <AudioPlayer
                key={a._id}
                audio={a}
                color={folderMeta.color}
                onDelete={() => handleAudioDelete(a._id)}
              />
            ))}
          </div>
        )}

        <Recorder
          noteId={note._id}
          color={folderMeta.color}
          onSaved={handleAudioSaved}
        />
      </div>
    </>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!username.trim() || !password.trim()) return setErr("Remplissez tous les champs");
    setErr(""); setLoading(true);
    try {
      const data = mode === "login"
        ? await api.login(username, password)
        : await api.register(username, password);
      onAuth(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo" contentEditable={false}>Notewave</div>
        <p className="auth-tagline" contentEditable={false}>Notes & mémos vocaux — tout en un</p>
        <div className="auth-tabs">
          {["login", "register"].map((m) => (
            <button key={m} className={`auth-tab ${mode === m ? "active" : ""}`}
              onClick={() => { setMode(m); setErr(""); }}>
              {m === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>
        {err && <div className="error-banner">{err}</div>}
        <div className="field">
          <label contentEditable={false}>Nom d'utilisateur</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="votre_pseudo" autoFocus />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="****" />
        </div>
        <button className="auth-submit" onClick={submit} disabled={loading}>
          {loading && <span className="spinner" style={{ borderTopColor: "#fff" }} />}
          {mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFolder, setActiveFolder] = useState("all");
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNotes();
      setNotes(data);
    } catch (e) {
      console.error("Chargement notes :", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAuth = (data) => {
    setSession(data);
  };

  useEffect(() => {
    if (session) loadNotes();
  }, [session, loadNotes]);

  const newNote = async () => {
    const folder = activeFolder === "all" ? folders[0].name : activeFolder;
    setCreating(true);
    try {
      const note = await api.createNote(folder);
      setNotes((prev) => [note, ...prev]);
      setActiveNoteId(note._id);
    } catch (e) {
      alert("Erreur création : " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteNote = async (id) => {
    await api.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n._id !== id));
    setActiveNoteId(null);
  };

  const changeFolderNote = async (id, folder) => {
    await api.updateNote(id, { folder });
    setNotes((prev) => prev.map((n) => n._id === id ? { ...n, folder } : n));
  };

  const updateNoteInList = (id, updates) => {
    setNotes((prev) => prev.map((n) => n._id === id ? { ...n, ...updates } : n));
  };

  const handleLogout = () => {
    api.logout();
    setSession(null);
    setNotes([]);
    setActiveNoteId(null);
  };

  const addFolder = () => {
    if (!newFolderName.trim()) return;
    const palette = ["#f4623a", "#2bbf9b", "#7c5cbf", "#e8a020", "#3a9ef4", "#e85c8a"];
    const color = palette[folders.length % palette.length];
    setFolders((f) => [...f, { name: newFolderName.trim(), color, bg: "#f7f4ef" }]);
    setNewFolderName("");
  };

  const deleteFolder = (folderName) => {
    setFolders(f => f.filter(x => x.name !== folderName));
    if (activeFolder === folderName) setActiveFolder('all');
  };

  const activeNote = notes.find((n) => n._id === activeNoteId) || null;
  const folderMeta = folders.find((f) => f.name === activeNote?.folder) || { color: "#9b9488", bg: "#f7f4ef" };
  const filteredNotes = activeFolder === "all" ? notes : notes.filter((n) => n.folder === activeFolder);
  const folderCounts = folders.reduce((acc, f) => { acc[f.name] = notes.filter((n) => n.folder === f.name).length; return acc; }, {});

  if (!session) return <AuthScreen onAuth={handleAuth} />;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-name">Notewave</div>
          <div className="brand-sub">voice notepad</div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Dossiers</div>
          <div className={`folder-item ${activeFolder === "all" ? "active" : ""}`}
            onClick={() => setActiveFolder("all")}>
            <span style={{ fontSize: "1rem" }}>📚</span>
            <span className="folder-name">Toutes les notes</span>
            <span className="folder-count">{notes.length}</span>
          </div>
          {folders.map((f) => (
            <div key={f.name}
              className={`folder-item ${activeFolder === f.name ? "active" : ""}`}
              onClick={() => setActiveFolder(f.name)}>
              <span className="folder-dot" style={{ background: f.color }} />
              <span className="folder-name">{f.name}</span>
              <span className="folder-count">{folderCounts[f.name] || 0}</span>
              {!['Personnel', 'Travail', 'Idées', 'Journal', 'Projets'].includes(f.name) && (
                <button
                  className="delete-folder-btn"
                  onClick={e => { e.stopPropagation(); deleteFolder(f.name); }}
                  title="Supprimer ce dossier">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="add-folder-zone">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Nouveau dossier…"
              className="add-folder-input"
              onKeyDown={e => e.key === 'Enter' && addFolder()}
            />
            <button onClick={addFolder} className="add-folder-btn">+</button>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="user-card" onClick={handleLogout} title="Se déconnecter">
            <div className="avatar">{session.username[0].toUpperCase()}</div>
            <div>
              <div className="user-name">{session.username}</div>
              <div className="logout-hint">Cliquer pour se déconnecter</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="notes-panel">
        <div className="panel-header">
          <div className="panel-title">
            {activeFolder === "all" ? "Toutes les notes" : activeFolder}
          </div>
          <button className="new-note-btn" onClick={newNote} disabled={creating || loading}>
            {creating
              ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: "#fff" }} /> Création…</>
              : "＋ Nouvelle note"}
          </button>
        </div>

        <div className="notes-list">
          {loading && (
            <div className="loading-screen">
              <span className="spinner" />
              <span>Chargement…</span>
            </div>
          )}
          {!loading && filteredNotes.length === 0 && (
            <div className="empty-notes">
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📝</div>
              <div>Aucune note ici</div>
              <div style={{ fontSize: "0.72rem", marginTop: 4 }}>Créez votre première note</div>
            </div>
          )}
          {!loading && filteredNotes.map((n) => {
            const fm = folders.find((f) => f.name === n.folder) || { color: "#9b9488", bg: "#f7f4ef" };
            return (
              <div key={n._id}
                className={`note-item ${n._id === activeNoteId ? "active" : ""}`}
                onClick={() => setActiveNoteId(n._id)}>
                <div className="note-item-header">
                  <span className="note-folder-tag" style={{ background: fm.bg, color: fm.color }}>{n.folder}</span>
                  {n.audios?.length > 0 && <span style={{ fontSize: "0.7rem" }}>🎙 {n.audios.length}</span>}
                </div>
                <div className="note-item-title">{n.title || "Sans titre"}</div>
                <div className="note-item-preview">{n.content || "Pas de contenu"}</div>
                <div className="note-item-date">{fmtDate(n.createdAt)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="editor-panel">
        {!activeNote
          ? <div className="no-note-selected">
              <div className="no-note-icon">🎙</div>
              <div className="no-note-text">Sélectionnez ou créez une note</div>
            </div>
          : <NoteEditor
              key={activeNote._id}
              note={activeNote}
              folders={folders}
              folderMeta={folderMeta}
              onDelete={() => deleteNote(activeNote._id)}
              onFolderChange={(folder) => changeFolderNote(activeNote._id, folder)}
              onNoteChange={updateNoteInList}
            />
        }
      </div>
    </div>
  );
}