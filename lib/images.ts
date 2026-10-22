// public/images доторх зургууд (эх сурвалж: lib/image-credits.json, /credits хуудас)
const CARGO_IMAGES: Record<string, string> = {
  COAL: "/images/cargo-coal.webp",
  IRON_ORE: "/images/cargo-ore.webp",
  CONCENTRATE: "/images/cargo-concentrate.webp",
  LIMESTONE: "/images/cargo-limestone.webp",
  GRAVEL: "/images/cargo-gravel.webp",
  CRUSHED_STONE: "/images/cargo-crushed.webp",
  SAND_05: "/images/cargo-sand05.webp",
  SAND: "/images/cargo-sand.webp",
};

export function cargoImage(cargoType: string) {
  return CARGO_IMAGES[cargoType] ?? "/images/tipper.webp";
}
