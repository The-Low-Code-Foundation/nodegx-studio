// Six flat plant illustrations, one style: a tinted backdrop, a terracotta pot, the plant. Writes art/<slug>.svg
import { mkdirSync, writeFileSync } from 'node:fs';
const G = { deep: '#1F4D3A', mid: '#2F6B4F', leaf: '#3F8560', light: '#6FA27E', pale: '#A9C9A4' };
const pot = (tint) => `
  <ellipse cx="200" cy="386" rx="92" ry="10" fill="#000" opacity=".07"/>
  <path d="M146 300 L254 300 L240 382 Q239 388 232 388 L168 388 Q161 388 160 382 Z" fill="#C8643B"/>
  <path d="M200 300 L254 300 L240 382 Q239 388 232 388 L200 388 Z" fill="#B3552F"/>
  <rect x="134" y="284" width="132" height="26" rx="7" fill="#D9825C"/>
  <rect x="200" y="284" width="66" height="26" rx="7" fill="#C8643B" opacity=".55"/>`;
const leaf = (x, y, len, w, a, fill, rib = true) => `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0 C ${w} ${-len * 0.25} ${w * 0.85} ${-len * 0.8} 0 ${-len} C ${-w * 0.85} ${-len * 0.8} ${-w} ${-len * 0.25} 0 0Z" fill="${fill}"/>${rib ? `<path d="M0 -4 L0 ${-len * 0.92}" stroke="#fff" stroke-opacity=".28" stroke-width="2.5" stroke-linecap="round"/>` : ''}</g>`;
let clipN = 0;
const monsteraLeaf = (x, y, s, a, fill, bg) => { const id = `ml${++clipN}`; const d = 'M0 0 C 62 -6 92 -70 52 -118 C 34 -138 -34 -138 -52 -118 C -92 -70 -62 -6 0 0Z'; return `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${fill}"/><g clip-path="url(#${id})">
  ${[[-1, -30], [-1, -62], [-1, -92], [1, -30], [1, -62], [1, -92]].map(([d, yy]) => `<path d="M${d * 72} ${yy - 6} L${d * 26} ${yy + 6}" stroke="${bg}" stroke-width="7" stroke-linecap="round"/>`).join('')}
  <ellipse cx="-22" cy="-74" rx="5" ry="9" fill="${bg}"/><ellipse cx="22" cy="-74" rx="5" ry="9" fill="${bg}"/>
  <path d="M0 -6 L0 -112" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/></g></g>`; };
const stem = (x1, y1, x2, y2, c = G.mid) => `<path d="M${x1} ${y1} Q ${(x1 + x2) / 2 + (x2 - x1) * 0.2} ${(y1 + y2) / 2 + 30} ${x2} ${y2}" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
const svg = (tint, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><rect width="400" height="400" fill="${tint}"/><circle cx="200" cy="200" r="150" fill="#fff" opacity=".35"/>${body}</svg>\n`;

