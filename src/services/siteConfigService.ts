import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from "firebase/firestore";

export interface SiteConfig {
    allow_user_friendships: boolean;
    allow_p2p_public_offers: boolean;
    p2p_global_enabled: boolean;
    logo?: {
        url: string;
        public_id?: string;
    };
}

const CONFIG_DOC_PATH = "settings/site_config";

export const siteConfigService = {
    async getConfig(): Promise<SiteConfig | null> {
        const docRef = doc(db, CONFIG_DOC_PATH);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data() as SiteConfig;
        }
        return null;
    },

    async updateConfig(changes: Partial<SiteConfig>) {
        const docRef = doc(db, CONFIG_DOC_PATH);
        await updateDoc(docRef, changes);
    },

    onSnapshotConfig(callback: (config: SiteConfig) => void) {
        return onSnapshot(doc(db, CONFIG_DOC_PATH), (snap) => {
            if (snap.exists()) {
                callback(snap.data() as SiteConfig);
            }
        });
    }
};
