export class EscPosPrinterError extends Error {
    constructor(message) {
        super(message);
        this.name = "EscPosPrinterError";
    }
}
export class EscPosValidationError extends EscPosPrinterError {
    constructor(message) {
        super(message);
        this.name = "EscPosValidationError";
    }
}
