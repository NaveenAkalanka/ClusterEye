import { useState, useEffect } from "react";
import { updateProfile, verifyBeforeUpdateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from "firebase/auth";
import { collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { User, Envelope, LockKey, FloppyDisk, Warning, Trash } from "@phosphor-icons/react";

export default function Profile() {
    const user = auth.currentUser;
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
            if (name !== user.displayName) {
                await updateProfile(user, { displayName: name });
            }
            setMessage({ type: "success", text: "Profile updated successfully." });
        } catch (error) {
            console.error(error);
            setMessage({ type: "error", text: "Failed to update profile." });
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
            setMessage({ type: "success", text: "Verification email sent. Please check your inbox to confirm the change." });
            setReauthMode(null);
            setCurrentPassword("");
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                setMessage({ type: "error", text: "Incorrect password." });
            } else {
                setMessage({ type: "error", text: "Failed to update email. " + error.message });
            }
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
            if (error.code === 'auth/wrong-password') {
                setMessage({ type: "error", text: "Incorrect password." });
            } else {
                setMessage({ type: "error", text: "Failed to update password. " + error.message });
            }
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
        setMessage({ type: "", text: "Deleting account and data..." });

        try {
            await reauthenticate(currentPassword);

            // Cascade Delete Data
            const collections = ["clusters", "nodes", "disks", "containers"];
            const batch = writeBatch(db);
            let hasDeletions = false;

            for (const colName of collections) {
                const q = query(collection(db, colName), where("userId", "==", user.uid));
                const snap = await getDocs(q);
                snap.forEach((docSnap) => {
                    batch.delete(doc(db, colName, docSnap.id));
                    hasDeletions = true;
                });
            }

            if (hasDeletions) {
                await batch.commit();
            }

            await deleteUser(user);
            // Redirect handled by App.jsx
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                setMessage({ type: "error", text: "Incorrect password." });
            } else {
                setMessage({ type: "error", text: "Failed to delete account. " + error.message });
                setLoading(false);
            }
        }
    };

    const reauthenticate = async (pass) => {
        const credential = EmailAuthProvider.credential(user.email, pass);
        await reauthenticateWithCredential(user, credential);
    };

    return (
        <div className="flex-1 w-full h-full min-h-0 bg-[#060906] md:bg-transparent overflow-y-auto content-scrollbar md:pb-0 pb-20">
            <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#161D22] to-[#69639E]/30 rounded-full flex items-center justify-center border border-white/10 shadow-xl">
                        <User size={32} className="text-[#A8C9AD]" weight="duotone" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Account Settings</h1>
                        <p className="text-white/40">Manage your profile and security preferences.</p>
                    </div>
                </div>

                {message.text && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 ${message.type === "success"
                        ? "bg-green-500/10 border-green-500/20 text-green-200"
                        : "bg-red-500/10 border-red-500/20 text-red-200"
                        }`}>
                        {message.type === "error" && <Warning size={20} weight="fill" />}
                        {message.text}
                    </div>
                )}

                {/* 1. Profile Details */}
                <section className="bg-[#0D100D] border border-white/5 rounded-3xl p-6 md:p-8 animate-fadeInUp" style={{ animationDelay: '0ms' }}>
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <User size={24} className="text-[#69639E]" weight="duotone" />
                        Public Profile
                    </h2>

                    <div className="space-y-6 max-w-xl">
                        <div>
                            <label className="text-white/70 text-sm font-medium mb-2 block">Display Name</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full h-12 bg-[#161D22] text-white px-4 rounded-xl border border-white/5 focus:border-[#69639E]/50 focus:bg-[#161D22]/80 outline-none transition-all pl-11"
                                    placeholder="Your Name"
                                />
                                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                            </div>
                        </div>

                        <button
                            onClick={handleUpdateProfile}
                            disabled={loading || name === user?.displayName}
                            className="px-6 py-3 bg-[#161D22] hover:bg-[#1c252b] text-white rounded-xl font-bold text-sm transition-all border border-white/5 hover:border-white/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FloppyDisk size={18} />
                            Save Profile
                        </button>
                    </div>
                </section>

                {/* 2. Email Address */}
                <section className="bg-[#0D100D] border border-white/5 rounded-3xl p-6 md:p-8 animate-fadeInUp" style={{ animationDelay: '100ms' }}>
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Envelope size={24} className="text-blue-400" weight="duotone" />
                        Email Address
                    </h2>

                    <div className="space-y-6 max-w-xl">
                        <div>
                            <label className="text-white/70 text-sm font-medium mb-2 block">Email</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full h-12 bg-[#161D22] text-white px-4 rounded-xl border border-white/5 focus:border-blue-400/50 outline-none transition-all pl-11"
                                    placeholder="your@email.com"
                                />
                                <Envelope size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                            </div>
                        </div>

                        {reauthMode === "email" && (
                            <div className="bg-[#161D22] p-4 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                                <label className="text-white/70 text-sm font-medium mb-2 block">Confirm Password to Update Email</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full h-10 bg-black/30 text-white px-3 rounded-lg border border-white/10 outline-none mb-3"
                                    placeholder="Current Password"
                                />
                            </div>
                        )}

                        <button
                            onClick={handleUpdateEmail}
                            disabled={loading || email === user?.email}
                            className="px-6 py-3 bg-[#161D22] hover:bg-[#1c252b] text-white rounded-xl font-bold text-sm transition-all border border-white/5 hover:border-white/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FloppyDisk size={18} />
                            {reauthMode === "email" ? "Confirm & Update" : "Update Email"}
                        </button>
                    </div>
                </section>

                {/* 3. Security */}
                <section className="bg-[#0D100D] border border-white/5 rounded-3xl p-6 md:p-8 animate-fadeInUp" style={{ animationDelay: '200ms' }}>
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <LockKey size={24} className="text-red-400" weight="duotone" />
                        Security
                    </h2>

                    <div className="space-y-6 max-w-xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-white/70 text-sm font-medium mb-2 block">New Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-12 bg-[#161D22] text-white px-4 rounded-xl border border-white/5 focus:border-red-400/50 outline-none transition-all"
                                    placeholder="New Password"
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm font-medium mb-2 block">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full h-12 bg-[#161D22] text-white px-4 rounded-xl border border-white/5 focus:border-red-400/50 outline-none transition-all"
                                    placeholder="Confirm New Password"
                                />
                            </div>
                        </div>

                        {reauthMode === "password" && (
                            <div className="bg-[#161D22] p-4 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                                <label className="text-white/70 text-sm font-medium mb-2 block">Confirm Current Password</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full h-10 bg-black/30 text-white px-3 rounded-lg border border-white/10 outline-none mb-3"
                                    placeholder="Current Password"
                                />
                            </div>
                        )}

                        <button
                            onClick={handleUpdatePassword}
                            disabled={loading || !password}
                            className="px-6 py-3 bg-[#161D22] hover:bg-[#1c252b] text-white rounded-xl font-bold text-sm transition-all border border-white/5 hover:border-white/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FloppyDisk size={18} />
                            {reauthMode === "password" ? "Confirm & Change" : "Change Password"}
                        </button>
                    </div>
                </section>

                {/* 4. Danger Zone */}
                <section className="bg-[#0D100D] border border-red-500/20 rounded-3xl p-6 md:p-8 animate-fadeInUp mt-8" style={{ animationDelay: '300ms' }}>
                    <h2 className="text-xl font-bold text-red-500 mb-6 flex items-center gap-2">
                        <Trash size={24} weight="duotone" />
                        Danger Zone
                    </h2>

                    <div className="space-y-4 max-w-xl">
                        <p className="text-zinc-400 text-sm">
                            Once you delete your account, there is no going back. All of your clusters, nodes, and configurations will be permanently deleted.
                        </p>

                        {!reauthMode || reauthMode !== "delete" ? (
                            <button
                                onClick={() => setReauthMode("delete")}
                                className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl font-bold text-sm transition-all border border-red-500/10 flex items-center gap-2"
                            >
                                <Trash size={18} />
                                Delete Account
                            </button>
                        ) : (
                            <div className="bg-[#161D22] p-6 rounded-xl border border-red-500/20 animate-in fade-in slide-in-from-top-2 space-y-4">
                                <div className="text-red-200 text-sm font-semibold">
                                    Are you absolutely sure?
                                </div>
                                <div>
                                    <label className="text-white/70 text-sm font-medium mb-2 block">1. Enter Current Password</label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full h-10 bg-black/30 text-white px-3 rounded-lg border border-white/10 outline-none focus:border-red-500/50"
                                        placeholder="Current Password"
                                    />
                                </div>
                                <div>
                                    <label className="text-white/70 text-sm font-medium mb-2 block">2. Type "delete" to confirm</label>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        className="w-full h-10 bg-black/30 text-white px-3 rounded-lg border border-white/10 outline-none focus:border-red-500/50"
                                        placeholder='Type "delete"'
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={loading || deleteConfirmText !== "delete" || !currentPassword}
                                        className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Yes, permanently delete
                                    </button>
                                    <button
                                        onClick={() => {
                                            setReauthMode(null);
                                            setDeleteConfirmText("");
                                            setCurrentPassword("");
                                        }}
                                        disabled={loading}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium text-sm transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
