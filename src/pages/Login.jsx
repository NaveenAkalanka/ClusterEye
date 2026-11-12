import { useRef, useState } from "react";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth, SIGNUP_ENABLED } from "../firebaseConfig";
import { Link } from "react-router-dom";
import { Envelope, LockKey, CircleNotch } from "@phosphor-icons/react";
import { FormAlert } from "../components/ui";
import { AuthField, AuthShell, PasswordField } from "../components/AuthForm";
import { authErrorMessage, EMAIL_PATTERN } from "../utils/format";

function emailProblem(value) {
  if (!value) return "Enter your email address.";
  if (!EMAIL_PATTERN.test(value)) return "Enter an email address like name@example.com.";
  return "";
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const clearMessages = () => { setError(""); setNotice(""); };

  const submit = async (e) => {
    e.preventDefault();
    clearMessages();
    const trimmed = email.trim();
    const problems = { email: emailProblem(trimmed), password: password ? "" : "Enter your password." };
    setFieldErrors(problems);
    if (problems.email) return emailRef.current?.focus();
    if (problems.password) return passwordRef.current?.focus();

    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, trimmed, password);
      onLogin(user);
    } catch (err) {
      console.error(err);
      setError(authErrorMessage(err, "Could not log in. Try again in a moment."));
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    clearMessages();
    const trimmed = email.trim();
    const problem = trimmed ? emailProblem(trimmed) : "Enter your email address, then choose Forgot Password again.";
    setFieldErrors({ email: problem });
    if (problem) return emailRef.current?.focus();

    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
    } catch (err) {
      // An unknown address gets the same notice, so this form can't reveal which emails have accounts.
      if (err.code !== "auth/user-not-found") {
        console.error(err);
        setSendingReset(false);
        return setError(authErrorMessage(err, "Could not send the reset email. Try again in a moment."));
      }
    }
    setSendingReset(false);
    setNotice(`If ${trimmed} has an account, a password reset email is on its way.`);
  };

  return (
    <AuthShell
      pageTitle="Log In"
      title="Log In to ClusterEye"
      description="View and update your infrastructure inventory."
      footer={SIGNUP_ENABLED && (
        <>
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-accent underline-offset-4 hover:underline">Sign Up</Link>
        </>
      )}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        {notice && <FormAlert tone="success">{notice}</FormAlert>}

        <AuthField
          id="login-email"
          label="Email Address"
          icon={Envelope}
          inputRef={emailRef}
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: "" })); }}
          error={fieldErrors.email}
        />

        <PasswordField
          id="login-password"
          label="Password"
          icon={LockKey}
          inputRef={passwordRef}
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: "" })); }}
          error={fieldErrors.password}
          action={
            <button type="button" onClick={resetPassword} disabled={sendingReset} className="rounded-sm text-xs font-medium text-accent underline-offset-4 hover:underline disabled:opacity-60">
              {sendingReset ? "Sending..." : "Forgot Password?"}
            </button>
          }
        />

        <button type="submit" disabled={loading} className="btn btn-primary mt-2 h-11 w-full">
          {loading ? <><CircleNotch size={18} className="animate-spin" aria-hidden="true" /> Logging In...</> : "Log In"}
        </button>
      </form>
    </AuthShell>
  );
}
