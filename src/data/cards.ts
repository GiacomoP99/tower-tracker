export type CardRarity = 'common' | 'rare' | 'epic'

export type TowerCard = {
  id: string
  name: string
  rarity: CardRarity
  /** Official-looking art hosted by Tower Hub (fan site). Falls back in UI if blocked. */
  imageUrl: string
}

const CARD_IMAGE_BASE = 'https://www.tower-hub.com/cards-full'

function card(id: string, name: string, rarity: CardRarity): TowerCard {
  return {
    id,
    name,
    rarity,
    imageUrl: `${CARD_IMAGE_BASE}/${id}.png`,
  }
}

/** All 31 cards from The Tower, ordered common → rare → epic. */
export const TOWER_CARDS: TowerCard[] = [
  card('damage', 'Damage', 'common'),
  card('attack-speed', 'Attack Speed', 'common'),
  card('health', 'Health', 'common'),
  card('health-regen', 'Health Regen', 'common'),
  card('range', 'Range', 'common'),
  card('cash', 'Cash', 'common'),
  card('coins', 'Coins', 'common'),
  card('slow-aura', 'Slow Aura', 'common'),
  card('critical-chance', 'Critical Chance', 'common'),
  card('enemy-balance', 'Enemy Balance', 'common'),
  card('extra-defense', 'Extra Defense', 'common'),
  card('fortress', 'Fortress', 'common'),
  card('free-upgrades', 'Free Upgrades', 'rare'),
  card('extra-orb', 'Extra Orb', 'rare'),
  card('plasma-cannon', 'Plasma Cannon', 'rare'),
  card('critical-coin', 'Critical Coin', 'rare'),
  card('wave-skip', 'Wave Skip', 'rare'),
  card('intro-sprint', 'Intro Sprint', 'rare'),
  card('land-mine-stun', 'Land Mine Stun', 'rare'),
  card('recovery-package-chance', 'Recovery Package Chance', 'rare'),
  card('death-ray', 'Death Ray', 'epic'),
  card('energy-net', 'Energy Net', 'epic'),
  card('super-tower', 'Super Tower', 'epic'),
  card('second-wind', 'Second Wind', 'epic'),
  card('demon-mode', 'Demon Mode', 'epic'),
  card('energy-shield', 'Energy Shield', 'epic'),
  card('wave-accelerator', 'Wave Accelerator', 'epic'),
  card('berserker', 'Berserker', 'epic'),
  card('ultimate-crit', 'Ultimate Crit', 'epic'),
  card('nuke', 'Nuke', 'epic'),
  card('area-of-effect', 'Area of Effect', 'epic'),
]

export const MAX_CARD_STARS = 7

export const RARITY_LABEL: Record<CardRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
}

export function getCardById(id: string): TowerCard | undefined {
  return TOWER_CARDS.find((c) => c.id === id)
}
