import Sidebar from "../components/Sidebar/Sidebar";
import NotesList from "../components/NotesList/NotesList";
import NoteEditor from "../components/NoteEditor/NoteEditor";

import "./Dashboard.css";

function Dashboard() {
  return (
    <div className="dashboard">
      <Sidebar />
      <NotesList />
      <NoteEditor />
    </div>
  );
}

export default Dashboard;