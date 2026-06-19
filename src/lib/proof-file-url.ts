import type { ProofFile } from "@/lib/mock-data";

function isBlobStorageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "blob.vercel-storage.com" || url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function getProofFileUrl(proofFile?: ProofFile, origin = "") {
  if (!proofFile?.fileUrl) return "";

  if (proofFile.fileUrl.startsWith("/api/proof-files")) {
    return `${origin}${proofFile.fileUrl}`;
  }

  if (proofFile.fileUrl.startsWith("/uploads/")) {
    return `${origin}${proofFile.fileUrl}`;
  }

  if (isBlobStorageUrl(proofFile.fileUrl)) {
    const params = new URLSearchParams({
      url: proofFile.fileUrl,
      name: proofFile.fileName,
    });
    return `${origin}/api/proof-files?${params.toString()}`;
  }

  return proofFile.fileUrl;
}
