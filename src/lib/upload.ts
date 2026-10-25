import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 6;
export const ACCEPTED_UPLOAD =
  "image/*,video/*,audio/*,application/pdf,text/plain,text/markdown,application/json,.zip,.csv";

export interface PendingAttachment {
  storageId: Id<"_storage">;
  name: string;
  size: number;
  mimeType: string;
}

/**
 * Files go straight to object storage through a short-lived signed URL, so
 * the browser never streams file contents through the database.
 */
export function useUploadFile() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  return useCallback(
    async (file: File): Promise<PendingAttachment> => {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          `"${file.name}" is larger than the 10 MB upload limit.`,
        );
      }
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) {
        throw new Error(`Upload failed (${response.status}). Try again.`);
      }
      const { storageId } = (await response.json()) as { storageId: string };
      return {
        storageId: storageId as Id<"_storage">,
        name: file.name.slice(0, 120),
        size: file.size,
        mimeType: file.type || "application/octet-stream",
      };
    },
    [generateUploadUrl],
  );
}
