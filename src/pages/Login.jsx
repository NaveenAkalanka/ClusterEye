import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { Link, useNavigate } from "react-router-dom";
import { Envelope, LockKey, CircleNotch, Warning } from "@phosphor-icons/react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      // onLogin is handled by App.jsx auth listener mostly, but we can call it if needed. 
      // Actually App.jsx passes onLogin/setUser. 
      onLogin(user);
    } catch (err) {
      console.error(err);
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060906] flex items-center justify-center p-4">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#69639E]/10 to-transparent pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[400px] bg-[#0D100D] border border-white/5 p-8 rounded-3xl shadow-2xl relative z-10 animate-fadeInUp">

        {/* Logo Area */}
        <div className="flex flex-col items-center mb-10">
          <img src="/ClusterEye.svg" alt="ClusterEye" className="w-16 h-16 mb-4 drop-shadow-[0_0_15px_rgba(105,99,158,0.5)]" />
          <h1 className="text-3xl font-bold text-white tracking-wide">Welcome Back</h1>
          <p className="text-white/40 text-sm mt-2">Log in to check your cluster status</p>
        </div>

        <form onSubmit={submit} className="space-y-4">

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-3 rounded-xl flex items-center gap-2">
              <Warning size={18} weight="fill" />
              {error}
            </div>
          )}

          <div className="relative group">
            <Envelope size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#A8C9AD] transition-colors" />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 bg-[#161D22] border border-white/5 rounded-xl px-4 pl-11 text-white placeholder:text-white/20 outline-none focus:border-[#A8C9AD]/50 focus:bg-[#161D22]/80 transition-all font-medium"
            />
          </div>

          <div className="relative group">
            <LockKey size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#A8C9AD] transition-colors" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 bg-[#161D22] border border-white/5 rounded-xl px-4 pl-11 text-white placeholder:text-white/20 outline-none focus:border-[#A8C9AD]/50 focus:bg-[#161D22]/80 transition-all font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-[#69639E] to-[#A8C9AD] hover:opacity-90 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(105,99,158,0.3)] hover:shadow-[0_0_30px_rgba(168,201,173,0.4)] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {loading ? <CircleNotch size={20} className="animate-spin" /> : "Log In"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-white/40 text-sm">
            Don't have an account?{" "}
            <Link to="/signup" className="text-[#A8C9AD] hover:text-[#69639E] font-semibold transition-colors">
              Sign Up
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
