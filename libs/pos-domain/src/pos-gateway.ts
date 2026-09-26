import { buildCatalogSnapshot, type CatalogSnapshot, type CatalogSource } from './catalog.js';

export type SavedPosOrder = {
  id: string;
  [key: string]: unknown;
};

export type SaveInstoreOrderInput = {
  orderId: string | null;
  order: Record<string, unknown>;
  items: unknown[];
};

export type PosGateway = {
  loadCatalog(): Promise<CatalogSource>;
  saveOrder(input: SaveInstoreOrderInput): Promise<SavedPosOrder>;
};

export async function loadCompleteCatalog(gateway: PosGateway): Promise<CatalogSnapshot> {
  return buildCatalogSnapshot(await gateway.loadCatalog());
}

export async function saveInstoreOrder(
  gateway: PosGateway,
  input: SaveInstoreOrderInput,
): Promise<SavedPosOrder> {
  return gateway.saveOrder(input);
}
