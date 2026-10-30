import type { IllustrationKind, Palette } from './illustrations';

/**
 * DEMO catalogue — fictional products used while no real provider is
 * connected (PRODUCT_PROVIDER=demo). Every item is flagged `isDemo`, has no
 * product URL and no affiliate link, and is drawn rather than photographed.
 *
 * It intentionally includes "traps" (accessories, brand misuse, replicas,
 * out-of-stock items, duplicate listings, misleading "from" prices, items
 * that are not cheaper) so the verification filters are exercised for real.
 */
export interface DemoItem {
  id: string;
  title: string;
  categoryPath: string[];
  price: number;
  priceHigh?: number;
  /** null = unknown, 0 = free shipping. */
  shipping: number | null;
  delivery: [number, number] | null;
  rating: [number, number | null] | null;
  orders: number | null;
  attributes: Record<string, string>;
  kind: IllustrationKind;
  palette: Palette;
  availability?: 'in_stock' | 'out_of_stock';
  shipsToSpain?: boolean;
}

const P = {
  opalBrass: { main: '#F5F2EB', accent: '#C9A45C', bg: '#EEE9E0' },
  opalChrome: { main: '#F7F7F5', accent: '#AEB5BB', bg: '#ECEDEE' },
  amberBrass: { main: '#D9A15B', accent: '#B98E46', bg: '#F1E8DC' },
  whiteWarm: { main: '#FBF9F4', accent: '#D9D1C3', bg: '#EFEBE4' },
  rattan: { main: '#C99B62', accent: '#B5874F', bg: '#F2ECE3' },
  wicker: { main: '#D2AC76', accent: '#A9824F', bg: '#F3EDE4' },
  seagrass: { main: '#BFA77A', accent: '#8E7A52', bg: '#F0ECE2' },
  oak: { main: '#CFA87C', accent: '#A9825A', bg: '#F2EBE2' },
  walnut: { main: '#7D563A', accent: '#5E3F2A', bg: '#EFE7DF' },
  boucle: { main: '#F0E9DD', accent: '#8B6A4C', bg: '#EDE6DA' },
  boucleWhite: { main: '#F8F6F1', accent: '#C7A27A', bg: '#ECE8E1' },
  velvetBeige: { main: '#D9C3A5', accent: '#A88A62', bg: '#F1EBE2' },
  ceramicWhite: { main: '#F3F0EA', accent: '#CFC6B8', bg: '#E9E5DE' },
  ceramicCream: { main: '#EADFCB', accent: '#C9B79A', bg: '#F1ECE3' },
  terracotta: { main: '#C4734F', accent: '#9C5639', bg: '#F2E6DE' },
  marble: { main: '#EDEBE6', accent: '#B9B4AA', bg: '#E8E6E1' },
  black: { main: '#2E2D2A', accent: '#1F1E1C', bg: '#ECEAE6' },
  green: { main: '#7E9479', accent: '#C9A45C', bg: '#ECEFE9' },
  linen: { main: '#E3D7C3', accent: '#B49E7C', bg: '#F2EDE5' },
  paper: { main: '#FAF8F2', accent: '#3A3936', bg: '#ECEAE5' },
  grey: { main: '#B9B8B3', accent: '#7E7D78', bg: '#EDECE8' },
  brass: { main: '#F3EBDD', accent: '#C9A45C', bg: '#EFEAE2' },
  jute: { main: '#C7A878', accent: '#9E8358', bg: '#F2ECE2' },
} satisfies Record<string, Palette>;

const LIGHT = ['Home', 'Lighting'];
const MIRRORS = ['Home', 'Home Decor', 'Mirrors'];
const FURN = ['Home', 'Furniture'];
const DECOR = ['Home', 'Home Decor'];
const STORAGE = ['Home', 'Storage & Organization'];
const TEXT = ['Home', 'Home Textile'];

