/**
 * Detects bot-protection / access-denied pages so we can report "the store
 * does not allow automatic reading" instead of extracting garbage.
 *
 * Detection only — Gemelu never attempts to solve or evade these challenges.
 */
export type BlockKind =
  | 'cloudflare'
  | 'akamai'
  | 'datadome'
  | 'perimeterx'
  | 'imperva'
  | 'amazon_captcha'
  | 'generic_captcha'
  | 'access_denied'
  | 'rate_limited';

const SIGNATURES: { kind: BlockKind; re: RegExp }[] = [
  { kind: 'cloudflare', re: /cf-chl-|challenge-platform|<title>\s*Just a moment\.\.\.\s*<\/title>|cf_chl_opt|Attention Required! \| Cloudflare/i },
  { kind: 'datadome', re: /captcha-delivery\.com|var dd=\{'rt'|datadome/i },
  { kind: 'perimeterx', re: /px-captcha|_pxAppId|perimeterx/i },
  { kind: 'imperva', re: /_Incapsula_Resource|incapsula incident/i },
  { kind: 'amazon_captcha', re: /\/errors\/validateCaptcha|Type the characters you see in this image|api-services-support@amazon\.com/i },
  { kind: 'akamai', re: /errors\.edgesuite\.net|<title>\s*Access Denied\s*<\/title>[\s\S]{0,400}Reference&#32;&#35;/i },
  { kind: 'generic_captcha', re: /g-recaptcha|hcaptcha\.com\/1\/api|turnstile\/v0\/api\.js[\s\S]{0,2000}(verify you are human|are you a robot)/i },
  { kind: 'access_denied', re: /<title>\s*(Access Denied|403 Forbidden|Forbidden|Request Rejected)\s*<\/title>/i },
];

export function detectBlock(status: number, html: string): BlockKind | null {
  const head = html.length > 60_000 ? html.slice(0, 60_000) : html;
  for (const { kind, re } of SIGNATURES) {
    if (re.test(head)) {
      // Large pages that merely embed reCAPTCHA (newsletter forms…) are fine.
      if (kind === 'generic_captcha' && status === 200 && html.length > 150_000) continue;
      return kind;
    }
  }
  if (status === 429) return 'rate_limited';
  if (status === 403 || status === 401) return 'access_denied';
  return null;
}
