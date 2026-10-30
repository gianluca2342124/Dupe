/**
 * Domain lexicon for home & decor (Spanish + English).
 *
 * Deterministic understanding of products without calling an AI model:
 * every concept maps Spanish and English surface forms to a canonical id and
 * a preferred English search phrase (AliExpress search works best in English).
 *
 * Extending to fashion/accessories later = adding concepts here, not new code.
 */

export interface CategoryDef {
  id: string;
  group: string;
  /** Spanish and English surface forms (any case/accents; plural handled). */
  terms: string[];
  /** Preferred English query phrase. */
  en: string;
  /** Preferred Spanish phrase (display, ES queries). */
  es: string;
  /** Category is itself an accessory/part (bulb, lampshade…). */
  accessory?: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  // Lighting
  { id: 'table-lamp', group: 'lighting', en: 'table lamp', es: 'lámpara de mesa', terms: ['lampara de mesa', 'lampara mesa', 'lampara de sobremesa', 'lampara sobremesa', 'lamparita', 'lampara de noche', 'lampara mesita', 'flexo', 'table lamp', 'desk lamp', 'bedside lamp', 'nightstand lamp', 'night lamp', 'mushroom lamp'] },
  { id: 'floor-lamp', group: 'lighting', en: 'floor lamp', es: 'lámpara de pie', terms: ['lampara de pie', 'lampara pie', 'lampara de suelo', 'lampara suelo', 'pie de salon', 'floor lamp', 'standing lamp', 'arc lamp', 'lampara de arco'] },
  { id: 'pendant-lamp', group: 'lighting', en: 'pendant light', es: 'lámpara de techo', terms: ['lampara de techo', 'lampara techo', 'lampara colgante', 'lampara de suspension', 'colgante', 'plafon', 'pantalla de techo', 'aranya', 'arana', 'pendant light', 'pendant lamp', 'ceiling lamp', 'ceiling light', 'hanging lamp', 'hanging light', 'chandelier'] },
  { id: 'wall-lamp', group: 'lighting', en: 'wall lamp', es: 'aplique de pared', terms: ['aplique', 'aplique de pared', 'lampara de pared', 'lampara pared', 'wall lamp', 'wall light', 'wall sconce', 'sconce'] },
  { id: 'lamp', group: 'lighting', en: 'lamp', es: 'lámpara', terms: ['lampara', 'lamp', 'luminaria', 'luz de noche', 'night light', 'light fixture'] },
  { id: 'lamp-shade', group: 'lighting', en: 'lamp shade', es: 'pantalla de lámpara', accessory: true, terms: ['pantalla para lampara', 'pantalla de lampara', 'pantalla lampara', 'lampshade', 'lamp shade', 'lamp cover'] },
  { id: 'light-bulb', group: 'lighting', en: 'light bulb', es: 'bombilla', accessory: true, terms: ['bombilla', 'bombillas', 'light bulb', 'led bulb', 'bulb'] },
  { id: 'candle-holder', group: 'decor', en: 'candle holder', es: 'portavelas', terms: ['portavelas', 'porta velas', 'candelabro', 'candelero', 'farol', 'candle holder', 'candlestick', 'candelabra', 'lantern'] },

  // Seating
  { id: 'armchair', group: 'seating', en: 'armchair', es: 'sillón', terms: ['sillon', 'butaca', 'sillon de lectura', 'sillon orejero', 'butacon', 'armchair', 'accent chair', 'lounge chair', 'club chair', 'reading chair', 'wingback chair'] },
  { id: 'dining-chair', group: 'seating', en: 'dining chair', es: 'silla de comedor', terms: ['silla', 'silla de comedor', 'silla comedor', 'silla tapizada', 'dining chair', 'chair', 'side chair', 'kitchen chair'] },
  { id: 'stool', group: 'seating', en: 'stool', es: 'taburete', terms: ['taburete', 'taburete alto', 'taburete bajo', 'banqueta', 'stool', 'bar stool', 'counter stool'] },
  { id: 'sofa', group: 'seating', en: 'sofa', es: 'sofá', terms: ['sofa', 'sofa cama', 'chaise longue', 'couch', 'loveseat', 'settee'] },
  { id: 'bench', group: 'seating', en: 'bench', es: 'banco', terms: ['banco', 'banco recibidor', 'bench', 'entryway bench'] },
  { id: 'pouf', group: 'seating', en: 'pouf ottoman', es: 'puf', terms: ['puf', 'puff', 'pouf', 'otomana', 'reposapies', 'ottoman', 'footstool', 'foot stool'] },

  // Tables
  { id: 'coffee-table', group: 'tables', en: 'coffee table', es: 'mesa de centro', terms: ['mesa de centro', 'mesa centro', 'mesa baja', 'coffee table', 'center table', 'centre table'] },
  { id: 'side-table', group: 'tables', en: 'side table', es: 'mesa auxiliar', terms: ['mesa auxiliar', 'mesita auxiliar', 'mesita de noche', 'mesilla de noche', 'mesilla', 'mesita', 'velador', 'side table', 'end table', 'nightstand', 'bedside table', 'night stand', 'accent table'] },
  { id: 'dining-table', group: 'tables', en: 'dining table', es: 'mesa de comedor', terms: ['mesa de comedor', 'mesa comedor', 'mesa de cocina', 'mesa extensible', 'dining table', 'kitchen table'] },
  { id: 'desk', group: 'tables', en: 'desk', es: 'escritorio', terms: ['escritorio', 'mesa de escritorio', 'mesa de estudio', 'desk', 'writing desk', 'computer desk'] },
  { id: 'console-table', group: 'tables', en: 'console table', es: 'consola', terms: ['consola', 'mesa consola', 'mueble recibidor', 'console table', 'entryway table', 'hallway table'] },
  { id: 'table', group: 'tables', en: 'table', es: 'mesa', terms: ['mesa', 'table'] },

