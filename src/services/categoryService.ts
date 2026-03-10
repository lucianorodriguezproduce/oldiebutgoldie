import { db } from "../lib/firebase";
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    query,
    orderBy
} from "firebase/firestore";

export interface InternalCategory {
    id: string;
    name: string;
}

const COLLECTION_NAME = "internal_categories";

export const categoryService = {
    async getCategories(): Promise<InternalCategory[]> {
        const categoriesRef = collection(db, COLLECTION_NAME);
        const q = query(categoriesRef, orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));
    },

    async addCategory(name: string): Promise<string> {
        const formattedName = name.trim().toUpperCase();
        if (!formattedName) throw new Error("Category name cannot be empty");

        const categoriesRef = collection(db, COLLECTION_NAME);
        const docRef = await addDoc(categoriesRef, {
            name: formattedName,
            createdAt: new Date().toISOString()
        });

        return docRef.id;
    },

    async deleteCategory(id: string): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    }
};
