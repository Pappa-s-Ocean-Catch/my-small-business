export type DiagnosticSettings = {
    registerName: string;
    printerDebugFooter: boolean;
};

export function normalizeDiagnosticSettings(value: unknown): DiagnosticSettings {
    const settings = value && typeof value === 'object'
        ? value as Partial<DiagnosticSettings>
        : null;

    return {
        registerName: typeof settings?.registerName === 'string' ? settings.registerName.trim() : '',
        printerDebugFooter: typeof settings?.printerDebugFooter === 'boolean'
            ? settings.printerDebugFooter
            : false,
    };
}
