import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@my-small-business/supabase/server";
import {
  getBunnyConfigErrorMessage,
  isBunnyStorageConfigured,
  uploadToBunnyStorage,
} from "@/lib/bunny-storage";
import { isVercelBlobUrl, vercelBlobPathnameFromUrl } from "@/lib/vercel-blob-url";

const ALLOWED_TYPES = [
  "product",
  "sale_product",
  "staff",
  "supplier",
  "brand",
] as const;

const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

const MAX_BYTES = 5 * 1024 * 1024;

function isAllowedImageContentType(ct: string): boolean {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(ct);
}

function extFromContentType(ct: string): string {
  const lower = ct.split(";")[0]?.trim().toLowerCase() ?? "";
  if (lower === "image/jpeg" || lower === "image/jpg") return "jpg";
  if (lower === "image/png") return "png";
  if (lower === "image/webp") return "webp";
  return "jpg";
}

function extFromPathname(pathname: string): string | null {
  const m = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (!m) return null;
  const e = m[1].toLowerCase();
  if (e === "jpeg") return "jpg";
  if (e === "jpg" || e === "png" || e === "webp") return e;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 },
      );
    }

    const token = authHeader.split(" ")[1];
    const supabase = await createServiceRoleClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_slug")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: "Profile lookup failed" },
        { status: 500 },
      );
    }

    if (!profile || profile.role_slug !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("vercelUrl" in body) ||
      !("type" in body)
    ) {
      return NextResponse.json(
        { error: "Expected JSON body with vercelUrl and type" },
        { status: 400 },
      );
    }

    const vercelUrl = (body as { vercelUrl: unknown }).vercelUrl;
    const type = (body as { type: unknown }).type;

    if (typeof vercelUrl !== "string" || vercelUrl.length === 0) {
      return NextResponse.json({ error: "Invalid vercelUrl" }, { status: 400 });
    }

    if (
      typeof type !== "string" ||
      !ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])
    ) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (!isVercelBlobUrl(vercelUrl)) {
      return NextResponse.json(
        { error: "URL is not a Vercel Blob URL" },
        { status: 400 },
      );
    }

    if (!isBunnyStorageConfigured()) {
      return NextResponse.json(
        { error: getBunnyConfigErrorMessage() },
        { status: 500 },
      );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      return NextResponse.json(
        {
          error:
            "BLOB_READ_WRITE_TOKEN is missing. It is required to read blobs from Vercel during migration.",
        },
        { status: 500 },
      );
    }

    const blobPathname = vercelBlobPathnameFromUrl(vercelUrl);

    let blobRead: Awaited<ReturnType<typeof get>>;
    try {
      console.log("blobPathname", blobPathname);
      blobRead = await get(blobPathname, { access: "public" });
    } catch (readErr) {
      console.error("Migrate: Vercel get(pathname, private) failed:", readErr);
      const detail =
        readErr instanceof Error ? readErr.message : "Unknown error";
      return NextResponse.json(
        {
          error:
            `Could not read blob from Vercel with private access (${detail}). ` +
            "Use BLOB_READ_WRITE_TOKEN for the same store as this file, and ensure the object exists at that pathname in private storage.",
        },
        { status: 502 },
      );
    }

    if (blobRead === null) {
      return NextResponse.json(
        {
          error:
            "Vercel Blob not found for this pathname. Check the file exists in the store tied to BLOB_READ_WRITE_TOKEN.",
        },
        { status: 404 },
      );
    }

    if (blobRead.statusCode !== 200 || blobRead.stream === null) {
      return NextResponse.json(
        {
          error:
            "Vercel returned no body for this blob. Confirm private read is enabled for this object and pathname.",
        },
        { status: 502 },
      );
    }

    if (blobRead.blob.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is larger than 5MB; migrate is not allowed." },
        { status: 400 },
      );
    }

    const primaryCt =
      blobRead.blob.contentType.split(";")[0]?.trim().toLowerCase() ??
      "image/jpeg";
    if (!isAllowedImageContentType(primaryCt)) {
      return NextResponse.json(
        { error: "Blob is not a supported image type." },
        { status: 400 },
      );
    }

    const buffer = await new Response(blobRead.stream).arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is larger than 5MB; migrate is not allowed." },
        { status: 400 },
      );
    }

    let ext = extFromPathname(blobPathname);
    if (!ext) ext = extFromContentType(primaryCt);

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${type}_${timestamp}_${randomString}.${ext}`;
    const objectPath = `${type}/${filename}`;

    const bunnyUrl = await uploadToBunnyStorage(
      buffer,
      primaryCt === "image/jpg" ? "image/jpeg" : primaryCt,
      objectPath,
    );

    return NextResponse.json({
      success: true,
      url: bunnyUrl,
      filename,
    });
  } catch (error) {
    console.error("migrate-vercel-to-bunny error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Migration failed",
      },
      { status: 500 },
    );
  }
}
