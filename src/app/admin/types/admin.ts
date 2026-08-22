export type Role = "ADMIN" | "DEV" | "NPN1_DEV" | "TESTER";

export type Rarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary"
  | "Mythic"
  | "ARCANE"
  | "NAMELESS";

export type DropDraft = {
  name: string;
  rarity: Rarity;
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
  probabilityMode: "MANUAL" | "DYNAMIC";
  createdAt: string;
  createdById: string;
  drops: Array<{
    id: string;
    name: string;
    rarity: string;
    price: number;
    probability: number;
    image: string;
  }>;
};

export const rarities: Rarity[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic",
  "ARCANE",
  "NAMELESS",
];

export const newDrop = (): DropDraft => ({
  name: "",
  rarity: "Rare",
  image: "",
  price: 100,
  probability: 0,
});
