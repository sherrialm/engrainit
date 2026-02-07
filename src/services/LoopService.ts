/**
 * LoopService - Firestore operations for loops
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    Timestamp,
    DocumentData
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Loop, LoopCategory } from '@/types';

/**
 * Convert Firestore document to Loop type
 */
function docToLoop(docData: DocumentData, id: string): Loop {
    return {
        id,
        userId: docData.userId,
        title: docData.title,
        category: docData.category,
        sourceType: docData.sourceType,
        text: docData.text,
        audioUrl: docData.audioUrl,
        duration: docData.duration,
        intervalSeconds: docData.intervalSeconds,
        createdAt: docData.createdAt?.toDate() || new Date(),
        updatedAt: docData.updatedAt?.toDate() || new Date(),
        playCount: docData.playCount || 0,
    };
}

/**
 * Get all loops for a user
 */
export async function getLoops(userId: string): Promise<Loop[]> {
    if (!db) throw new Error('Firestore not initialized');

    const loopsRef = collection(db!, 'users', userId, 'loops');
    const q = query(loopsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => docToLoop(doc.data(), doc.id));
}

/**
 * Get loops by category
 */
export async function getLoopsByCategory(userId: string, category: LoopCategory): Promise<Loop[]> {
    if (!db) throw new Error('Firestore not initialized');

    const loopsRef = collection(db!, 'users', userId, 'loops');
    const q = query(
        loopsRef,
        where('category', '==', category),
        orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => docToLoop(doc.data(), doc.id));
}

/**
 * Get a single loop
 */
export async function getLoop(userId: string, loopId: string): Promise<Loop | null> {
    if (!db) throw new Error('Firestore not initialized');

    const loopRef = doc(db!, 'users', userId, 'loops', loopId);
    const snapshot = await getDoc(loopRef);

    if (!snapshot.exists()) return null;

    return docToLoop(snapshot.data(), snapshot.id);
}

/**
 * Create a new loop
 */
export async function createLoop(
    userId: string,
    loop: Omit<Loop, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'playCount'>
): Promise<Loop> {
    if (!db) throw new Error('Firestore not initialized');

    const loopsRef = collection(db!, 'users', userId, 'loops');
    const now = Timestamp.now();

    const docRef = await addDoc(loopsRef, {
        ...loop,
        userId,
        createdAt: now,
        updatedAt: now,
        playCount: 0,
    });

    return {
        ...loop,
        id: docRef.id,
        userId,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
        playCount: 0,
    };
}

/**
 * Update a loop
 */
export async function updateLoop(
    userId: string,
    loopId: string,
    updates: Partial<Omit<Loop, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
    if (!db) throw new Error('Firestore not initialized');

    const loopRef = doc(db!, 'users', userId, 'loops', loopId);

    await updateDoc(loopRef, {
        ...updates,
        updatedAt: Timestamp.now(),
    });
}

/**
 * Delete a loop
 */
export async function deleteLoop(userId: string, loopId: string): Promise<void> {
    if (!db) throw new Error('Firestore not initialized');

    // Get the loop first to delete the audio file
    const loop = await getLoop(userId, loopId);

    if (loop && loop.audioUrl.includes('firebasestorage') && storage) {
        try {
            const audioRef = ref(storage, loop.audioUrl);
            await deleteObject(audioRef);
        } catch (e) {
            console.warn('Failed to delete audio file:', e);
        }
    }

    const loopRef = doc(db!, 'users', userId, 'loops', loopId);
    await deleteDoc(loopRef);
}

/**
 * Increment play count
 */
export async function incrementPlayCount(userId: string, loopId: string): Promise<void> {
    const loop = await getLoop(userId, loopId);
    if (!loop) return;

    await updateLoop(userId, loopId, {
        playCount: loop.playCount + 1,
    });
}

/**
 * Upload audio to Firebase Storage
 */
export async function uploadAudio(userId: string, audioBlob: Blob, filename: string): Promise<string> {
    if (!storage) throw new Error('Firebase Storage not initialized');

    const audioRef = ref(storage!, `users/${userId}/audio/${filename}`);
    await uploadBytes(audioRef, audioBlob);

    return getDownloadURL(audioRef);
}

/**
 * Upload base64 audio to Firebase Storage
 */
export async function uploadBase64Audio(userId: string, base64: string, filename: string): Promise<string> {
    // Extract the base64 data
    const base64Data = base64.split(',')[1];
    const mimeMatch = base64.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'audio/mp3';

    // Convert to blob
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    return uploadAudio(userId, blob, filename);
}
