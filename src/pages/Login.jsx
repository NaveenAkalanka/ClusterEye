import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async e => {
    e.preventDefault();
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      onLogin(user);
    } catch {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950">
      <form onSubmit={submit} className="bg-gray-900 p-10 rounded-2xl shadow-lg w-96 flex flex-col gap-5">
        <h2 className="text-white text-3xl font-bold text-center">Login</h2>
        <input className="px-4 py-2 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-cyan-500" 
               placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="px-4 py-2 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
               placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded-lg font-medium">
          Login
        </button>
      </form>
    </div>
  );
}
