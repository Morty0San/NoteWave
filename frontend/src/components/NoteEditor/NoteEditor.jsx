import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { updateNote, createNote } from "../../api/api";
import Recorder from "../Recorder/Recorder";
import "./NoteEditor.css";

function NoteEditor() {
  const { 
    activeNote, 
    activeNoteId, 
    setActiveNoteId, 
    selectedFolder,
    updateNoteInList 
  } = useApp();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  
  useEffect(() => {
    if (activeNote) {
      setTitle(activeNote.title || "");
      setContent(activeNote.content || "");
    } else {
      setTitle("");
      setContent("");
    }
  }, [activeNote?._id]);

  const newNote = async () => {
    const note = await createNote(selectedFolder);
    updateNoteInList(note._id, note);
    setActiveNoteId(note._id);
  };

  const handleSave = async () => {
    if (!activeNoteId) return;
    
    await updateNote(activeNoteId, { title, content });
    updateNoteInList(activeNoteId, { title, content });
  };

  if (!activeNote) {
    return (
      <div className="editor">
        <button onClick={newNote}>+ Nouvelle note</button>
      </div>
    );
  }

  return (
    <div className="editor">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleSave}
        placeholder="Titre"
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleSave}
        placeholder="Contenu"
      />

      <button onClick={handleSave}> Sauvegarder</button>

      <Recorder noteId={activeNoteId} onSaved={handleSave} />

      {activeNote.audios?.map(a => (
        <audio 
          key={a._id} 
          controls 
          src={`http://localhost:3001/uploads/${a.filename}`} 
        />
      ))}
    </div>
  );
}

export default NoteEditor;