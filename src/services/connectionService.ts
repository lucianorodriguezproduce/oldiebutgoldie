import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, runTransaction } from "firebase/firestore";
import { generateConnectionId } from "@/types/connection";
import type { Connection, ConnectionStatus } from "@/types/connection";
import type { DbUser } from "@/types/user";

/**
 * Ensures user has username before initiating social action
 */
export const requireSocialIdentity = (user?: DbUser | null) => {
    if (!user || (!user.username)) {
        throw new Error("SOCIAL_IDENTITY_REQUIRED");
    }
};

/**
 * Initiates a connection request
 */
export const requestConnection = async (requester: DbUser, receiverId: string) => {
    requireSocialIdentity(requester);

    const connectionId = generateConnectionId(requester.uid, receiverId);
    const docRef = doc(db, "connections", connectionId);

    await runTransaction(db, async (transaction) => {
        const connectionDoc = await transaction.get(docRef);

        if (connectionDoc.exists()) {
            const data = connectionDoc.data() as Connection;
            if (data.status === "pending") throw new Error("Connection already pending.");
            if (data.status === "accepted") throw new Error("Already connected.");
            if (data.status === "blocked") throw new Error("Connection blocked.");
        }

        const newConnection: Connection = {
            id: connectionId,
            requesterId: requester.uid,
            receiverId,
            status: "pending",
            timestamp: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        transaction.set(docRef, newConnection);
    });
};

/**
 * Accepts a pending connection request
 */
export const acceptConnection = async (userId: string, targetId: string) => {
    const connectionId = generateConnectionId(userId, targetId);
    const docRef = doc(db, "connections", connectionId);

    await updateDoc(docRef, {
        status: "accepted",
        updatedAt: serverTimestamp()
    });
};

/**
 * Rejects or Cancels a pending request, or disconnects an accepted friendship
 */
export const breakConnection = async (userId: string, targetId: string) => {
    const connectionId = generateConnectionId(userId, targetId);
    const docRef = doc(db, "connections", connectionId);

    // Technically we can just delete the document to remove the connection
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(docRef);
};

/**
 * Fetches the connection status between two users
 */
export const getConnectionStatus = async (uid1: string, uid2: string): Promise<ConnectionStatus | null> => {
    if (!uid1 || !uid2) return null;
    const connectionId = generateConnectionId(uid1, uid2);
    const docSnap = await getDoc(doc(db, "connections", connectionId));

    if (docSnap.exists()) {
        return (docSnap.data() as Connection).status;
    }
    return null;
};
