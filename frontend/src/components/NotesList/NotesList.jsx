import { useApp } from "../../context/AppContext";
import "./NotesList.css";

function NotesList() {
  const { notes, activeNoteId, setActiveNoteId } = useApp();

  return (
    <div className="notes-list">
      {notes.map(note => (
        <div
          key={note._id}
          className={`note-item ${activeNoteId === note._id ? 'active' : ''}`}
          onClick={() => setActiveNoteId(note._id)}
        >
          <h4>{note.title || "Sans titre"}</h4>
          <p>{note.content?.substring(0, 50) || "Aucun contenu"}</p>
        </div>
      ))}
    </div>
  );
}

export default NotesList;