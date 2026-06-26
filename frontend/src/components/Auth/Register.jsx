import { useState } from "react";
import { register } from "../../api/api";
import "./Auth.css";

function Register({ setToken }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    const data = await register(username, password);
    setToken(data.token);
  };

  return (
    <div className="auth">
      <h2>Inscription</h2>

      <input onChange={(e) => setUsername(e.target.value)} />
      <input type="password" onChange={(e) => setPassword(e.target.value)} />

      <button onClick={handleRegister}>Register</button>
    </div>
  );
}

export default Register;