  // Mirrors
  { id: 'floor-mirror', group: 'mirrors', en: 'full length floor mirror', es: 'espejo de pie', terms: ['espejo de pie', 'espejo de suelo', 'espejo vestidor', 'espejo cuerpo entero', 'floor mirror', 'full length mirror', 'standing mirror'] },
  { id: 'wall-mirror', group: 'mirrors', en: 'wall mirror', es: 'espejo de pared', terms: ['espejo', 'espejo de pared', 'espejo pared', 'espejo redondo', 'espejo decorativo', 'mirror', 'wall mirror', 'decorative mirror', 'vanity mirror'] },

  // Storage
  { id: 'basket', group: 'storage', en: 'storage basket', es: 'cesta', terms: ['cesta', 'cesto', 'canasta', 'cesta de almacenaje', 'cesto de ropa', 'panera', 'basket', 'storage basket', 'woven basket', 'laundry basket', 'hamper'] },
  { id: 'storage-box', group: 'storage', en: 'storage box', es: 'caja de almacenaje', terms: ['caja de almacenaje', 'caja almacenaje', 'caja organizadora', 'baul', 'caja', 'storage box', 'storage bin', 'storage chest', 'trunk', 'box'] },
  { id: 'shelf', group: 'storage', en: 'shelf', es: 'estantería', terms: ['estanteria', 'estante', 'balda', 'repisa', 'libreria', 'shelf', 'shelving', 'bookshelf', 'bookcase', 'wall shelf', 'floating shelf'] },
  { id: 'coat-rack', group: 'storage', en: 'coat rack', es: 'perchero', terms: ['perchero', 'perchero de pie', 'colgador', 'coat rack', 'coat stand', 'clothes rack', 'hat stand'] },
  { id: 'organizer', group: 'storage', en: 'desk organizer', es: 'organizador', terms: ['organizador', 'organizador de escritorio', 'cubertero', 'joyero', 'organizer', 'jewelry box', 'drawer organizer'] },
  { id: 'cabinet', group: 'storage', en: 'storage cabinet', es: 'aparador', terms: ['aparador', 'comoda', 'cajonera', 'mueble tv', 'mueble de tv', 'vitrina', 'armario', 'sideboard', 'dresser', 'chest of drawers', 'tv stand', 'tv cabinet', 'cabinet', 'wardrobe'] },

  // Decor
  { id: 'vase', group: 'decor', en: 'vase', es: 'jarrón', terms: ['jarron', 'florero', 'bud vase', 'vase', 'flower vase'] },
  { id: 'planter', group: 'decor', en: 'planter pot', es: 'macetero', terms: ['maceta', 'macetero', 'cubremaceta', 'cubremacetas', 'jardinera', 'planter', 'plant pot', 'flower pot', 'pot planter'] },
  { id: 'clock', group: 'decor', en: 'wall clock', es: 'reloj de pared', terms: ['reloj de pared', 'reloj pared', 'reloj', 'wall clock', 'clock'] },
  { id: 'frame', group: 'decor', en: 'photo frame', es: 'marco de fotos', terms: ['marco de fotos', 'marco foto', 'portafotos', 'marco', 'photo frame', 'picture frame', 'frame'] },
  { id: 'sculpture', group: 'decor', en: 'decorative sculpture', es: 'figura decorativa', terms: ['figura decorativa', 'figura', 'escultura', 'busto', 'sculpture', 'statue', 'figurine', 'bust'] },
  { id: 'tray', group: 'decor', en: 'decorative tray', es: 'bandeja decorativa', terms: ['bandeja decorativa', 'bandeja', 'centro de mesa', 'tray', 'decorative tray', 'serving tray'] },
  { id: 'candle', group: 'decor', en: 'scented candle', es: 'vela', terms: ['vela', 'vela aromatica', 'velas', 'candle', 'scented candle'] },
  { id: 'wall-art', group: 'decor', en: 'wall art', es: 'cuadro', terms: ['cuadro', 'lamina', 'poster', 'lienzo', 'cuadro decorativo', 'tapiz', 'wall art', 'canvas print', 'canvas painting', 'art print', 'wall hanging', 'tapestry'] },
  { id: 'bookend', group: 'decor', en: 'bookends', es: 'sujetalibros', terms: ['sujetalibros', 'sujeta libros', 'bookend', 'book end'] },
  { id: 'artificial-plant', group: 'decor', en: 'artificial plant', es: 'planta artificial', terms: ['planta artificial', 'flor artificial', 'flores secas', 'ramo artificial', 'hierba de pampa', 'pampa', 'artificial plant', 'faux plant', 'artificial flower', 'dried flower', 'pampas grass', 'pampas', 'bouquet'] },

