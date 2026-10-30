/**
 * Minimal flat product illustrations for the DEMO catalogue.
 *
 * Demo products are fictional, so they get drawn artwork instead of photos —
 * nobody can mistake them for a real listing, and no third-party images are
 * reused. Rendered to static SVG files at build time (/demo-img/<id>.svg).
 */

export type IllustrationKind =
  | 'lamp-mushroom'
  | 'lamp-globe'
  | 'lamp-cone'
  | 'lamp-pleated'
  | 'lamp-wavy'
  | 'pendant-dome'
  | 'pendant-rattan'
  | 'floor-lamp'
  | 'mirror-round'
  | 'mirror-sun'
  | 'mirror-arch'
  | 'mirror-wavy'
  | 'armchair'
  | 'chair'
  | 'chair-cane'
  | 'stool'
  | 'table-round'
  | 'table-side'
  | 'vase-ribbed'
  | 'vase-round'
  | 'vase-bud'
  | 'basket'
  | 'planter'
  | 'cushion'
  | 'rug'
  | 'shelf'
  | 'candle-holder'
  | 'clock'
  | 'bulb'
  | 'sticker'
  | 'shade';

export interface Palette {
  /** Main body colour. */
  main: string;
  /** Secondary (base, legs, frame…). */
  accent: string;
  /** Background tint. */
  bg: string;
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (c: number) => clamp(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const ground = (y: number, rx = 120) =>
  `<ellipse cx="200" cy="${y}" rx="${rx}" ry="${Math.round(rx / 9)}" fill="#000" opacity=".07"/>`;

function draw(kind: IllustrationKind, p: Palette): string {
  const m = p.main;
  const a = p.accent;
  const md = shade(m, -0.18);
  const ad = shade(a, -0.25);
  const ml = shade(m, 0.35);
  switch (kind) {
    case 'lamp-mushroom':
      return `${ground(334, 90)}<ellipse cx="200" cy="328" rx="58" ry="10" fill="${ad}"/><rect x="190" y="200" width="20" height="128" rx="6" fill="${a}"/>
<path d="M98 214 Q98 112 200 108 Q302 112 302 214 Z" fill="${m}" stroke="${md}" stroke-width="3"/><path d="M122 196 Q130 140 180 128" stroke="${ml}" stroke-width="8" fill="none" stroke-linecap="round" opacity=".7"/>`;
    case 'lamp-globe':
      return `${ground(334, 80)}<rect x="160" y="290" width="80" height="40" rx="10" fill="${a}"/><rect x="160" y="290" width="80" height="10" rx="5" fill="${ad}" opacity=".35"/>
<circle cx="200" cy="205" r="92" fill="${m}" stroke="${md}" stroke-width="3"/><circle cx="168" cy="172" r="26" fill="${ml}" opacity=".6"/>`;
    case 'lamp-cone':
      return `${ground(334, 80)}<ellipse cx="200" cy="328" rx="54" ry="10" fill="${ad}"/><rect x="195" y="170" width="10" height="158" fill="${a}"/>
<path d="M150 90 L250 90 L290 190 L110 190 Z" fill="${m}" stroke="${md}" stroke-width="3" stroke-linejoin="round"/>`;
    case 'lamp-pleated': {
      const pleats = Array.from({ length: 11 }, (_, i) => {
        const x1 = 140 + i * 12;
        const x2 = 110 + i * 18;
        return `<line x1="${x1}" y1="92" x2="${x2}" y2="182" stroke="${md}" stroke-width="2" opacity=".55"/>`;
      }).join('');
      return `${ground(334, 80)}<path d="M200 188 C150 200 150 320 178 330 L222 330 C250 320 250 200 200 188 Z" fill="${a}" stroke="${ad}" stroke-width="3"/>
<path d="M140 92 L260 92 L290 182 L110 182 Z" fill="${m}" stroke="${md}" stroke-width="3" stroke-linejoin="round"/>${pleats}`;
    }
    case 'lamp-wavy':
      return `${ground(334, 80)}<rect x="168" y="300" width="64" height="30" rx="12" fill="${a}"/><rect x="194" y="210" width="12" height="92" fill="${a}"/>
<path d="M110 214 C110 200 122 196 128 186 C134 150 150 150 160 128 C170 106 190 104 200 104 C210 104 230 106 240 128 C250 150 266 150 272 186 C278 196 290 200 290 214 Z" fill="${m}" stroke="${md}" stroke-width="3"/>
<path d="M110 214 q15 14 30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="${m}" stroke="${md}" stroke-width="3"/>`;
    case 'pendant-dome':
      return `<line x1="200" y1="0" x2="200" y2="150" stroke="${ad}" stroke-width="4"/><rect x="186" y="140" width="28" height="22" rx="4" fill="${a}"/>
<path d="M90 280 Q92 160 200 156 Q308 160 310 280 Z" fill="${m}" stroke="${md}" stroke-width="3"/><ellipse cx="200" cy="280" rx="110" ry="12" fill="${md}" opacity=".5"/><ellipse cx="200" cy="284" rx="40" ry="8" fill="#FFE9A8" opacity=".9"/>`;
    case 'pendant-rattan': {
      const weave = Array.from({ length: 9 }, (_, i) => `<ellipse cx="200" cy="225" rx="${100 - i * 11}" ry="100" fill="none" stroke="${md}" stroke-width="2.5" opacity=".6"/>`).join('');
      const rings = Array.from({ length: 7 }, (_, i) => `<line x1="${110 + i * 3}" y1="${150 + i * 25}" x2="${290 - i * 3}" y2="${150 + i * 25}" stroke="${md}" stroke-width="2" opacity=".35"/>`).join('');
      return `<line x1="200" y1="0" x2="200" y2="125" stroke="${ad}" stroke-width="4"/><circle cx="200" cy="225" r="100" fill="${m}"/>${weave}${rings}<circle cx="200" cy="225" r="100" fill="none" stroke="${md}" stroke-width="3"/>`;
    }
    case 'floor-lamp':
      return `${ground(352, 70)}<ellipse cx="200" cy="346" rx="50" ry="9" fill="${ad}"/><rect x="196" y="120" width="8" height="226" fill="${a}"/>
<path d="M150 50 L250 50 L270 125 L130 125 Z" fill="${m}" stroke="${md}" stroke-width="3" stroke-linejoin="round"/>`;
    case 'mirror-round':
      return `${ground(352, 110)}<circle cx="200" cy="200" r="140" fill="${a}" stroke="${ad}" stroke-width="3"/><circle cx="200" cy="200" r="118" fill="#E8EEF0"/>
<path d="M130 150 L180 100 M140 190 L220 110" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".8"/>`;
    case 'mirror-sun': {
      const rays = Array.from({ length: 36 }, (_, i) => {
        const ang = (i / 36) * Math.PI * 2;
        const x1 = 200 + Math.cos(ang) * 112;
        const y1 = 200 + Math.sin(ang) * 112;
        const x2 = 200 + Math.cos(ang) * 168;
        const y2 = 200 + Math.sin(ang) * 168;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i % 2 ? a : ad}" stroke-width="7" stroke-linecap="round"/>`;
      }).join('');
      return `${rays}<circle cx="200" cy="200" r="112" fill="${a}"/><circle cx="200" cy="200" r="96" fill="#E8EEF0"/><path d="M146 160 L186 120" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".8"/>`;
    }
    case 'mirror-arch':
      return `${ground(366, 100)}<path d="M100 360 L100 160 Q100 40 200 40 Q300 40 300 160 L300 360 Z" fill="${a}" stroke="${ad}" stroke-width="3"/>
<path d="M118 350 L118 164 Q118 58 200 58 Q282 58 282 164 L282 350 Z" fill="#E8EEF0"/><path d="M150 140 L200 90 M150 190 L232 108" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".8"/>`;
    case 'mirror-wavy':
      return `${ground(360, 110)}<path d="M200 54 C260 40 330 90 322 160 C316 214 350 256 318 306 C288 352 222 344 186 350 C130 360 80 320 86 262 C90 222 56 184 74 136 C94 82 148 66 200 54 Z" fill="${a}" stroke="${ad}" stroke-width="3"/>
<path d="M200 76 C252 66 308 104 302 162 C298 210 326 250 300 290 C276 328 222 322 190 328 C142 336 102 304 106 256 C110 220 80 186 96 144 C112 100 156 86 200 76 Z" fill="#E8EEF0"/><path d="M146 150 L196 104" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".8"/>`;
    case 'armchair': {
      const dots = Array.from({ length: 70 }, (_, i) => {
        const x = 110 + ((i * 37) % 180);
        const y = 110 + ((i * 53) % 180);
        return `<circle cx="${x}" cy="${y}" r="2.2" fill="${md}" opacity=".35"/>`;
      }).join('');
      return `${ground(340, 130)}<rect x="122" y="300" width="14" height="36" rx="5" fill="${a}"/><rect x="264" y="300" width="14" height="36" rx="5" fill="${a}"/>
<path d="M92 300 C80 220 84 120 140 100 C170 88 230 88 260 100 C316 120 320 220 308 300 Z" fill="${m}" stroke="${md}" stroke-width="3"/>
<path d="M120 300 C118 250 130 210 200 210 C270 210 282 250 280 300 Z" fill="${ml}" stroke="${md}" stroke-width="3"/>${dots}`;
    }
    case 'chair':
      return `${ground(352, 90)}<path d="M140 210 L130 350 M260 210 L270 350 M150 210 L160 340 M250 210 L240 340" stroke="${a}" stroke-width="10" stroke-linecap="round"/>
<path d="M144 70 Q200 52 256 70 L250 180 L150 180 Z" fill="${m}" stroke="${md}" stroke-width="3"/><rect x="124" y="190" width="152" height="26" rx="10" fill="${m}" stroke="${md}" stroke-width="3"/>`;
    case 'chair-cane': {
      const cane = Array.from({ length: 8 }, (_, i) => `<line x1="${158 + i * 12}" y1="80" x2="${158 + i * 12}" y2="172" stroke="${md}" stroke-width="2" opacity=".5"/><line x1="152" y1="${86 + i * 12}" x2="248" y2="${86 + i * 12}" stroke="${md}" stroke-width="2" opacity=".5"/>`).join('');
      return `${ground(352, 90)}<path d="M140 210 L130 350 M260 210 L270 350" stroke="${a}" stroke-width="12" stroke-linecap="round"/>
<path d="M140 60 Q200 40 260 60 L258 186 L142 186 Z" fill="${a}" stroke="${ad}" stroke-width="3"/><rect x="152" y="78" width="96" height="98" rx="8" fill="${m}"/>${cane}<rect x="124" y="190" width="152" height="24" rx="10" fill="${a}" stroke="${ad}" stroke-width="3"/>`;
    }
    case 'stool':
      return `${ground(352, 90)}<path d="M160 160 L130 350 M240 160 L270 350 M200 165 L200 345" stroke="${a}" stroke-width="12" stroke-linecap="round"/>
<line x1="150" y1="270" x2="250" y2="270" stroke="${ad}" stroke-width="6"/><ellipse cx="200" cy="150" rx="88" ry="26" fill="${m}" stroke="${md}" stroke-width="3"/>`;
    case 'table-round':
      return `${ground(336, 150)}<path d="M150 210 L130 330 M250 210 L270 330 M200 214 L200 330" stroke="${a}" stroke-width="14" stroke-linecap="round"/>
<ellipse cx="200" cy="200" rx="160" ry="44" fill="${m}" stroke="${md}" stroke-width="3"/><ellipse cx="200" cy="194" rx="150" ry="36" fill="${ml}" opacity=".35"/>`;
    case 'table-side':
      return `${ground(344, 90)}<ellipse cx="200" cy="336" rx="60" ry="12" fill="${ad}"/><path d="M176 150 L170 334 L230 334 L224 150 Z" fill="${a}"/>
<ellipse cx="200" cy="140" rx="100" ry="28" fill="${m}" stroke="${md}" stroke-width="3"/>`;
    case 'vase-ribbed': {
      const ribs = Array.from({ length: 9 }, (_, i) => `<line x1="${140 + i * 15}" y1="120" x2="${140 + i * 15}" y2="320" stroke="${md}" stroke-width="3" opacity=".45"/>`).join('');
      return `${ground(338, 90)}<path d="M150 84 L250 84 L246 110 C290 150 290 280 250 330 L150 330 C110 280 110 150 154 110 Z" fill="${m}" stroke="${md}" stroke-width="3"/>${ribs}<ellipse cx="200" cy="84" rx="50" ry="8" fill="${md}"/>`;
    }
    case 'vase-round':
      return `${ground(338, 100)}<path d="M176 80 L224 80 L222 120 C300 140 310 290 250 330 L150 330 C90 290 100 140 178 120 Z" fill="${m}" stroke="${md}" stroke-width="3"/><ellipse cx="200" cy="80" rx="24" ry="6" fill="${md}"/>
<path d="M140 190 Q146 150 176 140" stroke="${ml}" stroke-width="9" fill="none" stroke-linecap="round" opacity=".7"/>`;
    case 'vase-bud':
      return `${ground(338, 70)}<path d="M190 120 L210 120 L212 200 C260 230 260 310 230 330 L170 330 C140 310 140 230 188 200 Z" fill="${m}" stroke="${md}" stroke-width="3"/>
<path d="M200 120 C196 90 186 70 170 52 M200 118 C206 84 222 66 240 60" stroke="${a}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="168" cy="50" r="9" fill="${a}"/><circle cx="242" cy="58" r="8" fill="${a}"/>`;
    case 'basket': {
      const weave = Array.from({ length: 7 }, (_, i) => `<path d="M${118 + i * 4} ${178 + i * 22} L${282 - i * 4} ${178 + i * 22}" stroke="${md}" stroke-width="3" opacity=".45"/>`).join('');
      const vert = Array.from({ length: 10 }, (_, i) => `<line x1="${124 + i * 17}" y1="170" x2="${136 + i * 14}" y2="330" stroke="${md}" stroke-width="2" opacity=".35"/>`).join('');
      return `${ground(340, 110)}<path d="M150 170 C150 110 250 110 250 170" stroke="${ad}" stroke-width="10" fill="none"/><path d="M110 170 L290 170 L268 330 L132 330 Z" fill="${m}" stroke="${md}" stroke-width="3" stroke-linejoin="round"/>${weave}${vert}`;
    }
    case 'planter':
      return `${ground(340, 90)}<path d="M200 200 C180 150 140 130 110 140 C140 160 160 180 200 200 Z M200 200 C220 140 260 110 300 120 C270 150 240 180 200 200 Z M200 200 C196 140 210 90 230 60 C236 110 226 160 200 200 Z" fill="#5E8C61"/>
<path d="M130 200 L270 200 L250 332 L150 332 Z" fill="${m}" stroke="${md}" stroke-width="3" stroke-linejoin="round"/><rect x="124" y="196" width="152" height="18" rx="6" fill="${md}"/>`;
    case 'cushion':
      return `${ground(330, 130)}<path d="M80 110 Q200 84 320 110 Q342 200 320 290 Q200 316 80 290 Q58 200 80 110 Z" fill="${m}" stroke="${md}" stroke-width="3"/>
<path d="M120 140 Q200 124 280 140 Q296 200 280 260 Q200 276 120 260 Q104 200 120 140 Z" fill="none" stroke="${a}" stroke-width="3" stroke-dasharray="6 6"/>`;
    case 'rug': {
      const fringe = Array.from({ length: 14 }, (_, i) => `<line x1="${84 + i * 18}" y1="300" x2="${84 + i * 18}" y2="318" stroke="${md}" stroke-width="3"/><line x1="${84 + i * 18}" y1="82" x2="${84 + i * 18}" y2="100" stroke="${md}" stroke-width="3"/>`).join('');
      return `${fringe}<rect x="76" y="100" width="248" height="200" rx="6" fill="${m}" stroke="${md}" stroke-width="3"/>
<rect x="100" y="124" width="200" height="152" rx="4" fill="none" stroke="${a}" stroke-width="5"/><path d="M200 150 L240 200 L200 250 L160 200 Z" fill="none" stroke="${a}" stroke-width="5"/>`;
    }
    case 'shelf':
      return `<rect x="70" y="150" width="260" height="16" rx="4" fill="${m}" stroke="${md}" stroke-width="2"/><rect x="70" y="270" width="260" height="16" rx="4" fill="${m}" stroke="${md}" stroke-width="2"/>
<path d="M100 166 L100 196 M300 166 L300 196 M100 286 L100 316 M300 286 L300 316" stroke="${a}" stroke-width="8" stroke-linecap="round"/>
<rect x="110" y="96" width="22" height="54" rx="3" fill="${a}"/><rect x="136" y="104" width="18" height="46" rx="3" fill="${ad}"/><circle cx="260" cy="128" r="22" fill="${ml}" stroke="${md}" stroke-width="2"/><path d="M180 270 L196 220 L212 270 Z" fill="${a}"/>`;
    case 'candle-holder':
      return `${ground(336, 70)}<ellipse cx="200" cy="330" rx="50" ry="10" fill="${ad}"/><path d="M190 330 L194 200 L206 200 L210 330 Z" fill="${a}"/><ellipse cx="200" cy="198" rx="30" ry="8" fill="${a}"/>
<rect x="186" y="96" width="28" height="100" rx="4" fill="${m}" stroke="${md}" stroke-width="2"/><path d="M200 70 C210 82 208 92 200 96 C192 92 190 82 200 70 Z" fill="#F2B544"/>`;
    case 'clock': {
      const ticks = Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2;
        return `<line x1="${(200 + Math.cos(ang) * 104).toFixed(1)}" y1="${(200 + Math.sin(ang) * 104).toFixed(1)}" x2="${(200 + Math.cos(ang) * 120).toFixed(1)}" y2="${(200 + Math.sin(ang) * 120).toFixed(1)}" stroke="${ad}" stroke-width="5" stroke-linecap="round"/>`;
      }).join('');
      return `<circle cx="200" cy="200" r="140" fill="${a}"/><circle cx="200" cy="200" r="128" fill="${m}"/>${ticks}<path d="M200 200 L200 120 M200 200 L250 220" stroke="${ad}" stroke-width="7" stroke-linecap="round"/><circle cx="200" cy="200" r="8" fill="${ad}"/>`;
    }
    case 'bulb':
      return `${ground(336, 60)}<rect x="176" y="270" width="48" height="56" rx="6" fill="#B9B9B9"/><path d="M180 280 L220 280 M180 296 L220 296 M180 312 L220 312" stroke="#8C8C8C" stroke-width="4"/>
<path d="M200 90 C260 90 290 140 280 190 C272 226 230 240 226 270 L174 270 C170 240 128 226 120 190 C110 140 140 90 200 90 Z" fill="${m}" stroke="${md}" stroke-width="3"/>`;
    case 'sticker':
      return `<rect x="70" y="70" width="260" height="260" rx="18" fill="#fff" stroke="#D9D4CB" stroke-width="3"/>${[0, 1, 2]
        .map((r) => [0, 1, 2].map((c) => `<circle cx="${130 + c * 70}" cy="${130 + r * 70}" r="${26 - r * 3}" fill="#D7E1E5" stroke="#B9C6CC" stroke-width="3"/>`).join(''))
        .join('')}`;
    case 'shade':
      return `${ground(300, 90)}<path d="M150 120 L250 120 L290 280 L110 280 Z" fill="${m}" stroke="${md}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="200" cy="120" rx="50" ry="8" fill="${md}" opacity=".5"/>`;
  }
}

export function renderIllustration(kind: IllustrationKind, palette: Palette, label?: string): string {
  const title = label ? `<title>${label.replace(/[<>&"]/g, '')}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img">${title}<rect width="400" height="400" rx="0" fill="${palette.bg}"/>${draw(kind, palette)}</svg>`;
}
