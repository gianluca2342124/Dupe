/**
 * Synthetic store pages for tests and FETCH_MODE=fixtures.
 *
 * They mimic the *structure* real stores use (observed October 2026: IKEA
 * JSON-LD Product + BreadcrumbList, Westwing @graph + og:image:url, bot walls
 * from Akamai…) with fictional products, prices and images. They are never
 * shown as real products: FETCH_MODE=fixtures is for tests only.
 */

const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

const page = (head: string, body = '') =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8">${head}</head><body>${body}${'<div class="filler">'.repeat(3)}${'</div>'.repeat(3)}</body></html>`;

export const FIXTURE_PAGES: Record<string, { status?: number; html: string }> = {
  // 1) IKEA-like page: rich JSON-LD Product (at the end of the body) + breadcrumbs.
  'https://www.ikea.com/es/es/p/fixture-lampara-mesa-vidrio-opalo-00000001/': {
    html: page(
      `<title>FIXTURE lámpara de mesa, blanco ópalo vidrio/latón, 39 cm - IKEA</title>
<meta property="og:title" content="FIXTURE lámpara de mesa, blanco ópalo vidrio/latón, 39 cm - IKEA"/>
<meta property="og:type" content="product"/>
<meta property="og:image" content="https://www.ikea.com/es/es/images/products/fixture-lampara__0000001_pe000001_s5.jpg"/>`,
      `<h1>FIXTURE lámpara de mesa</h1>${'<p>Texto de relleno de la ficha de producto.</p>'.repeat(200)}${ld({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Productos', item: 'https://www.ikea.com/es/es/cat/productos-products/' },
          { '@type': 'ListItem', position: 2, name: 'Iluminación', item: 'https://www.ikea.com/es/es/cat/iluminacion-li001/' },
          { '@type': 'ListItem', position: 3, name: 'Lámparas de mesa', item: 'https://www.ikea.com/es/es/cat/lamparas-mesa-10732/' },
        ],
      })}${ld({
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: 'FIXTURE Lámpara de mesa - blanco ópalo vidrio/chapado en latón 39 cm',
        description: 'Lámpara de mesa con pantalla de vidrio ópalo soplado en forma de seta y base de latón. Las bombillas se venden aparte.',
        brand: { '@type': 'Brand', name: 'IKEA' },
        category: 'Lámparas de mesa',
        color: 'blanco',
        material: 'Metal, Vidrio',
        height: '39 cm',
        depth: '30 cm',
        mpn: '000.000.01',
        image: [{ '@type': 'ImageObject', contentUrl: 'https://www.ikea.com/es/es/images/products/fixture-lampara__0000001_pe000001_s5.jpg' }],
        aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.2', reviewCount: '86' },
        review: [{ '@type': 'Review', author: { '@type': 'Person', name: 'Persona Ficticia' }, reviewBody: 'No debe guardarse.' }],
        offers: { '@type': 'Offer', availability: 'https://schema.org/InStock', price: '39.99', priceCurrency: 'EUR' },
      })}`,
    ),
  },

  // 2) Westwing-like page: @graph with WebPage + Product, og:image:url.
  'https://www.westwing.es/fixture-sillon-boucle-crema-000002.html': {
    html: page(
      `<title>Sillón con reposabrazos en tejido bouclé Fixture | Westwing</title>
<meta property="og:title" content="Sillón con reposabrazos en tejido bouclé Fixture | Westwing"/>
<meta property="og:image:url" content="https://cdn.example-cdn.com/fixture-sillon-boucle.jpg"/>
${ld({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebPage', name: 'Sillón con reposabrazos en tejido bouclé Fixture' },
    {
      '@type': 'Product',
      name: 'Sillón con reposabrazos en tejido bouclé Fixture',
      description: 'Sillón curvo tapizado en bouclé color crema con patas de madera de roble.',
      brand: { '@type': 'Brand', name: 'Westwing Collection' },
      color: 'Crema',
      image: 'https://cdn.example-cdn.com/fixture-sillon-boucle.jpg',
      offers: { '@type': 'Offer', price: 449, priceCurrency: 'EUR', availability: 'http://schema.org/InStock' },
    },
  ],
})}`,
    ),
  },

  // 3) Microdata-only page (no JSON-LD, no OG price).
  'https://www.sklum.com/es/000003-fixture-espejo-redondo-ratan.html': {
    html: page(
      `<title>Espejo redondo de ratán (Ø60 cm) Fixture - SKLUM</title>`,
      `<div itemscope itemtype="https://schema.org/Product">
  <h1 itemprop="name">Espejo de pared redondo en ratán (Ø60 cm) Fixture</h1>
  <img itemprop="image" src="https://cdn.example-cdn.com/fixture-espejo-ratan.jpg" width="800" alt="Espejo">
  <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
    <span itemprop="price" content="89.95">89,95 €</span>
    <meta itemprop="priceCurrency" content="EUR">
    <link itemprop="availability" href="https://schema.org/InStock">
  </div>
  <p itemprop="description">Espejo redondo con marco de ratán natural trenzado a mano, estilo boho. Diámetro 60 cm.</p>
</div>`,
    ),
  },

  // 4) Open Graph product tags only.
  'https://www.decoracion-ejemplo.es/producto/jarron-ceramica-estriado': {
    html: page(
      `<title>Jarrón cerámica estriado | Decoración Ejemplo</title>
<meta property="og:type" content="product"/>
<meta property="og:title" content="Jarrón de cerámica estriado blanco 30 cm"/>
<meta property="og:description" content="Jarrón decorativo de cerámica con relieve estriado. Alto 30 cm."/>
<meta property="og:image" content="https://cdn.example-cdn.com/fixture-jarron.jpg"/>
<meta property="product:price:amount" content="29,90"/>
<meta property="product:price:currency" content="EUR"/>`,
    ),
  },

  // 5) Incomplete page: title + image only, product-like path.
  'https://www.tienda-incompleta.es/p/mesa-centro-roble-redonda-80': {
    html: page(
      `<title>Mesa de centro redonda de roble 80 cm</title>`,
      `<img src="https://cdn.example-cdn.com/fixture-mesa.jpg" width="900" alt="Mesa de centro">`,
    ),
  },

  // 6) Akamai-style block (Zara Home answers like this to bots).
  'https://www.zarahome.com/es/fixture-jarron-ceramica-texturizada-l00000006': {
    status: 403,
    html: `<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY><H1>Access Denied</H1>You don't have permission to access this server.<P>Reference&#32;&#35;18&#46;0&#46;0 <P>https&#58;&#47;&#47;errors&#46;edgesuite&#46;net&#47;</BODY></HTML>`,
  },

  // 7) Rate limited.
  'https://kavehome.com/es/es/p/fixture-silla-comedor-ratan-natural': {
    status: 429,
    html: '<html><head><title>Too Many Requests</title></head><body>Too Many Requests</body></html>',
  },

  // 8) Category page (not a product).
  'https://www.ikea.com/es/es/cat/lamparas-de-mesa-10732/': {
    html: page(`<title>Lámparas de mesa - IKEA</title><meta property="og:type" content="website"/><meta property="og:title" content="Lámparas de mesa"/>`),
  },

  // 9) Amazon CAPTCHA wall.
  'https://www.amazon.es/dp/B0FIXTURE1': {
    status: 503,
    html: '<html><head><title>Amazon.es</title></head><body><form action="/errors/validateCaptcha"><p>Type the characters you see in this image</p></form></body></html>',
  },

  // 10) Price range (variants) via AggregateOffer.
  'https://www.decoracion-ejemplo.es/producto/funda-cojin-lino': {
    html: page(
      `<title>Funda de cojín de lino</title>${ld({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Funda de cojín de lino lavado 45x45 cm',
        image: 'https://cdn.example-cdn.com/fixture-cojin.jpg',
        color: 'Beige',
        material: 'Lino',
        offers: { '@type': 'AggregateOffer', lowPrice: '19.90', highPrice: '29.90', priceCurrency: 'EUR', offerCount: 3 },
      })}`,
    ),
  },
};