  // Textiles
  { id: 'cushion-cover', group: 'textiles', en: 'cushion cover', es: 'funda de cojín', terms: ['funda de cojin', 'funda cojin', 'cojin', 'cojin decorativo', 'almohadon', 'cushion cover', 'pillow cover', 'pillowcase', 'throw pillow', 'cushion', 'pillow case'] },
  { id: 'rug', group: 'textiles', en: 'area rug', es: 'alfombra', terms: ['alfombra', 'alfombra de salon', 'felpudo', 'rug', 'area rug', 'carpet', 'doormat'] },
  { id: 'throw', group: 'textiles', en: 'throw blanket', es: 'manta', terms: ['manta', 'plaid', 'manta de sofa', 'foulard', 'throw blanket', 'throw', 'blanket'] },
  { id: 'curtain', group: 'textiles', en: 'curtain', es: 'cortina', terms: ['cortina', 'visillo', 'estor', 'curtain', 'drape', 'sheer curtain', 'blind'] },
  { id: 'bedding', group: 'textiles', en: 'duvet cover set', es: 'funda nórdica', terms: ['funda nordica', 'juego de cama', 'juego de sabana', 'sabana', 'colcha', 'edredon', 'duvet cover', 'bedding set', 'bed sheet', 'bedspread', 'comforter', 'quilt'] },
  { id: 'table-linen', group: 'textiles', en: 'tablecloth', es: 'mantel', terms: ['mantel', 'camino de mesa', 'mantel individual', 'servilleta', 'tablecloth', 'table runner', 'placemat', 'napkin'] },

  // Tableware
  { id: 'dinnerware', group: 'tableware', en: 'ceramic plate set', es: 'vajilla', terms: ['vajilla', 'plato', 'plato llano', 'plato hondo', 'cuenco', 'bol', 'ensaladera', 'fuente', 'plate', 'dinner plate', 'dinnerware', 'bowl', 'salad bowl', 'serving bowl'] },
  { id: 'glassware', group: 'tableware', en: 'drinking glass', es: 'vaso', terms: ['vaso', 'copa', 'copa de vino', 'jarra', 'botella', 'glass', 'drinking glass', 'wine glass', 'tumbler', 'pitcher', 'carafe', 'jug'] },
  { id: 'mug', group: 'tableware', en: 'ceramic mug', es: 'taza', terms: ['taza', 'mug', 'cup', 'coffee cup', 'tea cup', 'teacup'] },
  { id: 'cutlery', group: 'tableware', en: 'cutlery set', es: 'cubertería', terms: ['cuberteria', 'cubierto', 'cutlery', 'flatware', 'silverware'] },
];

export interface ConceptDef {
  id: string;
  terms: string[];
  en: string;
  es: string;
  /** Related concepts with partial similarity (0–1). */
  related?: Record<string, number>;
}

export const COLORS: ConceptDef[] = [
  { id: 'white', en: 'white', es: 'blanco', terms: ['blanco', 'blanca', 'white', 'opalo', 'opal', 'nieve'], related: { cream: 0.7, beige: 0.4, silver: 0.2, transparent: 0.2 } },
  { id: 'cream', en: 'cream', es: 'crema', terms: ['crema', 'crudo', 'cruda', 'ecru', 'marfil', 'hueso', 'cream', 'ivory', 'off white', 'off-white', 'vainilla'], related: { white: 0.7, beige: 0.7 } },
  { id: 'beige', en: 'beige', es: 'beige', terms: ['beige', 'arena', 'camel', 'taupe', 'topo', 'sand', 'greige', 'lino natural'], related: { cream: 0.7, natural: 0.6, brown: 0.35, white: 0.4, grey: 0.3 } },
  { id: 'natural', en: 'natural', es: 'natural', terms: ['natural', 'madera natural', 'roble claro', 'light wood'], related: { beige: 0.6, brown: 0.5 } },
  { id: 'brown', en: 'brown', es: 'marrón', terms: ['marron', 'cafe', 'chocolate', 'conac', 'cognac', 'caramelo', 'caramel', 'tabaco', 'brown', 'nogal oscuro', 'dark wood'], related: { natural: 0.5, beige: 0.35, orange: 0.25 } },
  { id: 'black', en: 'black', es: 'negro', terms: ['negro', 'negra', 'black', 'grafito', 'carbon', 'charcoal'], related: { grey: 0.35 } },
  { id: 'grey', en: 'grey', es: 'gris', terms: ['gris', 'grey', 'gray', 'antracita', 'anthracite', 'plomo', 'cemento'], related: { black: 0.35, silver: 0.4, beige: 0.3 } },
  { id: 'green', en: 'green', es: 'verde', terms: ['verde', 'green', 'oliva', 'olive', 'salvia', 'sage', 'menta', 'mint', 'esmeralda', 'emerald', 'kaki', 'khaki', 'musgo', 'moss', 'botella'], related: { blue: 0.15 } },
  { id: 'blue', en: 'blue', es: 'azul', terms: ['azul', 'blue', 'marino', 'navy', 'celeste', 'turquesa', 'turquoise', 'petroleo', 'teal', 'indigo', 'cobalto', 'cobalt'], related: { green: 0.15 } },
  { id: 'red', en: 'red', es: 'rojo', terms: ['rojo', 'roja', 'red', 'burdeos', 'burgundy', 'granate', 'vino', 'cereza', 'cherry'], related: { pink: 0.3, orange: 0.3 } },
  { id: 'pink', en: 'pink', es: 'rosa', terms: ['rosa', 'rosado', 'pink', 'rosa palo', 'blush', 'nude', 'malva', 'mauve'], related: { red: 0.3 } },
  { id: 'orange', en: 'orange', es: 'naranja', terms: ['naranja', 'orange', 'terracota', 'terracotta', 'teja', 'oxido', 'rust', 'calabaza', 'ambar', 'amber', 'miel', 'honey', 'cognac glass'], related: { brown: 0.3, red: 0.3, yellow: 0.35, gold: 0.3 } },
  { id: 'yellow', en: 'yellow', es: 'amarillo', terms: ['amarillo', 'amarilla', 'yellow', 'mostaza', 'mustard', 'ocre', 'ochre', 'limon'], related: { orange: 0.3, gold: 0.3 } },
  { id: 'gold', en: 'gold', es: 'dorado', terms: ['dorado', 'dorada', 'oro', 'gold', 'golden', 'laton', 'brass', 'cobre', 'copper', 'bronce', 'bronze'], related: { yellow: 0.3, brown: 0.2 } },
  { id: 'silver', en: 'silver', es: 'plateado', terms: ['plateado', 'plateada', 'plata', 'silver', 'cromado', 'chrome', 'niquel', 'nickel', 'acero inoxidable'], related: { grey: 0.4, white: 0.2 } },
  { id: 'transparent', en: 'clear', es: 'transparente', terms: ['transparente', 'clear', 'transparent', 'cristal transparente'], related: { white: 0.2 } },
  { id: 'multicolor', en: 'multicolor', es: 'multicolor', terms: ['multicolor', 'multicolour', 'colorido', 'colorful', 'arcoiris', 'rainbow'] },
];

