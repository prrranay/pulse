import { apiClient } from './api-client';
import { ApiResponse } from '../types';

export interface CloudinarySignature {
  signature: string;
  timestamp: number;
  folder: string;
  apiKey: string;
  cloudName: string;
}

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Invalid file type. Only JPG, PNG, and WEBP are supported.';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Image size exceeds 5MB limit.';
  }
  return null;
}

export async function uploadImageToCloudinary(
  file: File,
  options?: {
    onProgress?: (percent: number) => void;
    onXhrCreated?: (xhr: XMLHttpRequest) => void;
  },
): Promise<CloudinaryUploadResult> {
  const res = await apiClient.post<ApiResponse<CloudinarySignature>>('/cloudinary/signature');
  const sigData = res.data;

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    options?.onXhrCreated?.(xhr);

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options?.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText) as {
          secure_url: string;
          public_id: string;
        };
        resolve({
          secureUrl: response.secure_url,
          publicId: response.public_id,
        });
      } else {
        reject(new Error('Upload failed. Please try again.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during upload.'));
    };

    xhr.onabort = () => {
      reject(new Error('Upload cancelled.'));
    };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('signature', sigData.signature);
    formData.append('timestamp', String(sigData.timestamp));
    formData.append('folder', sigData.folder);
    formData.append('api_key', sigData.apiKey);

    xhr.send(formData);
  });
}

export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  await apiClient.post('/cloudinary/delete', { publicId });
}

