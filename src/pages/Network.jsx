// src/pages/Network.jsx
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebaseConfig";

export default function Network() {
  const [uid, setUid] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) {
      setNodes([]);
      setClusters([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const qNodes = query(
      collection(db, "nodes"),
      where("userId", "==", uid),
      orderBy("node")
    );
    const qClusters = query(
      collection(db, "clusters"),
      where("userId", "==", uid),
      orderBy("cluster")
    );

    const unsubNodes = onSnapshot(
      qNodes,
      (snap) => setNodes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        console.error(e);
        setErr("Failed to load nodes.");
      }
    );

    const unsubClusters = onSnapshot(
      qClusters,
      (snap) => setClusters(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        console.error(e);
        setErr("Failed to load clusters.");
      }
    );

    setLoading(false);
    return () => {
      unsubNodes();
      unsubClusters();
    };
  }, [uid]);

  // ----------------- Validation: duplicates + invalid IP -----------------
  const ipRegex =
    /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

  const allIPs = [...nodes.map((n) => n.ipAddress), ...clusters.map((c) => c.ipAddress)];
  const duplicateIPs = allIPs.filter(
    (ip, idx) => ip && allIPs.indexOf(ip) !== idx
  );

  function isInvalidOrDuplicate(ip) {
    if (!ip) return true;
    if (!ipRegex.test(ip)) return true;
    if (duplicateIPs.includes(ip)) return true;
    return false;
  }

  return (
    <div className="text-white">
      <h2 className="text-3xl font-semibold mb-4">Network Overview</h2>

      {err && (
        <div className="mt-3 rounded-lg bg-red-600/20 text-red-200 px-3 py-2 border border-red-600/30">
          {err}
        </div>
      )}

      {loading ? (
        <div className="text-white/60">Loading…</div>
      ) : (
        <>
          {/* ---------------- Nodes Network Table ---------------- */}
          <h3 className="text-xl font-semibold mt-6 mb-2">Nodes Network</h3>
          {nodes.length === 0 ? (
            <div className="text-white/60 mb-5">No nodes found.</div>
          ) : (
            <div className="w-full overflow-auto rounded-xl border border-white/10 mb-8">
              <table className="min-w-[700px] w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left">
                    <Th>Node</Th>
                    <Th>Type</Th>
                    <Th>IP Address</Th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((r) => {
                    const invalid = isInvalidOrDuplicate(r.ipAddress);
                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-white/5 ${
                          invalid ? "bg-red-900/40 text-red-300" : ""
                        }`}
                      >
                        <Td className="font-semibold">{r.node}</Td>
                        <Td>{r.type || "—"}</Td>
                        <Td>{r.ipAddress || "—"}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ---------------- Cluster Network Table ---------------- */}
          <h3 className="text-xl font-semibold mb-2">Cluster Network</h3>
          {clusters.length === 0 ? (
            <div className="text-white/60">No clusters found.</div>
          ) : (
            <div className="w-full overflow-auto rounded-xl border border-white/10">
              <table className="min-w-[700px] w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left">
                    <Th>Cluster</Th>
                    <Th>IP Address</Th>
                  </tr>
                </thead>
                <tbody>
                  {clusters.map((c) => {
                    const invalid = isInvalidOrDuplicate(c.ipAddress);
                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-white/5 ${
                          invalid ? "bg-red-900/40 text-red-300" : ""
                        }`}
                      >
                        <Td className="font-semibold">{c.cluster}</Td>
                        <Td>{c.ipAddress || "—"}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------------- UI Bits ----------------------------- */

function Th({ children }) {
  return (
    <th className="px-4 py-3 font-medium text-white/80 border-b border-white/10">
      {children}
    </th>
  );
}
function Td({ children }) {
  return <td className="px-4 py-3 border-b border-white/5">{children}</td>;
}