export const MATERIALS: ConceptDef[] = [
  { id: 'oak', en: 'oak', es: 'roble', terms: ['roble', 'oak'], related: { wood: 0.85, ash: 0.7, walnut: 0.5, pine: 0.5 } },
  { id: 'walnut', en: 'walnut', es: 'nogal', terms: ['nogal', 'walnut'], related: { wood: 0.85, oak: 0.5 } },
  { id: 'ash', en: 'ash wood', es: 'fresno', terms: ['fresno', 'ash wood'], related: { wood: 0.85, oak: 0.7 } },
  { id: 'pine', en: 'pine', es: 'pino', terms: ['pino', 'pine'], related: { wood: 0.85 } },
  { id: 'mango', en: 'mango wood', es: 'mango', terms: ['madera de mango', 'mango wood'], related: { wood: 0.85, acacia: 0.6 } },
  { id: 'acacia', en: 'acacia wood', es: 'acacia', terms: ['acacia'], related: { wood: 0.85, mango: 0.6 } },
  { id: 'teak', en: 'teak', es: 'teca', terms: ['teca', 'teak'], related: { wood: 0.85 } },
  { id: 'wood', en: 'wooden', es: 'madera', terms: ['madera', 'madera maciza', 'wood', 'wooden', 'solid wood', 'haya', 'beech'], related: { oak: 0.85, walnut: 0.85, ash: 0.85, pine: 0.85, mango: 0.85, acacia: 0.85, teak: 0.85, bamboo: 0.5, mdf: 0.5, plywood: 0.6 } },
  { id: 'bamboo', en: 'bamboo', es: 'bambú', terms: ['bambu', 'bamboo'], related: { rattan: 0.55, wood: 0.5 } },
  { id: 'rattan', en: 'rattan', es: 'ratán', terms: ['ratan', 'rattan', 'rota', 'enea'], related: { wicker: 0.85, seagrass: 0.6, bamboo: 0.55, jute: 0.4 } },
  { id: 'wicker', en: 'wicker', es: 'mimbre', terms: ['mimbre', 'wicker', 'trenzado', 'woven', 'tejido a mano'], related: { rattan: 0.85, seagrass: 0.7, jute: 0.5 } },
  { id: 'seagrass', en: 'seagrass', es: 'junco marino', terms: ['junco marino', 'junco', 'seagrass', 'water hyacinth', 'jacinto de agua'], related: { wicker: 0.7, rattan: 0.6, jute: 0.5 } },
  { id: 'jute', en: 'jute', es: 'yute', terms: ['yute', 'jute', 'sisal', 'cuerda', 'rope', 'esparto'], related: { seagrass: 0.5, wicker: 0.5, cotton: 0.2 } },
  { id: 'cotton', en: 'cotton', es: 'algodón', terms: ['algodon', 'cotton'], related: { linen: 0.6, fabric: 0.7 } },
  { id: 'linen', en: 'linen', es: 'lino', terms: ['lino', 'linen'], related: { cotton: 0.6, fabric: 0.7 } },
  { id: 'wool', en: 'wool', es: 'lana', terms: ['lana', 'wool', 'merino'], related: { fabric: 0.6 } },
  { id: 'velvet', en: 'velvet', es: 'terciopelo', terms: ['terciopelo', 'velvet', 'pana', 'corduroy'], related: { fabric: 0.6 } },
  { id: 'boucle', en: 'boucle', es: 'bouclé', terms: ['boucle', 'borreguito', 'sherpa', 'teddy', 'lambswool'], related: { fabric: 0.6, wool: 0.5 } },
  { id: 'leather', en: 'leather', es: 'piel', terms: ['cuero', 'piel', 'leather', 'polipiel', 'piel sintetica', 'pu leather', 'faux leather'], related: { fabric: 0.2 } },
  { id: 'fabric', en: 'fabric', es: 'tela', terms: ['tela', 'tejido', 'textil', 'tapizado', 'fabric', 'upholstered', 'polyester', 'poliester'], related: { cotton: 0.7, linen: 0.7, velvet: 0.6, boucle: 0.6, wool: 0.6 } },
  { id: 'metal', en: 'metal', es: 'metal', terms: ['metal', 'metalico', 'metalica', 'metallic'], related: { iron: 0.85, steel: 0.85, brass: 0.7, aluminium: 0.8 } },
  { id: 'iron', en: 'iron', es: 'hierro', terms: ['hierro', 'forja', 'iron', 'wrought iron'], related: { metal: 0.85, steel: 0.75 } },
  { id: 'steel', en: 'steel', es: 'acero', terms: ['acero', 'steel', 'stainless'], related: { metal: 0.85, iron: 0.75, aluminium: 0.6 } },
  { id: 'brass', en: 'brass', es: 'latón', terms: ['laton', 'brass', 'chapado en laton'], related: { metal: 0.7, copper: 0.6 } },
  { id: 'copper', en: 'copper', es: 'cobre', terms: ['cobre', 'copper'], related: { brass: 0.6, metal: 0.7 } },
  { id: 'aluminium', en: 'aluminum', es: 'aluminio', terms: ['aluminio', 'aluminium', 'aluminum'], related: { metal: 0.8, steel: 0.6 } },
  { id: 'opal-glass', en: 'opal glass', es: 'vidrio ópalo', terms: ['vidrio opalo', 'cristal opalo', 'opalo', 'opal glass', 'opal', 'frosted glass', 'vidrio esmerilado', 'milk glass'], related: { glass: 0.8 } },
  { id: 'glass', en: 'glass', es: 'vidrio', terms: ['vidrio', 'cristal', 'glass', 'borosilicato', 'borosilicate', 'vidrio soplado', 'blown glass'], related: { 'opal-glass': 0.8, acrylic: 0.4 } },
  { id: 'ceramic', en: 'ceramic', es: 'cerámica', terms: ['ceramica', 'ceramic', 'gres', 'stoneware', 'porcelana', 'porcelain', 'loza', 'earthenware'], related: { terracotta: 0.7, concrete: 0.25 } },
  { id: 'terracotta', en: 'terracotta', es: 'terracota', terms: ['terracota', 'terracotta', 'barro', 'clay', 'arcilla'], related: { ceramic: 0.7 } },
  { id: 'marble', en: 'marble', es: 'mármol', terms: ['marmol', 'marble', 'efecto marmol', 'marble effect'], related: { travertine: 0.7, stone: 0.7 } },
  { id: 'travertine', en: 'travertine', es: 'travertino', terms: ['travertino', 'travertine'], related: { marble: 0.7, stone: 0.7 } },
  { id: 'stone', en: 'stone', es: 'piedra', terms: ['piedra', 'stone', 'granito', 'granite'], related: { marble: 0.7, travertine: 0.7, concrete: 0.5 } },
  { id: 'concrete', en: 'concrete', es: 'cemento', terms: ['cemento', 'hormigon', 'concrete', 'microcemento'], related: { stone: 0.5, ceramic: 0.25 } },
  { id: 'resin', en: 'resin', es: 'resina', terms: ['resina', 'resin', 'poliresina', 'polyresin'], related: { plastic: 0.5 } },
  { id: 'plastic', en: 'plastic', es: 'plástico', terms: ['plastico', 'plastic', 'polipropileno', 'polypropylene', 'pvc'], related: { acrylic: 0.6, resin: 0.5 } },
  { id: 'acrylic', en: 'acrylic', es: 'acrílico', terms: ['acrilico', 'acrylic', 'metacrilato', 'plexiglas'], related: { plastic: 0.6, glass: 0.4 } },
  { id: 'paper', en: 'paper', es: 'papel', terms: ['papel', 'paper', 'papel de arroz', 'rice paper', 'washi'], related: { fabric: 0.3 } },
  { id: 'mdf', en: 'mdf', es: 'DM', terms: ['dm', 'mdf', 'aglomerado', 'melamina', 'chipboard', 'particleboard'], related: { wood: 0.5, plywood: 0.6 } },
  { id: 'plywood', en: 'plywood', es: 'contrachapado', terms: ['contrachapado', 'plywood'], related: { wood: 0.6, mdf: 0.6 } },
];

