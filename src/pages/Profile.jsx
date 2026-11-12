import { useState, useEffect } from "react";
import { updateProfile, verifyBeforeUpdateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from "firebase/auth";
import { collection, query, where, getDocs, writeBatch, limit, deleteField } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { User, Envelope, LockKey, FloppyDisk, Trash, X } from "@phosphor-icons/react";
import { Field, FormAlert } from "../components/ui";
import { authErrorMessage } from "../utils/format";

export default function Profile({ user }) {
    const [name, setName] = useState(user?.displayName || "");
    const [email, setEmail] = useState(user?.email || "");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [currentPassword, setCurrentPassword] = useState(""); // For re-auth

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [reauthMode, setReauthMode] = useState(null); // 'email', 'password', 'delete'

    // Delete Confirmation
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [purgeConfirm, setPurgeConfirm] = useState(false);
    const [deleteProgress, setDeleteProgress] = useState(0);

    // Success messages clear themselves; errors stay until dismissed.
    useEffect(() => {
        if (message.type !== "success") return undefined;
        const timer = setTimeout(() => setMessage({ type: "", text: "" }), 6000);
        return () => clearTimeout(timer);
    }, [message]);

    useEffect(() => {
        if (user) {
            setName(user.displayName || "");
            setEmail(user.email || "");
        }
    }, [user]);

    const handleUpdateProfile = async () => {
        setLoading(true);
        setMessage({ type: "", text: "" });
        try {
            if (name !== (user.displayName || "")) {
                await updateProfile(user, { displayName: name });
            }
            setMessage({ type: "success", text: "Profile updated successfully." });
        } catch (error) {
            console.error(error);
            setMessage({ type: "error", text: "Could not save your profile. Check your connection and try again." });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateEmail = async () => {
        if (!currentPassword) return setReauthMode("email");

        setLoading(true);
        setMessage({ type: "", text: "" });
        try {
            await reauthenticate(currentPassword);

            await verifyBeforeUpdateEmail(user, email);
            setMessage({
                type: "success",
                text: "Verification email sent. Open the link in it to finish changing your address."
            });
            setReauthMode(null);
            setCurrentPassword("");
        } catch (error) {
            console.error(error);
            setMessage({ type: "error", text: passwordError(error, "Could not update your email. Try again in a moment.") });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (password !== confirmPassword) {
            return setMessage({ type: "error", text: "Passwords do not match." });
        }
        if (password.length < 6) {
            return setMessage({ type: "error", text: "Password must be at least 6 characters." });
        }
        if (!currentPassword) return setReauthMode("password");

        setLoading(true);
        setMessage({ type: "", text: "" });
        try {
            await reauthenticate(currentPassword);
            await updatePassword(user, password);
            setMessage({ type: "success", text: "Password updated successfully." });
            setReauthMode(null);
            setCurrentPassword("");
            setPassword("");
            setConfirmPassword("");
        } catch (error) {
            console.error(error);
            setMessage({ type: "error", text: passwordError(error, "Could not change your password. Try again in a moment.") });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== "delete") {
            return setMessage({ type: "error", text: 'Type "delete" to confirm.' });
        }
        if (!currentPassword) return setReauthMode("delete");

        setLoading(true);
        setMessage({ type: "", text: "" });
        setDeleteProgress(0);

        try {
            await reauthenticate(currentPassword);

            // Keep the Auth identity until every owned document has been removed.
            // Batches are bounded, so large accounts can be deleted and retried.
            // ipIndex goes last: rules only let an IP claim go once no node holds that IP.
            const collections = ["clusters", "nodes", "disks", "containers", "ipIndex"];
            for (const colName of collections) {
                while (true) {
                    const q = query(collection(db, colName), where("userId", "==", user.uid), limit(400));
                    const snap = await getDocs(q);
                    if (snap.empty) break;
                    const batch = writeBatch(db);
                    snap.forEach((docSnap) => batch.delete(docSnap.ref));
                    await batch.commit();
                    setDeleteProgress((count) => count + snap.size);
                }
            }

            await deleteUser(user);
            // Redirect handled by App.jsx
        } catch (error) {
            console.error(error);
            setMessage({ type: "error", text: passwordError(error, "Account deletion stopped. Some records may already be removed; you can retry safely.") });
            setLoading(false);
        }
    };

    const handlePurgePasswords = async () => {
        setLoading(true);
        setMessage({ type: "", text: "" });
        let removed = 0;
        try {
            for (const colName of ["nodes", "containers"]) {
                const snap = await getDocs(query(collection(db, colName), where("userId", "==", user.uid)));
                const legacy = snap.docs.filter((item) => Object.hasOwn(item.data(), "password"));
                for (let offset = 0; offset < legacy.length; offset += 400) {
                    const batch = writeBatch(db);
                    const group = legacy.slice(offset, offset + 400);
                    group.forEach((item) => batch.update(item.ref, { password: deleteField() }));
                    await batch.commit();
                    removed += group.length;
                }
            }
            setPurgeConfirm(false);
            setMessage({ type: "success", text: `Removed saved passwords from ${removed} legacy record(s).` });
        } catch (error) {
            console.error(error);
            setMessage({ type: "error", text: `Cleanup stopped after ${removed} record(s). Retry to remove any remaining passwords.` });
        } finally {
            setLoading(false);
        }
    };

    const passwordError = (error, fallback) => (
        ["auth/wrong-password", "auth/invalid-credential", "auth/invalid-login-credentials"].includes(error?.code)
            ? "That password is incorrect."
            : authErrorMessage(error, fallback)
    );

    const reauthenticate = async (pass) => {
        const credential = EmailAuthProvider.credential(user.email, pass);
        await reauthenticateWithCredential(user, credential);
    };

    const cancelReauth = () => {
        setReauthMode(null);
        setCurrentPassword("");
    };

    const reauthField = (labelText) => (
        <div className="rounded-xl border border-line bg-raised p-4">
            <label htmlFor="reauth-password" className="field-label">{labelText}</label>
            <input
                id="reauth-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
            />
        </div>
    );

    return (
        <div className="telemetry-settings flex-1 w-full h-full min-h-0 overflow-y-auto">
            <div className="stagger-cards mx-auto w-full max-w-6xl space-y-4 pb-4">

                {/* Header */}
                <header className="telemetry-surface rounded-2xl border p-5">
                    <h1 className="text-2xl font-semibold tracking-tight text-white">Account Settings</h1>
                    <p className="mt-0.5 text-sm text-white/70">Manage your name, sign-in details, and stored data.</p>
                </header>

                {message.text && (
                    <div className="fixed bottom-4 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg bg-surface shadow-2xl animate-scaleIn">
                        <FormAlert tone={message.type === "success" ? "success" : "error"}>
                            <div className="flex items-start justify-between gap-3">
                                <span>{message.text}</span>
                                <button type="button" onClick={() => setMessage({ type: "", text: "" })} aria-label="Dismiss message" title="Dismiss" className="-my-1 -mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/10">
                                    <X size={14} weight="bold" />
                                </button>
                            </div>
                        </FormAlert>
                    </div>
                )}

                <div className="stagger-cards grid gap-4 lg:grid-cols-2">
                {/* 1. Profile Details */}
                <section className="telemetry-surface rounded-2xl border p-5">
                    <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
                        <User size={18} className="text-accent" aria-hidden="true" />
                        Profile
                    </h2>

                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateProfile(); }} className="space-y-4">
                        <Field label="Display Name">
                            <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="input" />
                        </Field>
                        <button type="submit" disabled={loading || name === (user?.displayName || "")} className="btn btn-secondary">
                            <FloppyDisk size={18} aria-hidden="true" />
                            Save Profile
                        </button>
                    </form>
                </section>

                {/* 2. Email Address */}
                <section className="telemetry-surface rounded-2xl border p-5">
                    <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
                        <Envelope size={18} className="text-accent" aria-hidden="true" />
                        Email Address
                    </h2>

                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateEmail(); }} className="space-y-4">
                        <Field label="Email">
                            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
                        </Field>

                        {reauthMode === "email" && reauthField("Enter Your Current Password to Confirm")}

                        <div className="flex flex-wrap gap-2">
                            <button type="submit" disabled={loading || email === user?.email || (reauthMode === "email" && !currentPassword)} className="btn btn-secondary">
                                <FloppyDisk size={18} aria-hidden="true" />
                                {reauthMode === "email" ? "Confirm and Update" : "Update Email"}
                            </button>
                            {reauthMode === "email" && <button type="button" onClick={cancelReauth} className="btn btn-secondary">Cancel</button>}
                        </div>
                    </form>
                </section>

                {/* 3. Security */}
                <section className="telemetry-surface rounded-2xl border p-5 lg:col-span-2">
                    <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
                        <LockKey size={18} className="text-accent" aria-hidden="true" />
                        Password
                    </h2>

                    <form onSubmit={(e) => { e.preventDefault(); handleUpdatePassword(); }} className="max-w-3xl space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field label="New Password" hint="At least 6 characters.">
                                <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
                            </Field>
                            <Field label="Confirm New Password">
                                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" />
                            </Field>
                        </div>

                        {reauthMode === "password" && reauthField("Enter Your Current Password to Confirm")}

                        <div className="flex flex-wrap gap-2">
                            <button type="submit" disabled={loading || !password || (reauthMode === "password" && !currentPassword)} className="btn btn-secondary">
                                <FloppyDisk size={18} aria-hidden="true" />
                                {reauthMode === "password" ? "Confirm and Change" : "Change Password"}
                            </button>
                            {reauthMode === "password" && <button type="button" onClick={cancelReauth} className="btn btn-secondary">Cancel</button>}
                        </div>
                    </form>
                </section>

                <section className="telemetry-surface rounded-2xl border p-5">
                    <h2 className="mb-3 font-semibold text-white">Legacy Saved Passwords</h2>
                    <p className="mb-4 max-w-xl text-sm text-white/70">
                        ClusterEye no longer saves node or container passwords. Older records may still contain them in Firestore.
                        Remove them here after copying anything you need to a password manager. This can't be undone.
                    </p>
                    {purgeConfirm ? (
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={handlePurgePasswords} disabled={loading} className="btn btn-danger-solid">
                                {loading ? "Removing..." : "Remove Saved Passwords"}
                            </button>
                            <button type="button" onClick={() => setPurgeConfirm(false)} disabled={loading} className="btn btn-secondary">Cancel</button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => setPurgeConfirm(true)} disabled={loading} className="btn btn-secondary">
                            Remove Saved Passwords...
                        </button>
                    )}
                </section>

                {/* 4. Danger Zone */}
                <section className="telemetry-surface rounded-2xl border border-alert/30 p-5">
                    <h2 className="mb-4 flex items-center gap-2 font-semibold text-alert">
                        <Trash size={18} aria-hidden="true" />
                        Delete Account
                    </h2>

                    <div className="max-w-xl space-y-4">
                        <p className="text-sm text-white/70">
                            This permanently deletes your account and all of your clusters, nodes, disks, and containers. It can't be undone.
                        </p>

                        {reauthMode !== "delete" ? (
                            <button type="button" onClick={() => { setCurrentPassword(""); setReauthMode("delete"); }} className="btn btn-danger">
                                Delete Account...
                            </button>
                        ) : (
                            <form onSubmit={(e) => { e.preventDefault(); handleDeleteAccount(); }} className="space-y-4 rounded-xl border border-alert/30 bg-raised p-4">
                                <Field label="Current Password">
                                    <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input" />
                                </Field>
                                <Field label='Type "delete" to Confirm'>
                                    <input type="text" autoComplete="off" spellCheck={false} value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className="input" />
                                </Field>

                                <div className="flex flex-wrap gap-2">
                                    <button type="submit" disabled={loading || deleteConfirmText !== "delete" || !currentPassword} className="btn btn-danger-solid">
                                        {loading ? `Removing Data (${deleteProgress})...` : "Permanently Delete Account"}
                                    </button>
                                    <button type="button" onClick={() => { cancelReauth(); setDeleteConfirmText(""); }} disabled={loading} className="btn btn-secondary">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </section>
                </div>
            </div>
        </div>
    );
}
