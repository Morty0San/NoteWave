import { useState } from "react";
import { uploadAudio } from "../../api/api";
import { useApp } from "../../context/AppContext";
import "./Recorder.css";

function Recorder({ noteId }) {
  const [recording, setRecording] = useState(false);
  const { loadNotes } = useApp();

  let recorder;
  let chunks = [];
  let startTime;

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    recorder = new MediaRecorder(stream);
    recorder.start();

    startTime = Date.now();
    setRecording(true);

    recorder.ondataavailable = (e) => chunks.push(e.data);

    recorder.onstop = async () => {
      const duration = (Date.now() - startTime) / 1000;

      if (duration > 120) {
        alert("Max 2 minutes !");
        return;
      }

      const blob = new Blob(chunks, { type: "audio/webm" });

      await uploadAudio(noteId, blob, duration);

      setRecording(false);
      loadNotes();
    };

    setTimeout(() => recorder.stop(), 120000);
  };

  return (
    <button onClick={start} className="record-btn">
      {recording ? " En cours..." : "Enregistrer"}
    </button>
  );
}

export default Recorder;