export const SHAPES: ConceptDef[] = [
  { id: 'round', en: 'round', es: 'redondo', terms: ['redondo', 'redonda', 'circular', 'round', 'circle', 'redondeado'], related: { oval: 0.5, globe: 0.3 } },
  { id: 'oval', en: 'oval', es: 'ovalado', terms: ['ovalado', 'ovalada', 'oval', 'elipse', 'ellipse'], related: { round: 0.5, irregular: 0.3 } },
  { id: 'rectangular', en: 'rectangular', es: 'rectangular', terms: ['rectangular', 'rectangle'], related: { square: 0.5 } },
  { id: 'square', en: 'square', es: 'cuadrado', terms: ['cuadrado', 'cuadrada', 'square'], related: { rectangular: 0.5 } },
  { id: 'arch', en: 'arch', es: 'arco', terms: ['arco', 'arqueado', 'arqueada', 'arch', 'arched', 'en arco'], related: { round: 0.2 } },
  { id: 'mushroom', en: 'mushroom', es: 'seta', terms: ['seta', 'hongo', 'champinon', 'mushroom'], related: { dome: 0.5, globe: 0.3 } },
  { id: 'globe', en: 'globe', es: 'globo', terms: ['globo', 'esfera', 'esferico', 'esferica', 'bola', 'globe', 'sphere', 'ball', 'orb'], related: { round: 0.3, mushroom: 0.3, bubble: 0.6 } },
  { id: 'cylinder', en: 'cylinder', es: 'cilíndrico', terms: ['cilindro', 'cilindrico', 'cilindrica', 'tubular', 'cylinder', 'cylindrical', 'tube'], related: { drum: 0.6 } },
  { id: 'cone', en: 'cone', es: 'cónico', terms: ['conico', 'conica', 'cono', 'cone', 'conical', 'tapered'], related: { bell: 0.5 } },
  { id: 'dome', en: 'dome', es: 'cúpula', terms: ['cupula', 'domo', 'dome', 'semiesfera', 'half moon', 'media luna'], related: { mushroom: 0.5, bell: 0.4 } },
  { id: 'bell', en: 'bell', es: 'campana', terms: ['campana', 'bell'], related: { dome: 0.4, cone: 0.5, tulip: 0.4 } },
  { id: 'drum', en: 'drum', es: 'tambor', terms: ['tambor', 'drum'], related: { cylinder: 0.6 } },
  { id: 'tulip', en: 'tulip', es: 'tulipán', terms: ['tulipan', 'tulip'], related: { bell: 0.4 } },
  { id: 'wavy', en: 'wavy', es: 'ondulado', terms: ['ondulado', 'ondulada', 'ondas', 'onda', 'wavy', 'wave', 'squiggle'], related: { scalloped: 0.5, irregular: 0.3 } },
  { id: 'scalloped', en: 'scalloped', es: 'festoneado', terms: ['festoneado', 'festoneada', 'scalloped', 'petal'], related: { wavy: 0.5 } },
  { id: 'pleated', en: 'pleated', es: 'plisado', terms: ['plisado', 'plisada', 'pleated', 'plisse'], related: { ribbed: 0.5 } },
  { id: 'ribbed', en: 'ribbed', es: 'estriado', terms: ['estriado', 'estriada', 'acanalado', 'acanalada', 'ribbed', 'fluted', 'reeded'], related: { pleated: 0.5 } },
  { id: 'irregular', en: 'organic shape', es: 'orgánico', terms: ['irregular', 'organico', 'organica', 'asimetrico', 'asimetrica', 'organic', 'asymmetric', 'abstract', 'abstracto'], related: { wavy: 0.3, oval: 0.3 } },
  { id: 'geometric', en: 'geometric', es: 'geométrico', terms: ['geometrico', 'geometrica', 'geometric', 'hexagonal', 'octogonal', 'prisma'], related: { square: 0.2 } },
  { id: 'tripod', en: 'tripod', es: 'trípode', terms: ['tripode', 'tripod', 'tres patas', 'three legs'] },
  { id: 'bubble', en: 'bubble', es: 'burbuja', terms: ['burbuja', 'bubble', 'nube', 'cloud'], related: { globe: 0.6 } },
  { id: 'hourglass', en: 'hourglass', es: 'reloj de arena', terms: ['reloj de arena', 'hourglass'], related: { cylinder: 0.2 } },
];

