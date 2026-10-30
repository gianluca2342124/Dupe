/**
 * Lightweight HTML entity decoder (numeric + the named entities that appear
 * in European e-commerce pages). Avoids shipping a 30 KB entity table to the Worker.
 */
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', yacute: 'ý',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Yacute: 'Ý',
  agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  Agrave: 'À', Egrave: 'È', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù',
  acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  Acirc: 'Â', Ecirc: 'Ê', Icirc: 'Î', Ocirc: 'Ô', Ucirc: 'Û',
  auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', yuml: 'ÿ',
  Auml: 'Ä', Euml: 'Ë', Iuml: 'Ï', Ouml: 'Ö', Uuml: 'Ü',
  atilde: 'ã', otilde: 'õ', ntilde: 'ñ', Atilde: 'Ã', Otilde: 'Õ', Ntilde: 'Ñ',
  ccedil: 'ç', Ccedil: 'Ç', aring: 'å', Aring: 'Å', aelig: 'æ', AElig: 'Æ',
  oslash: 'ø', Oslash: 'Ø', szlig: 'ß', ordm: 'º', ordf: 'ª', deg: '°',
  iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„', ndash: '–', mdash: '—',
  hellip: '…', middot: '·', bull: '•', times: '×', divide: '÷', frac12: '½',
  frac14: '¼', frac34: '¾', sup2: '²', sup3: '³', micro: 'µ', euro: '€',
  pound: '£', yen: '¥', cent: '¢', copy: '©', reg: '®', trade: '™', sect: '§',
  para: '¶', plusmn: '±', prime: '′', Prime: '″', minus: '−', check: '✓',
};

export function decodeEntities(input: string): string {
  if (!input.includes('&')) return input;
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);?/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '';
      return String.fromCodePoint(code);
    }
    const named = NAMED[body];
    return named !== undefined ? named : match;
  });
}
