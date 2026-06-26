import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getNotes } from "../api/api";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [notes, setNotes] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState("Personnel");
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [activeNote, setActiveNote] = useState(null);

 
  useEffect(() => {
    const load = async () => {
      const data = await getNotes(selectedFolder);
      setNotes(data);
    };
    load();
  }, [selectedFolder]);

  useEffect(() => {
    if (activeNoteId && notes.length > 0) {
      const note = notes.find(n => n._id === activeNoteId);
      setActiveNote(note || null);
    } else {
      setActiveNote(null);
    }
  }, [activeNoteId, notes]);

  const updateNoteInList = useCallback((noteId, updates) => {
    setNotes(prev => prev.map(n => 
      n._id === noteId ? { ...n, ...updates } : n
    ));
  }, []);

  return (
    <AppContext.Provider
      value={{
        notes,
        setNotes,
        activeNote,
        activeNoteId,
        setActiveNoteId,
        selectedFolder,
        setSelectedFolder,
        updateNoteInList
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);