export const STYLES: ConceptDef[] = [
  { id: 'scandinavian', en: 'scandinavian', es: 'nórdico', terms: ['nordico', 'nordica', 'escandinavo', 'escandinava', 'scandinavian', 'scandi', 'nordic style'], related: { minimalist: 0.6, japandi: 0.6 } },
  { id: 'japandi', en: 'japandi', es: 'japandi', terms: ['japandi', 'japones', 'japonesa', 'japanese', 'wabi sabi', 'wabi-sabi', 'zen'], related: { scandinavian: 0.6, minimalist: 0.6 } },
  { id: 'boho', en: 'boho', es: 'boho', terms: ['boho', 'bohemio', 'bohemia', 'bohemian', 'etnico', 'etnica', 'ethnic', 'boho chic'], related: { mediterranean: 0.5, rustic: 0.4 } },
  { id: 'industrial', en: 'industrial', es: 'industrial', terms: ['industrial', 'loft'], related: { vintage: 0.4 } },
  { id: 'mid-century', en: 'mid century', es: 'mid century', terms: ['mid century', 'midcentury', 'mid-century', 'anos 50', 'anos 60', 'sixties'], related: { vintage: 0.6, retro: 0.7 } },
  { id: 'minimalist', en: 'minimalist', es: 'minimalista', terms: ['minimalista', 'minimalist', 'minimal'], related: { scandinavian: 0.6, japandi: 0.6 } },
  { id: 'vintage', en: 'vintage', es: 'vintage', terms: ['vintage', 'antiguo', 'antigua', 'envejecido', 'antique'], related: { retro: 0.7, rustic: 0.4 } },
  { id: 'retro', en: 'retro', es: 'retro', terms: ['retro', 'seventies', 'anos 70', '70s'], related: { vintage: 0.7, 'mid-century': 0.7 } },
  { id: 'rustic', en: 'rustic', es: 'rústico', terms: ['rustico', 'rustica', 'rustic', 'farmhouse', 'campestre'], related: { vintage: 0.4, boho: 0.4 } },
  { id: 'art-deco', en: 'art deco', es: 'art déco', terms: ['art deco', 'artdeco', 'deco'], related: { vintage: 0.4 } },
  { id: 'bauhaus', en: 'bauhaus', es: 'bauhaus', terms: ['bauhaus'], related: { 'mid-century': 0.5, minimalist: 0.4 } },
  { id: 'mediterranean', en: 'mediterranean', es: 'mediterráneo', terms: ['mediterraneo', 'mediterranea', 'mediterranean', 'ibicenco', 'ibiza'], related: { boho: 0.5, rustic: 0.4 } },
  { id: 'coastal', en: 'coastal', es: 'costero', terms: ['costero', 'marinero', 'coastal', 'nautical', 'nautico'], related: { mediterranean: 0.4 } },
  { id: 'classic', en: 'classic', es: 'clásico', terms: ['clasico', 'clasica', 'classic', 'elegante', 'elegant'], related: { vintage: 0.3 } },
];