const art = {
  monstera: svg('#DCE8DA', `${stem(190, 290, 126, 182)}${stem(205, 290, 278, 174)}${stem(200, 290, 204, 136)}
    ${monsteraLeaf(126, 182, 0.8, -38, G.mid, '#E8F0E6')}${monsteraLeaf(278, 174, 0.82, 36, G.leaf, '#E8F0E6')}${monsteraLeaf(204, 136, 0.78, 2, G.deep, '#E8F0E6')}${pot()}`),
  snake: svg('#EFE6D2', `${[[-34, 150, -14, G.deep], [-12, 205, -4, G.mid], [10, 225, 3, G.deep], [30, 170, 12, G.leaf], [48, 120, 22, G.mid], [-52, 110, -24, G.leaf]].map(([dx, len, a, c]) => `<g transform="translate(${200 + dx} 292) rotate(${a})"><path d="M0 0 C 18 ${-len * 0.35} 14 ${-len * 0.8} 0 ${-len} C -14 ${-len * 0.8} -18 ${-len * 0.35} 0 0Z" fill="${c}" stroke="#C9C46A" stroke-width="3"/>${[0.25, 0.45, 0.65].map((t) => `<path d="M-11 ${-len * t} Q0 ${-len * t - 8} 11 ${-len * t}" stroke="#fff" stroke-opacity=".22" stroke-width="3" fill="none"/>`).join('')}</g>`).join('')}${pot()}`),
  pothos: svg('#F3DED2', `${pot()}
    <path d="M160 292 C 120 300 108 340 116 380" stroke="${G.mid}" stroke-width="4" fill="none"/><path d="M244 292 C 290 304 300 330 292 372" stroke="${G.mid}" stroke-width="4" fill="none"/>
    ${[[122, 330, 30, 200], [114, 368, 26, 170], [286, 336, 28, 150], [294, 366, 24, 190]].map(([x, y, l, a]) => leaf(x, y, l, 26, a, G.leaf)).join('')}
    ${[[200, 286, 110, 34, -42, G.mid], [200, 286, 130, 38, -14, G.deep], [200, 286, 118, 36, 18, G.leaf], [200, 286, 96, 32, 50, G.mid], [200, 286, 88, 30, -70, G.light], [200, 286, 136, 32, 4, G.light], [200, 286, 84, 30, 74, G.leaf]].map(([x, y, l, w, a, c]) => leaf(x, y, l, w, a, c)).join('')}`),
  fiddle: svg('#E4E0EE', `<path d="M200 292 L200 120" stroke="#7A5A3F" stroke-width="7" stroke-linecap="round"/>
    ${[[200, 250, -52, G.mid], [200, 232, 50, G.leaf], [200, 196, -48, G.deep], [200, 178, 46, G.mid], [200, 140, -30, G.leaf], [200, 124, 22, G.deep], [200, 118, -4, G.mid]].map(([x, y, a, c]) => `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0 C 30 -6 44 -40 34 -62 C 28 -80 -28 -80 -34 -62 C -44 -40 -30 -6 0 0Z" fill="${c}"/><path d="M0 -4 L0 -66" stroke="#fff" stroke-opacity=".25" stroke-width="2.5"/></g>`).join('')}${pot()}`),
  cactus: svg('#F5E7C8', `<rect x="176" y="120" width="48" height="176" rx="24" fill="${G.leaf}"/><rect x="200" y="120" width="24" height="176" rx="12" fill="${G.mid}" opacity=".5"/>
    <path d="M178 220 L150 220 Q138 220 138 208 L138 172" stroke="${G.leaf}" stroke-width="26" stroke-linecap="round" fill="none"/><path d="M222 196 L250 196 Q262 196 262 184 L262 152" stroke="${G.mid}" stroke-width="26" stroke-linecap="round" fill="none"/>
    ${[[188, 150], [212, 170], [188, 196], [212, 226], [188, 252], [140, 186], [262, 166]].map(([x, y]) => `<g stroke="#F5E7C8" stroke-width="2" stroke-linecap="round"><path d="M${x - 4} ${y} l-5 -3"/><path d="M${x + 4} ${y} l5 -3"/></g>`).join('')}
    <circle cx="200" cy="116" r="10" fill="#E77F8E"/><circle cx="200" cy="116" r="4" fill="#F7C9A0"/>${pot()}`),
  lily: svg('#DDE7EB', `${[[-46, 120, -28, G.mid], [-18, 150, -10, G.deep], [14, 140, 8, G.leaf], [44, 118, 30, G.mid], [0, 104, -46, G.light], [0, 104, 50, G.light]].map(([dx, l, a, c]) => leaf(200 + dx * 0.3, 290, l, 30, a, c)).join('')}
    <path d="M206 290 L214 150" stroke="${G.mid}" stroke-width="4"/><path d="M214 150 C 236 140 240 104 216 86 C 196 104 192 138 214 150Z" fill="#FBFBF6" stroke="#E6E8DF" stroke-width="2"/><rect x="211" y="112" width="7" height="30" rx="3.5" fill="#E8D36B"/>
    <path d="M190 290 L176 168" stroke="${G.mid}" stroke-width="4"/><path d="M176 168 C 156 160 150 130 170 112 C 190 126 194 154 176 168Z" fill="#FBFBF6" stroke="#E6E8DF" stroke-width="2"/>${pot()}`)
};
mkdirSync(new URL('./art/', import.meta.url), { recursive: true });
for (const [k, s] of Object.entries(art)) writeFileSync(new URL(`./art/${k}.svg`, import.meta.url), s);
// a contact sheet to look at
writeFileSync(new URL('./art/sheet.html', import.meta.url), `<body style="margin:0;display:grid;grid-template-columns:repeat(3,300px);gap:8px;background:#F6F3EC">${Object.keys(art).map((k) => `<img src="${k}.svg" width="300">`).join('')}</body>`);
console.log(Object.keys(art).join(' '));
