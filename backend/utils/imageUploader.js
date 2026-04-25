const cloudinary = require('cloudinary').v2;

exports.uploadImageToCloudinary = async (file, folder, height, quality) => {
    try {
        const options = { folder };
        if (height) options.height = height;
        if (quality) options.quality = quality;

        // Use 'video' resource type for videos, else 'auto'
        const isVideo = file.mimetype && file.mimetype.includes('video');
        options.resource_type = isVideo ? 'video' : 'auto';

        if (isVideo) {
            console.log(`[Cloudinary] Using upload_large for video: ${file.name}`);
            return new Promise((resolve, reject) => {
                cloudinary.uploader.upload_large(
                    file.tempFilePath,
                    options,
                    (error, result) => {
                        if (error) {
                            console.error("[Cloudinary] upload_large Error:", error);
                            reject(error);
                        } else {
                            resolve(result);
                        }
                    }
                );
            });
        } else {
            return await cloudinary.uploader.upload(file.tempFilePath, options);
        }
    }
    catch (error) {
        console.error("[Cloudinary] Upload Error:", error);
        throw error;
    }
}

// Function to delete a resource from Cloudinary using its URL
exports.deleteResourceFromCloudinary = async (url) => {
    if (!url) return;

    try {
        // Extract public ID from URL
        const parts = url.split('/');
        const fileNameWithExtension = parts.pop();
        const publicIdWithoutExtension = fileNameWithExtension.split('.')[0];

        // Join the remaining parts after 'upload/' to get the full public ID
        const uploadIndex = parts.indexOf('upload');
        const folders = parts.slice(uploadIndex + 2).join('/');
        
        const publicId = folders ? `${folders}/${publicIdWithoutExtension}` : publicIdWithoutExtension;
        const resourceType = url.includes('/video/') ? 'video' : 'image';

        console.log(`[Cloudinary] Deleting ${resourceType}: ${publicId}`);
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        console.log(`[Cloudinary] Result:`, result);
        
        return result;
    } catch (error) {
        console.error(`[Cloudinary] Error deleting ${url}:`, error);
        throw error;
    }
};