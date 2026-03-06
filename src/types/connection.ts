import { Timestamp } from "firebase/firestore";

export type ConnectionStatus = "pending" | "accepted" | "blocked";

export interface Connection {
    id: string; // Lexicographical combo: uidA_uidB
    requesterId: string; // Who initiated it
    receiverId: string;
    status: ConnectionStatus;
    timestamp: Timestamp | any; // Any allows serverTimestamp()
    updatedAt: Timestamp | any;
}

export interface ConnectionUser {
    uid: string;
    username: string;
    display_name: string;
    avatarUrl?: string;
}

// Helper to reliably generate the compound ID
export const generateConnectionId = (uid1: string, uid2: string): string => {
    return [uid1, uid2].sort().join("_");
};
