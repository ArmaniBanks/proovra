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

function shouldUseVercelBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function isProductionRuntime() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

export async function POST(req: Request) {
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

  if (shouldUseVercelBlob()) {
    const blobPath = `proofs/${storedName}`;
    const blob = await put(blobPath, bytes, {
      access: "public",
      contentType: file.type,
    });
    fileUrl = blob.url;
    filePath = blob.pathname;
  } else {
    if (isProductionRuntime()) {
      return NextResponse.json(
        {
          error:
            "Production proof upload storage is not configured. Set BLOB_READ_WRITE_TOKEN.",
        },
        { status: 500 }
      );
    }

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
}
