import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "../firebaseConfig";

/*
 * Each node IP has one document, ipIndex/{uid}_{ip}, that names the node holding it.
 * firestore.rules only accept a node with a new IP when that document names the node,
 * and the document can't be overwritten, so two saves of the same IP can't both succeed,
 * even from two tabs at once. Transactions read the claim first, then write.
 */

export const ipIndexRef = (uid, ip) => doc(db, "ipIndex", `${uid}_${ip}`);

/** Throws a readable error when `ip` is already claimed by a node other than `nodeId`. */
export function assertIpFree(snap, ip, nodeId) {
  if (snap.exists() && snap.data().nodeRef !== nodeId) {
    throw new Error(`${ip} is already recorded for another node.`);
  }
}

/** Writes the claim inside a transaction; call after `assertIpFree` on the same snapshot. */
export function claimIp(transaction, snap, uid, ip, nodeId) {
  if (!snap.exists()) transaction.set(snap.ref, { userId: uid, ip, nodeRef: nodeId });
}

/** Releases a claim inside a transaction, only when this node holds it. */
export function releaseIp(transaction, snap, nodeId) {
  if (snap.exists() && snap.data().nodeRef === nodeId) transaction.delete(snap.ref);
}

/**
 * Brings the index in line with the saved nodes: claims IPs for nodes saved before the index
 * existed and removes claims no node holds any more. Where older records already share an IP,
 * the first node by ID keeps the claim and the others stay flagged as duplicates on the
 * Network page until one is changed.
 */
export async function syncIpIndex(uid, nodes) {
  const snap = await getDocs(query(collection(db, "ipIndex"), where("userId", "==", uid)));
  const claims = new Map(snap.docs.map((item) => [item.data().ip, { ref: item.ref, nodeRef: item.data().nodeRef }]));
  const holds = (nodeId, ip) => nodes.some((n) => n.id === nodeId && n.ipAddress === ip);

  // Stale claims go first, in their own batches, so re-claiming an IP stays a create.
  const removals = [...claims]
    .filter(([ip, claim]) => !holds(claim.nodeRef, ip))
    .map(([ip, claim]) => { claims.delete(ip); return (batch) => batch.delete(claim.ref); });

  const holders = new Map();
  [...nodes]
    .filter((n) => n.ipAddress && !claims.has(n.ipAddress))
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((n) => { if (!holders.has(n.ipAddress)) holders.set(n.ipAddress, n.id); });
  const additions = [...holders]
    .map(([ip, nodeId]) => (batch) => batch.set(ipIndexRef(uid, ip), { userId: uid, ip, nodeRef: nodeId }));

  for (const group of [removals, additions]) {
    for (let offset = 0; offset < group.length; offset += 400) {
      const batch = writeBatch(db);
      group.slice(offset, offset + 400).forEach((write) => write(batch));
      await batch.commit();
    }
  }
  return removals.length + additions.length;
}
