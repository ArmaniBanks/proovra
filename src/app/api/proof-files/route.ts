import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import type { ProofFile } from "@/lib/mock-data";

export const runtime = "nodejs";

const acceptedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function isProductionRuntime() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

function isAllowedBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "blob.vercel-storage.com" || url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const requestUrl = new URL(req.url);
    const blobUrl = requestUrl.searchParams.get("url");
    const fileName = safeFileName(requestUrl.searchParams.get("name") || "proof-file");

    if (!blobUrl || !isAllowedBlobUrl(blobUrl)) {
      return NextResponse.json({ error: "Invalid proof file URL" }, { status: 400 });
    }

    const headers: Record<string, string> = {};
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      headers.Authorization = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
    }

    const response = await fetch(blobUrl, { headers });
    if (!response.ok || !response.body) {
      return NextResponse.json(
        { error: `Proof file is not accessible (${response.status})` },
        { status: response.status }
      );
    }

    const responseHeaders = new Headers({
      "Content-Type": response.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, max-age=300",
    });
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    return new Response(response.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Proof file download failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Proof file is required" }, { status: 400 });
    }
    if (!acceptedTypes.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload an image, PDF, or common document." },
        { status: 400 }
      );
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Proof file is empty" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Proof file must be 10MB or smaller" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileHash = `0x${createHash("sha256").update(bytes).digest("hex")}`;
    const uploadedAt = new Date();
    const storedName = `${uploadedAt.getTime()}-${fileHash.slice(2, 10)}-${safeFileName(file.name)}`;

    let fileUrl: string;
    let filePath: string;

    if (isProductionRuntime() || process.env.BLOB_READ_WRITE_TOKEN) {
      const blobPath = `proofs/${storedName}`;
      const blob = await put(blobPath, bytes, {
        access: process.env.PROOVRA_BLOB_ACCESS === "public" ? "public" : "private",
        contentType: file.type,
      });
      const params = new URLSearchParams({
        url: blob.url,
        name: file.name,
      });
      fileUrl = `/api/proof-files?${params.toString()}`;
      filePath = blob.url;
    } else {
      const relativePath = `/uploads/proofs/${storedName}`;
      const localPath = join(process.cwd(), "public", "uploads", "proofs", storedName);
      await mkdir(join(process.cwd(), "public", "uploads", "proofs"), { recursive: true });
      await writeFile(localPath, bytes);
      fileUrl = relativePath;
      filePath = localPath;
    }

    const proofFile: ProofFile = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadedAt,
      fileUrl,
      filePath,
      fileHash,
    };

    return NextResponse.json({ proofFile }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Proof file upload failed",
      },
      { status: 500 }
    );
  }
}
