import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, runTransaction, addDoc } from "firebase/firestore";
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

        // Add notification for receiver (V43.1 Standard)
        const notifRef = doc(collection(db, "notifications"));
        transaction.set(notifRef, {
            uid: receiverId,        // V43 Primary
            user_id: receiverId,    // Legacy Dual-Write
            title: "Nueva Solicitud de Conexión",
            message: `@${requester.username} quiere conectar con vos.`,
            read: false,
            timestamp: serverTimestamp(),
            type: "connection_request",
            requesterId: requester.uid,
            requester_username: requester.username
        });
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

    // Add notification for requester (V43.1 Standard)
    await addDoc(collection(db, "notifications"), {
        uid: targetId,        // V43 Primary
        user_id: targetId,    // Legacy Dual-Write
        title: "Conexión Aceptada",
        message: "Tu solicitud de conexión ha sido aceptada. Ahora podés ver su colección completa.",
        read: false,
        timestamp: serverTimestamp(),
        type: "connection_accepted",
        acceptedBy: userId
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
export const getConnectionStatus = async (uid1: string, uid2: string): Promise<Connection | null> => {
    if (!uid1 || !uid2) return null;
    const connectionId = generateConnectionId(uid1, uid2);
    const docSnap = await getDoc(doc(db, "connections", connectionId));

    if (docSnap.exists()) {
        return docSnap.data() as Connection;
    }
    return null;
};
