import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import sharp from "sharp";

admin.initializeApp();

const db = admin.firestore();

/**
 * Protocol V106: Asset Optimization Pipeline
 * Triggered on Storage finalize. Processes images for inventory and hardware.
 */
export const processImage = functions.storage.object().onFinalize(async (object) => {
    const filePath = object.name; // e.g., inventory/VTA-2401-0001_raw.jpg
    const contentType = object.contentType; // e.g., image/jpeg

    if (!filePath || !contentType?.startsWith("image/")) {
        console.log("Not an image or no file path. Skipping.");
        return null;
    }

    const bucket = admin.storage().bucket(object.bucket);
    const fileName = path.basename(filePath);
    const folder = path.dirname(filePath); // e.g., 'inventory' or 'hardware_inventory'

    if (folder !== "inventory" && folder !== "hardware_inventory") {
        console.log(`Folder '${folder}' is not monitored. Skipping.`);
        return null;
    }

    // Parse ID from filename (e.g., VTA-2401-0001)
    const idMatch = fileName.match(/^(VTA-|EQP-)[A-Z0-9-]+/i);
    if (!idMatch) {
        console.log(`Could not parse ID from filename: ${fileName}. Skipping.`);
        return null;
    }
    const internalId = idMatch[0].toUpperCase();
    const collectionName = internalId.startsWith("VTA") ? "inventory" : "hardware_inventory";

    const tempFilePath = path.join(os.tmpdir(), fileName);
    const metadata = { contentType: "image/webp" };

    try {
        // Download original
        await bucket.file(filePath).download({ destination: tempFilePath });

        // Variants configuration
        const variants = [
            { name: "optimized_detail", width: 1200, suffix: "_detail" },
            { name: "optimized_thumb", width: 400, suffix: "_thumb" }
        ];

        const mediaUpdates: any = {
            original_raw_url: `https://storage.googleapis.com/${object.bucket}/${filePath}`
        };

        for (const variant of variants) {
            const outFileName = `${internalId}${variant.suffix}.webp`;
            const outPath = `processed/${folder}/${outFileName}`;
            const tempOutPath = path.join(os.tmpdir(), outFileName);

            await sharp(tempFilePath)
                .resize({ width: variant.width, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(tempOutPath);

            await bucket.upload(tempOutPath, {
                destination: outPath,
                metadata: metadata
            });

            // Clean up temp variant
            fs.unlinkSync(tempOutPath);

            // Store public URL (or signed URL if restricted, but usually these are public in this context)
            mediaUpdates[`${variant.suffix.slice(1)}_url`] = `https://storage.googleapis.com/${object.bucket}/${outPath}`;
        }

        // Update Firestore
        const docRef = db.collection(collectionName).doc(internalId);
        await docRef.set({
            media: {
                ...mediaUpdates,
                lastProcessed: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });

        console.log(`Successfully processed ${internalId} from ${filePath}`);

        // Clean up main temp file
        fs.unlinkSync(tempFilePath);
    } catch (error) {
        console.error(`Error processing image ${filePath}:`, error);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }

    return null;
});
