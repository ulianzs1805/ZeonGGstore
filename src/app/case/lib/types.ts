export type CaseItem = {
  id: string;
  name: string;
  rarity: string;
  color: string;
  image: string;
  price: number;
  chance: number;
  caseId?: string;
  caseImage?: string;
  inventoryItemId?: string;
  slotUid?: string;
  timestamp?: number;
};

export type CatalogDrop = {
  id: string;
  name: string;
  rarity: string;
  image: string;
  price: number;
  probability: number;
};

export type CatalogCase = {
  id: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  isActive: boolean;
  drops: CatalogDrop[];
};

export type RouletteAnimationRequest = {
  id: string;
  winnerIndex: number;
};
