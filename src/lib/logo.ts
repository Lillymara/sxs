// The site's logo: a plus sign splitting a tile into four, with a class in each quarter
// (Knight shield, Sorcerer star, Sage book, Duelist daggers). Coloured by the theme's accents.

/** The logo as SVG markup. `a`/`b` are the gradient's two colours (CSS colours or var(...)). */
export function logoSvg(a: string, b: string, id = "lmlogo", size?: number): string {
  const dims = size ? ` width="${size}" height="${size}"` : "";
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"${dims} aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:${a}"/><stop offset="1" style="stop-color:${b}"/></linearGradient></defs>${BODY.replace(/ID/g, id)}</svg>`;
}

const BODY = `<rect width="100" height="100" rx="24" fill="url(#ID)"/>
<g fill="#fff">
<rect x="46.5" y="10" width="7" height="80" rx="3.5"/>
<rect x="10" y="46.5" width="80" height="7" rx="3.5"/>
<rect x="42" y="42" width="16" height="16" rx="2.5" transform="rotate(45 50 50)"/>
<rect x="46" y="46" width="8" height="8" rx="1.2" transform="rotate(45 50 50)" fill="url(#ID)"/>
<path d="M17 18 L28 14.5 L39 18 V27 C39 34 34 38.5 28 41 C22 38.5 17 34 17 27 Z"/>
<path d="M28 19 V36 M21.5 25.5 H34.5" stroke="url(#ID)" stroke-width="3" stroke-linecap="round"/>
<path d="M72 13 C73.4 22.6 76.4 25.6 86 27 C76.4 28.4 73.4 31.4 72 41 C70.6 31.4 67.6 28.4 58 27 C67.6 25.6 70.6 22.6 72 13Z"/>
<path d="M84 13 C84.5 15.6 85.4 16.5 88 17 C85.4 17.5 84.5 18.4 84 21 C83.5 18.4 82.6 17.5 80 17 C82.6 16.5 83.5 15.6 84 13Z"/>
<path d="M15.5 68 C20.5 65.5 25 65.8 28 68.5 V86 C25 83.5 20.5 83.3 15.5 85.5 Z M40.5 68 C35.5 65.5 31 65.8 28 68.5 V86 C31 83.5 35.5 83.3 40.5 85.5 Z"/>
<path d="M28 67.5 V60" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>
<path d="M28 62 C28 58 31 56 35 56.5 C35 60.5 32 62.5 28 62Z"/>
<path d="M28 63.5 C27.5 60.5 25 59 21.5 59.5 C21.7 62.7 24.3 64 28 63.5Z"/>
<g transform="translate(72 73) rotate(-38)">
<path d="M0 -16 L2.4 -11.5 V3 H-2.4 V-11.5 Z"/><rect x="-6.5" y="3" width="13" height="2.8" rx="1.4"/><rect x="-1.4" y="5.8" width="2.8" height="6.5" rx="1.2"/><circle cx="0" cy="13.8" r="2"/>
</g>
<g transform="translate(72 73) rotate(38)">
<path d="M0 -16 L2.4 -11.5 V3 H-2.4 V-11.5 Z"/><rect x="-6.5" y="3" width="13" height="2.8" rx="1.4"/><rect x="-1.4" y="5.8" width="2.8" height="6.5" rx="1.2"/><circle cx="0" cy="13.8" r="2"/>
</g>
</g>`;