export const FEATURES: ConceptDef[] = [
  { id: 'rechargeable', en: 'rechargeable', es: 'recargable', terms: ['recargable', 'inalambrica', 'inalambrico', 'sin cable', 'portatil', 'rechargeable', 'cordless', 'wireless', 'portable', 'battery'] },
  { id: 'dimmable', en: 'dimmable', es: 'regulable', terms: ['regulable', 'intensidad regulable', 'dimmable', 'dimmer', 'atenuable'] },
  { id: 'touch', en: 'touch', es: 'táctil', terms: ['tactil', 'touch', 'touch control'] },
  { id: 'led', en: 'led', es: 'led', terms: ['led', 'leds', 'integrated led', 'led integrado'] },
  { id: 'usb', en: 'usb', es: 'usb', terms: ['usb', 'usb-c', 'type-c'] },
  { id: 'smart', en: 'smart', es: 'inteligente', terms: ['inteligente', 'smart', 'wifi', 'alexa', 'app control'] },
  { id: 'stackable', en: 'stackable', es: 'apilable', terms: ['apilable', 'stackable'] },
  { id: 'foldable', en: 'foldable', es: 'plegable', terms: ['plegable', 'foldable', 'folding', 'collapsible'] },
  { id: 'drawer', en: 'with drawer', es: 'con cajón', terms: ['cajon', 'cajonera', 'drawer', 'drawers'] },
  { id: 'storage', en: 'with storage', es: 'con almacenaje', terms: ['almacenaje', 'almacenamiento', 'storage', 'con hueco'] },
  { id: 'swivel', en: 'swivel', es: 'giratorio', terms: ['giratorio', 'giratoria', 'swivel', 'rotating', 'rotatorio'] },
  { id: 'armrests', en: 'with armrests', es: 'con reposabrazos', terms: ['reposabrazos', 'brazos', 'armrest', 'armrests', 'with arms'] },
  { id: 'upholstered', en: 'upholstered', es: 'tapizado', terms: ['tapizado', 'tapizada', 'upholstered', 'acolchado', 'padded'] },
  { id: 'outdoor', en: 'outdoor', es: 'exterior', terms: ['exterior', 'jardin', 'terraza', 'outdoor', 'garden', 'patio'] },
  { id: 'handmade', en: 'handmade', es: 'hecho a mano', terms: ['hecho a mano', 'artesanal', 'handmade', 'hand made', 'handcrafted', 'soplado a mano', 'hand blown'] },
  { id: 'extendable', en: 'extendable', es: 'extensible', terms: ['extensible', 'extendable', 'expandable'] },
  { id: 'wheels', en: 'with wheels', es: 'con ruedas', terms: ['ruedas', 'wheels', 'casters', 'rolling'] },
  { id: 'backlit', en: 'led backlit', es: 'retroiluminado', terms: ['retroiluminado', 'retroiluminada', 'iluminado', 'backlit', 'lighted', 'illuminated'] },
  { id: 'adjustable', en: 'adjustable', es: 'ajustable', terms: ['ajustable', 'regulable en altura', 'orientable', 'adjustable', 'articulado', 'flexible arm'] },
  { id: 'nesting', en: 'nesting', es: 'nido', terms: ['nido', 'nesting', 'set de mesas'] },
  { id: 'lid', en: 'with lid', es: 'con tapa', terms: ['con tapa', 'tapa', 'lid', 'with lid'] },
  { id: 'handles', en: 'with handles', es: 'con asas', terms: ['asas', 'asa', 'handles', 'handle'] },
];

/**
 * Words that only make a listing an accessory when they come *before* the
 * product noun ("Cable para lámpara…", "Switch for lamp") — "lámpara con
 * cable de tela" is still a lamp.
 */
export const WEAK_ACCESSORY_TERMS: string[] = [
  'cable', 'cord', 'interruptor', 'switch', 'enchufe', 'plug', 'adaptador', 'adapter', 'mando', 'remote control', 'controller',
  'transformador', 'transformer', 'driver', 'bombilla', 'bulb', 'funda', 'cover', 'pata', 'leg', 'tapa', 'lid', 'soporte', 'bracket',
  'gancho', 'hook', 'tornillo', 'screw', 'muelle', 'spring',
];

