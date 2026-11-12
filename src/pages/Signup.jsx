import { useRef, useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { Link } from "react-router-dom";
import { Envelope, LockKey, User, CircleNotch } from "@phosphor-icons/react";
import { FormAlert } from "../components/ui";
import { AuthField, AuthShell, PasswordField } from "../components/AuthForm";
import { authErrorMessage, EMAIL_PATTERN } from "../utils/format";

const MIN_PASSWORD = 6;

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refs = { name: useRef(null), email: useRef(null), password: useRef(null) };

  const edit = (key, setter) => (e) => { setter(e.target.value); setFieldErrors((f) => ({ ...f, [key]: "" })); };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const problems = {
      name: trimmedName ? "" : "Enter a display name.",
      email: !trimmedEmail ? "Enter your email address." : EMAIL_PATTERN.test(trimmedEmail) ? "" : "Enter an email address like name@example.com.",
      password: password.length >= MIN_PASSWORD ? "" : `Use at least ${MIN_PASSWORD} characters.`,
    };
    setFieldErrors(problems);
    const firstProblem = ["name", "email", "password"].find((key) => problems[key]);
    if (firstProblem) return refs[firstProblem].current?.focus();

    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      // The auth listener in App.jsx switches to the dashboard once the account exists.
      await updateProfile(user, { displayName: trimmedName });
    } catch (err) {
      console.error(err);
      setError(authErrorMessage(err, "Could not create your account. Try again in a moment."));
      setLoading(false);
    }
  };

  return (
    <AuthShell
      pageTitle="Sign Up"
      title="Create Your Account"
      description="Start keeping a record of your infrastructure."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/" className="font-semibold text-accent underline-offset-4 hover:underline">Log In</Link>
        </>
      }
    >
      <form onSubmit={handleSignup} noValidate className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}

        <AuthField
          id="signup-name"
          label="Display Name"
          icon={User}
          inputRef={refs.name}
          type="text"
          autoComplete="name"
          maxLength={100}
          value={name}
          onChange={edit("name", setName)}
          error={fieldErrors.name}
        />

        <AuthField
          id="signup-email"
          label="Email Address"
          icon={Envelope}
          inputRef={refs.email}
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          value={email}
          onChange={edit("email", setEmail)}
          error={fieldErrors.email}
        />

        <PasswordField
          id="signup-password"
          label="Password"
          icon={LockKey}
          inputRef={refs.password}
          autoComplete="new-password"
          value={password}
          onChange={edit("password", setPassword)}
          error={fieldErrors.password}
          hint={`At least ${MIN_PASSWORD} characters.`}
        />

        <button type="submit" disabled={loading} className="btn btn-primary mt-2 h-11 w-full">
          {loading ? <><CircleNotch size={18} className="animate-spin" aria-hidden="true" /> Creating Account...</> : "Sign Up"}
        </button>
      </form>
    </AuthShell>
  );
}
