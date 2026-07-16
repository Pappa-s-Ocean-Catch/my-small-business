export class EscPosPrinterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EscPosPrinterError";
  }
}

export class EscPosValidationError extends EscPosPrinterError {
  constructor(message: string) {
    super(message);
    this.name = "EscPosValidationError";
  }
}
