export type EscPosPrinterAddress = {
  host: string;
  port?: number;
};

export type EscPosProbeRequest = EscPosPrinterAddress & {
  timeoutMs?: number;
};

export type EscPosProbeResult = {
  host: string;
  port: number;
  reachable: boolean;
  latencyMs: number;
  error?: string;
};

export type EscPosDiscoveryRequest = {
  subnet: string;
  hostRange?: {
    start: number;
    end: number;
  };
  port?: number;
  timeoutMs?: number;
  concurrency?: number;
};

export type EscPosDiscoveredPrinter = EscPosProbeResult & {
  reachable: true;
};

export type EscPosPrintBytesRequest = EscPosPrinterAddress & {
  data: Uint8Array;
  timeoutMs?: number;
};

export type EscPosAlign = "left" | "center" | "right";
export type EscPosFont = "A" | "B";

export type EscPosTextStyle = {
  align?: EscPosAlign;
  bold?: boolean;
  underline?: boolean;
  invert?: boolean;
  font?: EscPosFont;
  widthScale?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  heightScale?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
};

export type EscPosRasterImage = {
  kind: "raster";
  width: number;
  height: number;
  data: Uint8Array;
  algorithm?: "bitImage24";
  align?: EscPosAlign;
};

export type EscPosDocumentNode =
  | {
      type: "text";
      text: string;
      style?: EscPosTextStyle;
      newline?: boolean;
    }
  | {
      type: "feed";
      lines?: number;
    }
  | {
      type: "cut";
      partial?: boolean;
    }
  | {
      type: "image";
      image: EscPosRasterImage;
    }
  | {
      type: "raw";
      data: Uint8Array;
    };

export type EscPosDocument = {
  initialize?: boolean;
  nodes: EscPosDocumentNode[];
};

export type EscPosPrintTextRequest = EscPosPrinterAddress & {
  lines: string[];
  timeoutMs?: number;
  cut?: boolean;
  initialize?: boolean;
  style?: EscPosTextStyle;
};

export type EscPosPrintDocumentRequest = EscPosPrinterAddress & {
  document: EscPosDocument;
  timeoutMs?: number;
};

export type EscPosOpenSessionRequest = EscPosPrinterAddress & {
  timeoutMs?: number;
  initialize?: boolean;
};

export type EscPosPrintSession = {
  addText(text: string, style?: EscPosTextStyle, options?: { newline?: boolean }): EscPosPrintSession;
  addLine(text: string, style?: EscPosTextStyle): EscPosPrintSession;
  addFeed(lines?: number): EscPosPrintSession;
  addCut(partial?: boolean): EscPosPrintSession;
  addImage(image: EscPosRasterImage): EscPosPrintSession;
  addRaw(data: Uint8Array): EscPosPrintSession;
  reset(): EscPosPrintSession;
  toDocument(): EscPosDocument;
  toBytes(): Uint8Array;
  print(): Promise<void>;
  close(): Promise<void>;
};

export type EscPosPrinterClient = {
  probe(request: EscPosProbeRequest): Promise<EscPosProbeResult>;
  discoverNetworkPrinters(request: EscPosDiscoveryRequest): Promise<EscPosDiscoveredPrinter[]>;
  printBytes(request: EscPosPrintBytesRequest): Promise<void>;
  printText(request: EscPosPrintTextRequest): Promise<void>;
  printDocument(request: EscPosPrintDocumentRequest): Promise<void>;
  openSession(request: EscPosOpenSessionRequest): EscPosPrintSession;
};

export type TcpConnector = {
  write(host: string, port: number, data: Uint8Array, timeoutMs: number): Promise<void>;
  probe(host: string, port: number, timeoutMs: number): Promise<EscPosProbeResult>;
};
