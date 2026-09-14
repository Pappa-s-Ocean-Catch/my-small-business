"use client";

import { AdminGuard } from "@/components/AdminGuard";
import { QrCodeGenerator } from "@/components/QrCodeGenerator";

export default function AdminQrPage() {
    return (
        <AdminGuard>
            <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 p-4">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin / QR</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Generate QR codes for shop signage and printing.</p>
                    </div>
                    <QrCodeGenerator />
                </div>
            </div>
        </AdminGuard>
    );
}