export const DEMO_ITEMS: DemoItem[] = [
  // ── Table lamps (mushroom) ───────────────────────────────────────────
  { id: 'lamp-01', title: 'Mushroom Table Lamp Opal Glass Shade Brass Base Bedside Lamp 36cm', categoryPath: [...LIGHT, 'Table Lamps'], price: 27.9, shipping: 0, delivery: [8, 14], rating: [4.8, 1260], orders: 3400, attributes: { color: 'White', material: 'Glass, Metal' }, kind: 'lamp-mushroom', palette: P.opalBrass },
  { id: 'lamp-02', title: 'Opal Glass Mushroom Lamp with Gold Metal Stem E14 40cm', categoryPath: [...LIGHT, 'Table Lamps'], price: 32.5, shipping: 3.99, delivery: [10, 18], rating: [4.7, 410], orders: 980, attributes: { color: 'White', material: 'Glass' }, kind: 'lamp-mushroom', palette: { ...P.opalBrass, bg: '#F1ECE4' } },
  { id: 'lamp-03', title: 'Rechargeable Mushroom Table Lamp Cordless Touch Dimmable White 30cm', categoryPath: [...LIGHT, 'Table Lamps'], price: 19.99, shipping: 0, delivery: [7, 12], rating: [4.6, 2200], orders: 8100, attributes: { color: 'White', material: 'Plastic' }, kind: 'lamp-mushroom', palette: P.whiteWarm },
  { id: 'lamp-04', title: 'Mushroom Glass Table Lamp Chrome Base Frosted White 38cm', categoryPath: [...LIGHT, 'Table Lamps'], price: 24.8, shipping: null, delivery: [12, 20], rating: [4.5, 95], orders: 310, attributes: { color: 'White', material: 'Glass' }, kind: 'lamp-mushroom', palette: P.opalChrome },
  { id: 'lamp-05', title: 'Amber Glass Mushroom Table Lamp Brass 35cm', categoryPath: [...LIGHT, 'Table Lamps'], price: 29.9, shipping: 2.5, delivery: [9, 15], rating: [4.7, 160], orders: 520, attributes: { color: 'Amber', material: 'Glass' }, kind: 'lamp-mushroom', palette: P.amberBrass },
  { id: 'lamp-06', title: 'Wavy Mushroom Table Lamp Opal White Glass Brass Stem 34cm', categoryPath: [...LIGHT, 'Table Lamps'], price: 36, shipping: 0, delivery: [10, 16], rating: [4.9, 88], orders: 240, attributes: { color: 'White', material: 'Glass' }, kind: 'lamp-wavy', palette: P.opalBrass },
  // Duplicate listing of lamp-01 by another seller (same photo).
  { id: 'lamp-07', title: 'Mushroom Table Lamp Opal Glass Shade Brass Base Bedside Lamp 36cm Seller B', categoryPath: [...LIGHT, 'Table Lamps'], price: 28.4, shipping: 0, delivery: [9, 15], rating: [4.6, 40], orders: 75, attributes: { color: 'White', material: 'Glass, Metal' }, kind: 'lamp-mushroom', palette: P.opalBrass },
  // Misleading "from" price (cheapest option is just a bulb).
  { id: 'lamp-08', title: 'Mushroom Table Lamp Opal Glass Brass Options Bulb or Lamp', categoryPath: [...LIGHT, 'Table Lamps'], price: 3.99, priceHigh: 34.99, shipping: 0, delivery: [10, 20], rating: [4.1, 30], orders: 90, attributes: { color: 'White' }, kind: 'lamp-mushroom', palette: P.opalBrass },
  { id: 'lamp-09', title: 'Replacement Opal Glass Shade for Mushroom Table Lamp', categoryPath: [...LIGHT, 'Lamp Shades'], price: 12.9, shipping: 0, delivery: [8, 14], rating: [4.5, 60], orders: 150, attributes: { color: 'White', material: 'Glass' }, kind: 'shade', palette: P.opalBrass },
  { id: 'lamp-10', title: 'E14 LED Globe Bulb Opal 2 Pack Warm White', categoryPath: [...LIGHT, 'Light Bulbs'], price: 6.5, shipping: 0, delivery: [7, 12], rating: [4.7, 3000], orders: 12000, attributes: { color: 'White' }, kind: 'bulb', palette: P.whiteWarm },
  { id: 'lamp-11', title: 'IKEA Style Mushroom Opal Glass Table Lamp', categoryPath: [...LIGHT, 'Table Lamps'], price: 22, shipping: 0, delivery: [10, 18], rating: [4.4, 70], orders: 200, attributes: { color: 'White', material: 'Glass' }, kind: 'lamp-mushroom', palette: P.opalBrass },
  { id: 'lamp-12', title: 'Panthella Replica Mushroom Lamp White', categoryPath: [...LIGHT, 'Table Lamps'], price: 45, shipping: 0, delivery: [10, 18], rating: [4.3, 50], orders: 120, attributes: { color: 'White' }, kind: 'lamp-mushroom', palette: P.whiteWarm },
  { id: 'lamp-13', title: 'Opal Glass Mushroom Table Lamp Brass Mini', categoryPath: [...LIGHT, 'Table Lamps'], price: 21, shipping: 0, delivery: [8, 14], rating: [4.6, 210], orders: 600, attributes: { color: 'White', material: 'Glass' }, kind: 'lamp-mushroom', palette: P.opalBrass, availability: 'out_of_stock' },
  { id: 'lamp-14', title: 'Mushroom Floor Lamp Opal Glass Brass 150cm', categoryPath: [...LIGHT, 'Floor Lamps'], price: 69, shipping: 0, delivery: [12, 22], rating: [4.6, 45], orders: 90, attributes: { color: 'White', material: 'Glass' }, kind: 'floor-lamp', palette: P.opalBrass },
  { id: 'lamp-15', title: 'Handmade Opal Glass Mushroom Lamp Solid Brass 40cm', categoryPath: [...LIGHT, 'Table Lamps'], price: 96, shipping: 0, delivery: [10, 16], rating: [4.9, 30], orders: 60, attributes: { color: 'White', material: 'Glass, Brass' }, kind: 'lamp-mushroom', palette: P.opalBrass },
  { id: 'lamp-16', title: 'Pleated Fabric Table Lamp Ceramic Base Beige', categoryPath: [...LIGHT, 'Table Lamps'], price: 26.9, shipping: 0, delivery: [10, 16], rating: [4.6, 330], orders: 900, attributes: { color: 'Beige', material: 'Fabric, Ceramic' }, kind: 'lamp-pleated', palette: P.linen },
  { id: 'lamp-17', title: 'Glass Globe Table Lamp Opal White Brass Base 25cm', categoryPath: [...LIGHT, 'Table Lamps'], price: 23.5, shipping: 1.99, delivery: [9, 16], rating: [4.7, 520], orders: 1500, attributes: { color: 'White', material: 'Glass' }, kind: 'lamp-globe', palette: P.opalBrass },
  { id: 'lamp-18', title: 'Ceramic Table Lamp Linen Shade Beige 45cm', categoryPath: [...LIGHT, 'Table Lamps'], price: 35, shipping: 0, delivery: [10, 18], rating: [4.6, 140], orders: 380, attributes: { color: 'Beige', material: 'Ceramic, Linen' }, kind: 'lamp-pleated', palette: P.ceramicCream },
  { id: 'lamp-19', title: 'Cone Shade Table Lamp Black Metal Minimalist 40cm', categoryPath: [...LIGHT, 'Table Lamps'], price: 21.9, shipping: 0, delivery: [8, 14], rating: [4.5, 260], orders: 700, attributes: { color: 'Black', material: 'Metal' }, kind: 'lamp-cone', palette: P.black },

  // ── Pendant lamps ────────────────────────────────────────────────────
  { id: 'pend-01', title: 'Rattan Pendant Light Natural Woven Globe 45cm', categoryPath: [...LIGHT, 'Pendant Lights'], price: 34.9, shipping: 0, delivery: [10, 18], rating: [4.8, 690], orders: 2100, attributes: { color: 'Natural', material: 'Rattan' }, kind: 'pendant-rattan', palette: P.rattan },
  { id: 'pend-02', title: 'Wicker Ceiling Lamp Shade Pendant Boho 40cm', categoryPath: [...LIGHT, 'Pendant Lights'], price: 28.5, shipping: 2.9, delivery: [12, 20], rating: [4.6, 240], orders: 760, attributes: { color: 'Natural', material: 'Wicker' }, kind: 'pendant-rattan', palette: P.wicker },
  { id: 'pend-03', title: 'Bamboo Pendant Lamp Handwoven Natural 50cm', categoryPath: [...LIGHT, 'Pendant Lights'], price: 39.99, shipping: 0, delivery: [12, 22], rating: [4.7, 150], orders: 400, attributes: { color: 'Natural', material: 'Bamboo' }, kind: 'pendant-rattan', palette: P.seagrass },
  { id: 'pend-04', title: 'Rattan Dome Pendant Light Natural 45cm', categoryPath: [...LIGHT, 'Pendant Lights'], price: 31, shipping: 0, delivery: [10, 18], rating: [4.6, 120], orders: 330, attributes: { color: 'Natural', material: 'Rattan' }, kind: 'pendant-dome', palette: P.rattan },
  { id: 'pend-05', title: 'Paper Lantern Pendant Light White 45cm', categoryPath: [...LIGHT, 'Pendant Lights'], price: 18, shipping: 0, delivery: [8, 14], rating: [4.5, 800], orders: 2600, attributes: { color: 'White', material: 'Paper' }, kind: 'lamp-globe', palette: P.paper },
  { id: 'pend-06', title: 'E27 Pendant Cord Kit with Ceiling Rose Black', categoryPath: [...LIGHT, 'Accessories'], price: 9.99, shipping: 0, delivery: [7, 12], rating: [4.7, 900], orders: 4000, attributes: { color: 'Black' }, kind: 'bulb', palette: P.black },
  { id: 'pend-07', title: 'Metal Dome Pendant Light Black Industrial 35cm', categoryPath: [...LIGHT, 'Pendant Lights'], price: 25.9, shipping: 0, delivery: [10, 16], rating: [4.6, 300], orders: 850, attributes: { color: 'Black', material: 'Metal' }, kind: 'pendant-dome', palette: P.black },

  // ── Floor lamps ──────────────────────────────────────────────────────
  { id: 'floor-01', title: 'Tripod Floor Lamp Wood Legs Linen Shade 150cm', categoryPath: [...LIGHT, 'Floor Lamps'], price: 49, shipping: 0, delivery: [12, 20], rating: [4.6, 210], orders: 520, attributes: { color: 'Beige', material: 'Wood, Linen' }, kind: 'floor-lamp', palette: P.linen },
  { id: 'floor-02', title: 'Arc Floor Lamp Black Metal Linen Shade 160cm', categoryPath: [...LIGHT, 'Floor Lamps'], price: 59, shipping: 9.9, delivery: [14, 24], rating: [4.5, 90], orders: 210, attributes: { color: 'Black', material: 'Metal' }, kind: 'floor-lamp', palette: P.black },

  // ── Mirrors ──────────────────────────────────────────────────────────
  { id: 'mir-01', title: 'Round Rattan Wall Mirror Natural Handwoven Sunburst 60cm', categoryPath: MIRRORS, price: 42.9, shipping: 0, delivery: [10, 18], rating: [4.8, 540], orders: 1300, attributes: { color: 'Natural', material: 'Rattan' }, kind: 'mirror-sun', palette: P.rattan },
  { id: 'mir-02', title: 'Boho Rattan Round Mirror Woven Frame 55cm', categoryPath: MIRRORS, price: 35.99, shipping: 4.99, delivery: [12, 20], rating: [4.6, 210], orders: 640, attributes: { color: 'Natural', material: 'Rattan' }, kind: 'mirror-round', palette: P.rattan },
  { id: 'mir-03', title: 'Natural Wicker Round Wall Mirror 50cm Handmade', categoryPath: MIRRORS, price: 29.9, shipping: 0, delivery: [10, 16], rating: [4.7, 180], orders: 410, attributes: { color: 'Natural', material: 'Wicker' }, kind: 'mirror-round', palette: P.wicker },
  { id: 'mir-04', title: 'Seagrass Round Wall Mirror 60cm Natural', categoryPath: MIRRORS, price: 38, shipping: null, delivery: null, rating: [4.5, 60], orders: 150, attributes: { color: 'Natural', material: 'Seagrass' }, kind: 'mirror-sun', palette: P.seagrass },
  { id: 'mir-05', title: 'Round Wooden Frame Wall Mirror Oak 60cm', categoryPath: MIRRORS, price: 31.5, shipping: 0, delivery: [10, 18], rating: [4.6, 300], orders: 900, attributes: { color: 'Natural', material: 'Wood' }, kind: 'mirror-round', palette: P.oak },
  { id: 'mir-06', title: 'Arched Rattan Wall Mirror Natural 50x80cm', categoryPath: MIRRORS, price: 48, shipping: 0, delivery: [12, 20], rating: [4.7, 95], orders: 260, attributes: { color: 'Natural', material: 'Rattan' }, kind: 'mirror-arch', palette: P.rattan },
  { id: 'mir-07', title: 'Round Mirror Wall Stickers Acrylic Set of 12', categoryPath: MIRRORS, price: 5.99, shipping: 0, delivery: [7, 12], rating: [4.2, 1500], orders: 9000, attributes: { color: 'Silver', material: 'Acrylic' }, kind: 'sticker', palette: P.grey },
  { id: 'mir-08', title: 'Full Length Floor Mirror Rattan Frame 160cm', categoryPath: MIRRORS, price: 89, shipping: 15, delivery: [15, 25], rating: [4.5, 40], orders: 80, attributes: { color: 'Natural', material: 'Rattan' }, kind: 'mirror-arch', palette: P.rattan },
  { id: 'mir-09', title: 'Rattan Sun Mirror Round 60cm Natural', categoryPath: MIRRORS, price: 39, shipping: 0, delivery: [10, 18], rating: [4.7, 120], orders: 300, attributes: { color: 'Natural', material: 'Rattan' }, kind: 'mirror-sun', palette: P.rattan, availability: 'out_of_stock' },
  { id: 'mir-10', title: 'Arched Wall Mirror Black Metal Frame 50x100cm', categoryPath: MIRRORS, price: 45, shipping: 0, delivery: [12, 20], rating: [4.6, 230], orders: 700, attributes: { color: 'Black', material: 'Metal' }, kind: 'mirror-arch', palette: P.black },
  { id: 'mir-11', title: 'Wavy Irregular Wall Mirror Organic Shape 60x80cm', categoryPath: MIRRORS, price: 39, shipping: 0, delivery: [10, 18], rating: [4.5, 160], orders: 480, attributes: { color: 'Silver', material: 'Glass' }, kind: 'mirror-wavy', palette: P.grey },

  // ── Armchairs & chairs ───────────────────────────────────────────────
  { id: 'arm-01', title: 'Curved Boucle Armchair Cream Teddy Fabric Accent Chair', categoryPath: [...FURN, 'Living Room Chairs'], price: 189, shipping: 29, delivery: [15, 30], rating: [4.7, 160], orders: 340, attributes: { color: 'Cream', material: 'Boucle' }, kind: 'armchair', palette: P.boucle },
  { id: 'arm-02', title: 'Modern Round Boucle Lounge Chair White Sherpa Wooden Legs', categoryPath: [...FURN, 'Living Room Chairs'], price: 219, shipping: 0, delivery: [18, 30], rating: [4.6, 70], orders: 130, attributes: { color: 'White', material: 'Boucle' }, kind: 'armchair', palette: P.boucleWhite },
  { id: 'arm-03', title: 'Cream Teddy Fabric Armchair Barrel Chair Living Room', categoryPath: [...FURN, 'Living Room Chairs'], price: 169, shipping: null, delivery: null, rating: [4.4, 35], orders: 60, attributes: { color: 'Cream', material: 'Fabric' }, kind: 'armchair', palette: P.boucle },
  { id: 'arm-04', title: 'Velvet Curved Accent Chair Beige', categoryPath: [...FURN, 'Living Room Chairs'], price: 159, shipping: 19, delivery: [15, 28], rating: [4.5, 85], orders: 190, attributes: { color: 'Beige', material: 'Velvet' }, kind: 'armchair', palette: P.velvetBeige },
  { id: 'arm-05', title: 'Stretch Armchair Cover Boucle Slipcover Cream', categoryPath: [...FURN, 'Chair Covers'], price: 24, shipping: 0, delivery: [8, 14], rating: [4.3, 900], orders: 5000, attributes: { color: 'Cream' }, kind: 'cushion', palette: P.boucle },
  { id: 'arm-06', title: 'Boucle Armchair Gubi Style Beetle Lounge', categoryPath: [...FURN, 'Living Room Chairs'], price: 210, shipping: 0, delivery: [15, 30], rating: [4.4, 20], orders: 40, attributes: { color: 'Cream', material: 'Boucle' }, kind: 'armchair', palette: P.boucle },
  { id: 'arm-07', title: 'Premium Boucle Armchair Solid Wood Frame Cream', categoryPath: [...FURN, 'Living Room Chairs'], price: 520, shipping: 0, delivery: [20, 35], rating: [4.9, 12], orders: 20, attributes: { color: 'Cream', material: 'Boucle' }, kind: 'armchair', palette: P.boucle },
  { id: 'arm-08', title: 'Boucle Dining Chair Cream Set of 2', categoryPath: [...FURN, 'Dining Chairs'], price: 129, shipping: 0, delivery: [15, 28], rating: [4.6, 110], orders: 300, attributes: { color: 'Cream', material: 'Boucle' }, kind: 'chair', palette: P.boucle },
  { id: 'chair-01', title: 'Natural Rattan Dining Chair Cane Back Wooden Legs', categoryPath: [...FURN, 'Dining Chairs'], price: 59, shipping: 9.9, delivery: [15, 25], rating: [4.6, 140], orders: 320, attributes: { color: 'Natural', material: 'Rattan, Wood' }, kind: 'chair-cane', palette: { main: '#E9D9B8', accent: '#9C7148', bg: '#F2ECE3' } },
  { id: 'chair-02', title: 'Upholstered Dining Chair Velvet Green Wooden Legs', categoryPath: [...FURN, 'Dining Chairs'], price: 49, shipping: 0, delivery: [14, 24], rating: [4.5, 260], orders: 820, attributes: { color: 'Green', material: 'Velvet' }, kind: 'chair', palette: P.green },
  { id: 'stool-01', title: 'Wooden Bar Stool Round Seat Natural Oak 65cm', categoryPath: [...FURN, 'Bar Stools'], price: 39, shipping: 0, delivery: [12, 20], rating: [4.6, 190], orders: 520, attributes: { color: 'Natural', material: 'Wood' }, kind: 'stool', palette: P.oak },

  // ── Tables ───────────────────────────────────────────────────────────
  { id: 'tab-01', title: 'Round Oak Coffee Table Solid Wood Natural 80cm', categoryPath: [...FURN, 'Coffee Tables'], price: 119, shipping: 0, delivery: [15, 25], rating: [4.7, 95], orders: 210, attributes: { color: 'Natural', material: 'Oak' }, kind: 'table-round', palette: P.oak },
  { id: 'tab-02', title: 'Scandinavian Round Coffee Table Oak Finish 75cm', categoryPath: [...FURN, 'Coffee Tables'], price: 89, shipping: 15, delivery: [15, 28], rating: [4.5, 140], orders: 380, attributes: { color: 'Natural', material: 'Wood' }, kind: 'table-round', palette: P.oak },
  { id: 'tab-03', title: 'Natural Wood Round Coffee Table Pedestal Base 80cm', categoryPath: [...FURN, 'Coffee Tables'], price: 135, shipping: null, delivery: null, rating: null, orders: null, attributes: { color: 'Natural', material: 'Wood' }, kind: 'table-side', palette: P.oak },
  { id: 'tab-04', title: 'Walnut Round Coffee Table 80cm Mid Century', categoryPath: [...FURN, 'Coffee Tables'], price: 99, shipping: 0, delivery: [15, 25], rating: [4.6, 60], orders: 150, attributes: { color: 'Brown', material: 'Walnut' }, kind: 'table-round', palette: P.walnut },
  { id: 'tab-05', title: 'Round Side Table Oak 45cm', categoryPath: [...FURN, 'Side Tables'], price: 49, shipping: 0, delivery: [12, 20], rating: [4.6, 310], orders: 900, attributes: { color: 'Natural', material: 'Oak' }, kind: 'table-side', palette: P.oak },
  { id: 'tab-06', title: 'Coffee Table Legs Set of 4 Metal Black', categoryPath: [...FURN, 'Furniture Parts'], price: 19.99, shipping: 0, delivery: [8, 14], rating: [4.6, 700], orders: 3000, attributes: { color: 'Black', material: 'Metal' }, kind: 'stool', palette: P.black },
  { id: 'tab-07', title: 'Rectangular Oak Coffee Table 110x60cm', categoryPath: [...FURN, 'Coffee Tables'], price: 129, shipping: 0, delivery: [15, 25], rating: [4.5, 70], orders: 170, attributes: { color: 'Natural', material: 'Oak' }, kind: 'table-round', palette: P.oak },
  { id: 'tab-08', title: 'Marble Round Coffee Table White 80cm', categoryPath: [...FURN, 'Coffee Tables'], price: 159, shipping: 0, delivery: [18, 30], rating: [4.7, 50], orders: 90, attributes: { color: 'White', material: 'Marble' }, kind: 'table-round', palette: P.marble },
  { id: 'side-01', title: 'Travertine Effect Round Side Table Pedestal 50cm', categoryPath: [...FURN, 'Side Tables'], price: 69, shipping: 0, delivery: [15, 25], rating: [4.6, 120], orders: 260, attributes: { color: 'Beige', material: 'Travertine' }, kind: 'table-side', palette: { main: '#E3D6C1', accent: '#CDBEA5', bg: '#F1ECE4' } },

  // ── Vases & decor ────────────────────────────────────────────────────
  { id: 'vas-01', title: 'Ribbed Ceramic Vase White Matte Fluted 30cm', categoryPath: [...DECOR, 'Vases'], price: 14.99, shipping: 2.99, delivery: [9, 16], rating: [4.8, 860], orders: 2500, attributes: { color: 'White', material: 'Ceramic' }, kind: 'vase-ribbed', palette: P.ceramicWhite },
  { id: 'vas-02', title: 'Nordic Fluted Ceramic Flower Vase Cream 28cm', categoryPath: [...DECOR, 'Vases'], price: 12.5, shipping: 0, delivery: [8, 14], rating: [4.7, 420], orders: 1200, attributes: { color: 'Cream', material: 'Ceramic' }, kind: 'vase-ribbed', palette: P.ceramicCream },
  { id: 'vas-03', title: 'White Ribbed Stoneware Vase Handmade 32cm', categoryPath: [...DECOR, 'Vases'], price: 17.9, shipping: 0, delivery: [10, 18], rating: [4.9, 75], orders: 190, attributes: { color: 'White', material: 'Stoneware' }, kind: 'vase-ribbed', palette: P.whiteWarm },
  { id: 'vas-04', title: 'Round Ceramic Vase White Glossy 25cm', categoryPath: [...DECOR, 'Vases'], price: 9.99, shipping: 0, delivery: [8, 14], rating: [4.6, 1100], orders: 4100, attributes: { color: 'White', material: 'Ceramic' }, kind: 'vase-round', palette: P.ceramicWhite },
  { id: 'vas-05', title: 'Terracotta Ribbed Vase 30cm', categoryPath: [...DECOR, 'Vases'], price: 13.4, shipping: 0, delivery: [9, 16], rating: [4.7, 230], orders: 640, attributes: { color: 'Terracotta', material: 'Ceramic' }, kind: 'vase-ribbed', palette: P.terracotta },
  { id: 'vas-06', title: 'Artificial Pampas Grass Bouquet for Vase Natural', categoryPath: [...DECOR, 'Artificial Flowers'], price: 8.99, shipping: 0, delivery: [8, 14], rating: [4.5, 2000], orders: 9000, attributes: { color: 'Beige' }, kind: 'vase-bud', palette: P.linen },
  { id: 'vas-07', title: 'Ribbed Ceramic Vase Set of 3 White', categoryPath: [...DECOR, 'Vases'], price: 24.99, shipping: 0, delivery: [10, 18], rating: [4.7, 310], orders: 800, attributes: { color: 'White', material: 'Ceramic' }, kind: 'vase-ribbed', palette: P.ceramicWhite },
  { id: 'vas-08', title: 'Clear Glass Bud Vase Set of 3', categoryPath: [...DECOR, 'Vases'], price: 11, shipping: 0, delivery: [8, 14], rating: [4.6, 900], orders: 3200, attributes: { color: 'Clear', material: 'Glass' }, kind: 'vase-bud', palette: { main: '#E3ECEE', accent: '#7E9479', bg: '#EEF1F0' } },
  { id: 'cand-01', title: 'Brass Candle Holder Set of 3 Taper Candlestick', categoryPath: [...DECOR, 'Candle Holders'], price: 16, shipping: 0, delivery: [9, 16], rating: [4.7, 400], orders: 1100, attributes: { color: 'Gold', material: 'Brass' }, kind: 'candle-holder', palette: P.brass },
  { id: 'clock-01', title: 'Wooden Wall Clock Silent Minimalist Oak 30cm', categoryPath: [...DECOR, 'Wall Clocks'], price: 19.9, shipping: 0, delivery: [9, 16], rating: [4.6, 520], orders: 1700, attributes: { color: 'Natural', material: 'Wood' }, kind: 'clock', palette: { main: '#FAF7F0', accent: '#C9A27A', bg: '#EFEAE2' } },
  { id: 'plant-01', title: 'Ribbed Ceramic Planter with Saucer White 20cm', categoryPath: [...DECOR, 'Planters'], price: 12.9, shipping: 0, delivery: [9, 16], rating: [4.7, 640], orders: 2000, attributes: { color: 'White', material: 'Ceramic' }, kind: 'planter', palette: P.ceramicWhite },
  { id: 'plant-02', title: 'Terracotta Plant Pot Round 25cm', categoryPath: [...DECOR, 'Planters'], price: 10.5, shipping: 0, delivery: [8, 14], rating: [4.6, 300], orders: 900, attributes: { color: 'Terracotta', material: 'Terracotta' }, kind: 'planter', palette: P.terracotta },

  // ── Storage & baskets ────────────────────────────────────────────────
  { id: 'bas-01', title: 'Wicker Storage Basket with Handles Natural Handwoven 40cm', categoryPath: [...STORAGE, 'Baskets'], price: 16.99, shipping: 0, delivery: [9, 16], rating: [4.8, 720], orders: 2300, attributes: { color: 'Natural', material: 'Wicker' }, kind: 'basket', palette: P.wicker },
  { id: 'bas-02', title: 'Seagrass Basket with Handles Large Natural 42cm', categoryPath: [...STORAGE, 'Baskets'], price: 19.5, shipping: 3.5, delivery: [10, 18], rating: [4.6, 260], orders: 700, attributes: { color: 'Natural', material: 'Seagrass' }, kind: 'basket', palette: P.seagrass },
  { id: 'bas-03', title: 'Rattan Laundry Basket with Lid Natural 45cm', categoryPath: [...STORAGE, 'Laundry Baskets'], price: 29.9, shipping: 0, delivery: [12, 20], rating: [4.6, 150], orders: 380, attributes: { color: 'Natural', material: 'Rattan' }, kind: 'basket', palette: P.rattan },
  { id: 'bas-04', title: 'Wicker Baskets Set of 3 with Handles Natural', categoryPath: [...STORAGE, 'Baskets'], price: 24.99, shipping: 0, delivery: [10, 18], rating: [4.7, 410], orders: 1300, attributes: { color: 'Natural', material: 'Wicker' }, kind: 'basket', palette: P.wicker },
  { id: 'bas-05', title: 'Cotton Rope Storage Basket White 38cm', categoryPath: [...STORAGE, 'Baskets'], price: 11.99, shipping: 0, delivery: [8, 14], rating: [4.7, 2100], orders: 7000, attributes: { color: 'White', material: 'Cotton Rope' }, kind: 'basket', palette: P.whiteWarm },
  { id: 'bas-06', title: 'Water Hyacinth Storage Basket Round Natural 40cm', categoryPath: [...STORAGE, 'Baskets'], price: 18.9, shipping: 0, delivery: [10, 18], rating: [4.6, 130], orders: 330, attributes: { color: 'Natural', material: 'Water Hyacinth' }, kind: 'basket', palette: P.seagrass },
  { id: 'box-01', title: 'Fabric Storage Box Foldable Grey', categoryPath: [...STORAGE, 'Storage Boxes'], price: 8.99, shipping: 0, delivery: [8, 14], rating: [4.5, 3000], orders: 11000, attributes: { color: 'Grey', material: 'Fabric' }, kind: 'basket', palette: P.grey },
  { id: 'shelf-01', title: 'Floating Wall Shelf Oak Set of 2 60cm', categoryPath: [...STORAGE, 'Shelves'], price: 24.9, shipping: 0, delivery: [10, 18], rating: [4.6, 480], orders: 1500, attributes: { color: 'Natural', material: 'Oak' }, kind: 'shelf', palette: P.oak },

  // ── Textiles ─────────────────────────────────────────────────────────
  { id: 'cush-01', title: 'Linen Cushion Cover 45x45cm Beige Set of 2', categoryPath: [...TEXT, 'Cushion Covers'], price: 13.99, shipping: 0, delivery: [8, 14], rating: [4.6, 1300], orders: 5000, attributes: { color: 'Beige', material: 'Linen' }, kind: 'cushion', palette: P.linen },
  { id: 'cush-02', title: 'Boucle Cushion Cover Cream 45x45cm', categoryPath: [...TEXT, 'Cushion Covers'], price: 9.5, shipping: 0, delivery: [8, 14], rating: [4.7, 900], orders: 3600, attributes: { color: 'Cream', material: 'Boucle' }, kind: 'cushion', palette: P.boucle },
  { id: 'rug-01', title: 'Round Jute Rug Natural Braided 120cm', categoryPath: [...TEXT, 'Rugs'], price: 29.9, shipping: 0, delivery: [12, 20], rating: [4.6, 380], orders: 1000, attributes: { color: 'Natural', material: 'Jute' }, kind: 'rug', palette: P.jute },
  { id: 'rug-02', title: 'Washable Area Rug Beige Abstract 160x230cm', categoryPath: [...TEXT, 'Rugs'], price: 54, shipping: 0, delivery: [12, 22], rating: [4.5, 420], orders: 1200, attributes: { color: 'Beige', material: 'Polyester' }, kind: 'rug', palette: P.linen },
];

