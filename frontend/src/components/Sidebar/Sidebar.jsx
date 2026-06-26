import { useApp } from "../../context/AppContext";
import "./Sidebar.css";

const folders = ["Personnel", "Travail", "Idées"];

function Sidebar() {
  const { selectedFolder, setSelectedFolder } = useApp();

  return (
    <div className="sidebar">
      <h2>Dossiers</h2>

      {folders.map((f) => (
        <div
          key={f}
          className={`folder ${selectedFolder === f ? "active" : ""}`}
          onClick={() => setSelectedFolder(f)}
        >
          {f}
        </div>
      ))}
    </div>
  );
}

export default Sidebar;