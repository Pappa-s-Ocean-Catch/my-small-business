"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { saveAs } from "file-saver";

type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

function normalizeQrValue(input: string): string {
    const raw = input.trim();
    if (!raw) return "https://pappasfishnchips.com.au/";

    // If it already looks like a URI scheme (https:, http:, tel:, mailto:, etc), keep as-is.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;

    // Common admin convenience: allow entering domains/paths without scheme.
    return `https://${raw}`;
}

function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
    return await new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
    });
}

export function QrCodeGenerator() {
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const [inputUrl, setInputUrl] = useState<string>("https://");
    const [includeLogo, setIncludeLogo] = useState(true);
    const [sizePx, setSizePx] = useState<number>(1024);
    const [margin, setMargin] = useState<number>(2);
    const [errorCorrection, setErrorCorrection] = useState<ErrorCorrectionLevel>("H");
    const [filename, setFilename] = useState<string>("qr-code");
    const [status, setStatus] = useState<string | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);

    const value = useMemo(() => normalizeQrValue(inputUrl), [inputUrl]);

    const renderToCanvas = async (canvas: HTMLCanvasElement, targetSizePx: number) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not supported");

        canvas.width = targetSizePx;
        canvas.height = targetSizePx;

        await QRCode.toCanvas(canvas, value, {
            width: targetSizePx,
            margin,
            errorCorrectionLevel: errorCorrection,
            color: {
                dark: "#000000",
                light: "#FFFFFF",
            },
        });

        if (!includeLogo) return;

        const logo = await loadImage("/logo.png");

        const logoSize = Math.floor(targetSizePx * 0.22);
        const padding = Math.max(8, Math.floor(targetSizePx * 0.02));
        const bgSize = logoSize + padding * 2;
        const x = Math.floor((targetSizePx - bgSize) / 2);
        const y = Math.floor((targetSizePx - bgSize) / 2);
        const r = Math.floor(bgSize * 0.12);

        ctx.save();
        ctx.fillStyle = "#FFFFFF";
        drawRoundedRect(ctx, x, y, bgSize, bgSize, r);
        ctx.fill();
        ctx.restore();

        ctx.drawImage(logo, x + padding, y + padding, logoSize, logoSize);
    };

    useEffect(() => {
        const run = async () => {
            setRenderError(null);
            setStatus(null);

            const canvas = previewCanvasRef.current;
            if (!canvas) return;

            if (!value) {
                // Clear canvas when empty
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext("2d");
                ctx?.clearRect(0, 0, 1, 1);
                return;
            }

            try {
                // Keep preview fixed-size so it never breaks layout.
                await renderToCanvas(canvas, 320);

                setStatus("Ready");
            } catch (e) {
                console.error("[QrCodeGenerator] render error", e);
                setRenderError("Failed to generate QR code. Please check the URL and try again.");
            }
        };

        void run();
    }, [value, includeLogo, margin, errorCorrection]);

    const downloadPng = async () => {
        setStatus(null);
        setRenderError(null);

        if (!value) {
            setRenderError("Enter a URL first.");
            return;
        }

        try {
            const canvas = document.createElement("canvas");
            await renderToCanvas(canvas, sizePx);

            canvas.toBlob((blob) => {
                if (!blob) {
                    setRenderError("Could not create PNG.");
                    return;
                }
                const safeName = (filename || "qr-code").trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
                saveAs(blob, `${safeName}.png`);
                setStatus("Downloaded");
            }, "image/png");
        } catch (e) {
            console.error("[QrCodeGenerator] download error", e);
            setRenderError("Failed to download PNG.");
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-white dark:bg-neutral-950 shadow p-5">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">QR code generator</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Paste a URL and download a print-ready PNG. Logo is pulled from <span className="font-medium">/public/logo.png</span>.
                </div>

                <div className="mt-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL</label>
                        <input
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder="https://your-shop.com/..."
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                        />
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">QR value: {value || "(empty)"}</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Download size (px)</label>
                            <select
                                value={String(sizePx)}
                                onChange={(e) => setSizePx(Number(e.target.value))}
                                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                            >
                                <option value="512">512</option>
                                <option value="768">768</option>
                                <option value="1024">1024</option>
                                <option value="1536">1536</option>
                                <option value="2048">2048</option>
                            </select>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">1024–2048 is best for printing.</div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filename</label>
                            <input
                                value={filename}
                                onChange={(e) => setFilename(e.target.value)}
                                placeholder="pappas-menu-qr"
                                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex items-center gap-2">
                            <input
                                id="includeLogo"
                                type="checkbox"
                                checked={includeLogo}
                                onChange={(e) => setIncludeLogo(e.target.checked)}
                                className="h-4 w-4"
                            />
                            <label htmlFor="includeLogo" className="text-sm text-gray-700 dark:text-gray-300">Logo in center</label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Error correction</label>
                            <select
                                value={errorCorrection}
                                onChange={(e) => setErrorCorrection(e.target.value as ErrorCorrectionLevel)}
                                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                            >
                                <option value="L">L (7%)</option>
                                <option value="M">M (15%)</option>
                                <option value="Q">Q (25%)</option>
                                <option value="H">H (30%)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quiet zone</label>
                            <select
                                value={String(margin)}
                                onChange={(e) => setMargin(Number(e.target.value))}
                                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                            >
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={downloadPng}
                            className="inline-flex items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium hover:opacity-90"
                        >
                            Download PNG
                        </button>
                        {status && <div className="text-sm text-green-700 dark:text-green-400">{status}</div>}
                        {renderError && <div className="text-sm text-red-700 dark:text-red-400">{renderError}</div>}
                    </div>
                </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-neutral-950 shadow p-5">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Preview</div>
                <div className="flex items-center justify-center">
                    <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white p-4 overflow-hidden">
                        <div className="w-[320px] h-[320px] max-w-full">
                            <canvas
                                ref={previewCanvasRef}
                                className="block w-full h-full"
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                    Tip: after downloading, print at a square size (e.g. 5cm, 7cm, 10cm).
                </div>
            </div>
        </div>
    );
}