/** Fictional source products for the /ejemplo/* pages and the home demo. */
export interface DemoExample {
  slug: string;
  title: string;
  category: string;
  price: number;
  color: string;
  material: string;
  description: string;
  kind: IllustrationKind;
  palette: Palette;
  /** Short label for the home category chips. */
  chip: string;
}

export const DEMO_EXAMPLES: DemoExample[] = [
  { slug: 'lampara-seta', chip: 'Lámparas', title: 'Lámpara de mesa seta de vidrio ópalo y latón, 38 cm', category: 'Lámparas de mesa', price: 89, color: 'Blanco', material: 'Vidrio ópalo, latón', description: 'Lámpara de mesa con pantalla tipo seta de vidrio ópalo soplado y pie de latón. Alto 38 cm.', kind: 'lamp-mushroom', palette: P.opalBrass },
  { slug: 'jarron-estriado', chip: 'Decoración', title: 'Jarrón de cerámica estriado blanco, 30 cm', category: 'Jarrones', price: 39.9, color: 'Blanco', material: 'Cerámica', description: 'Jarrón de cerámica mate con relieve estriado vertical. Alto 30 cm.', kind: 'vase-ribbed', palette: P.ceramicWhite },
  { slug: 'sillon-boucle', chip: 'Sillas', title: 'Sillón curvo tapizado en bouclé crema', category: 'Sillones', price: 449, color: 'Crema', material: 'Bouclé', description: 'Sillón de formas redondeadas tapizado en tejido bouclé color crema con patas de madera.', kind: 'armchair', palette: P.boucle },
  { slug: 'mesa-centro-roble', chip: 'Mesas', title: 'Mesa de centro redonda de madera de roble, Ø 80 cm', category: 'Mesas de centro', price: 279, color: 'Natural', material: 'Roble', description: 'Mesa de centro redonda de roble macizo con acabado natural. Diámetro 80 cm.', kind: 'table-round', palette: P.oak },
  { slug: 'espejo-ratan', chip: 'Espejos', title: 'Espejo redondo de ratán natural, Ø 60 cm', category: 'Espejos de pared', price: 129, color: 'Natural', material: 'Ratán', description: 'Espejo de pared redondo con marco de ratán trenzado a mano. Diámetro 60 cm.', kind: 'mirror-sun', palette: P.rattan },
  { slug: 'cesta-mimbre', chip: 'Organización', title: 'Cesta de mimbre natural con asas, 40 cm', category: 'Cestas', price: 34.99, color: 'Natural', material: 'Mimbre', description: 'Cesta de almacenaje de mimbre trenzado a mano con asas. Diámetro 40 cm.', kind: 'basket', palette: P.wicker },
  { slug: 'lampara-techo-ratan', chip: 'Iluminación', title: 'Lámpara de techo de ratán natural, Ø 45 cm', category: 'Lámparas de techo', price: 79, color: 'Natural', material: 'Ratán', description: 'Lámpara colgante con pantalla esférica de ratán natural. Diámetro 45 cm.', kind: 'pendant-rattan', palette: P.rattan },
];