/** Words that turn a listing into a part/accessory of the main product. */
export const ACCESSORY_TERMS: Record<string, string[]> = {
  _generic: [
    'pegatina', 'vinilo', 'adhesivo decorativo', 'sticker', 'decal', 'miniatura', 'casa de munecas', 'dollhouse', 'doll house',
    'juguete', 'toy', 'llavero', 'keychain', 'maqueta', 'model kit', 'patron', 'pattern', 'sewing pattern', 'digital download',
    'descarga digital', 'printable', 'imprimible', 'solo funda', 'cover only', 'only cover', 'repuesto', 'recambio', 'replacement',
    'spare part', 'pieza de repuesto', 'molde', 'mold', 'mould', 'svg file', '1 12', '1:12', 'escala 1', 'scale model', 'muestra', 'sample',
  ],
  lighting: [
    'bulb only', 'solo bombilla', 'solo pantalla', 'shade only', 'lampshade only', 'portalampara', 'lamp holder', 'lamp socket',
    'casquillo', 'lamp base only', 'solo base', 'base only', 'pendant cord kit', 'cord kit', 'kit de cable',
  ],
  seating: [
    'funda de silla', 'funda silla', 'chair cover', 'seat cover', 'funda para sillon', 'funda de sillon', 'sofa cover', 'funda de sofa',
    'armchair cover', 'slipcover', 'slip cover', 'cojin de silla',
    'chair pad', 'seat cushion', 'cojin de asiento', 'protector', 'tacos', 'contera', 'leg caps', 'leg cover', 'chair glide', 'furniture glide',
    'patas de repuesto', 'replacement legs', 'pata', 'leg only', 'muelles', 'spring',
  ],
  tables: [
    'protector de mesa', 'table protector', 'mantel', 'tablecloth', 'patas de mesa', 'table legs', 'leg only', 'solo patas', 'tablero solo',
    'table top only', 'glass top only', 'vidrio de repuesto', 'contera', 'leg caps', 'furniture pad',
  ],
  mirrors: ['pegatina espejo', 'mirror sticker', 'espejo adhesivo', 'acrylic mirror sticker', 'mirror wall sticker', 'film', 'lamina espejo'],
  storage: ['etiqueta', 'label', 'divisor', 'divider insert'],
  decor: ['peana', 'stand only', 'solo soporte'],
  textiles: ['relleno', 'insert only', 'cushion insert', 'pillow insert', 'gancho', 'hook', 'anilla', 'curtain ring', 'barra', 'rod'],
  tableware: ['tapa de repuesto', 'replacement lid'],
};

/**
 * Brand, designer and protected design names. Listings that use them are
 * excluded: either misuse of third-party trademarks or likely replicas of
 * protected designs. Extend via BRAND_BLOCKLIST_EXTRA.
 */
export const PROTECTED_NAMES: string[] = [
  // Retailers we compare against
  'ikea', 'zara', 'zara home', 'kave home', 'kavehome', 'sklum', 'maisons du monde', 'westwing', 'leroy merlin', 'el corte ingles', 'h&m home',
  // Luxury & fashion houses
  'louis vuitton', 'gucci', 'chanel', 'dior', 'hermes', 'prada', 'fendi', 'balenciaga', 'versace', 'burberry', 'cartier', 'rolex',
  'tiffany', 'bottega veneta', 'saint laurent', 'yves saint laurent', 'celine', 'loewe', 'valentino', 'givenchy', 'moncler',
  // Design brands & designers
  'muuto', 'vitra', 'eames', 'flos', 'artemide', 'louis poulsen', 'tom dixon', 'gubi', 'andtradition', '&tradition', 'ferm living',
  'kartell', 'fermob', 'moooi', 'foscarini', 'santa cole', 'santa & cole', 'marset', 'vibia', 'normann copenhagen', 'bang olufsen',
  'georg jensen', 'iittala', 'marimekko', 'alessi', 'cassina', 'knoll', 'herman miller', 'fritz hansen', 'carl hansen', 'arne jacobsen',
  'verner panton', 'panton', 'noguchi', 'akari', 'panthella', 'ph5', 'ph artichoke', 'flowerpot lamp', 'wishbone', 'cesca', 'marcel breuer',
  'saarinen', 'le corbusier', 'mies van der rohe', 'barcelona chair', 'swan chair', 'tulip table', 'smeg',
  'dyson', 'kitchenaid', 'le creuset', 'nespresso', 'apple', 'nike', 'adidas', 'disney', 'marvel', 'pokemon', 'hello kitty',
];

/** Explicit replica/counterfeit language. */
export const COUNTERFEIT_TERMS: string[] = [
  'replica', 'replica de', 'copy of', 'copia de', 'imitacion', 'imitation', 'fake', 'falso', 'aaa quality', 'aaa+', '1:1', '1 1 quality',
  'mirror quality', 'original quality', 'top quality replica', 'inspired by', 'inspirado en', 'designer inspired', 'dupe of', 'lookalike of',
];

export const PACK_PATTERNS: RegExp[] = [
  /\b(?:set|juego|pack|lote|kit)\s+(?:de\s+)?(\d{1,2})\b/i,
  /\b(\d{1,2})\s*(?:uds?|unidades|piezas|pzas?|pcs?|pieces|units)\b/i,
  /\b(?:set|pack)\s+of\s+(\d{1,2})\b/i,
  /\b(\d{1,2})\s*-?\s*pack\b/i,
  // "x2" but not "45 x 45 cm".
  /(?<![\d.,]\s?)\bx\s?([2-9]|1[0-2])\b(?!\s*[x×\d]|\s*(?:cm|mm|m)\b)/i,
];
