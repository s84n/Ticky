// Entwicklungswerkzeug (nicht zur Laufzeit nötig): erzeugt die 12 Pixel-Figuren aus 16×16-ASCII-Rastern.
// Aufruf: node tools/gen-pixel-figures.mjs
// Jede Zeichen-Farbe kann einer animierbaren Gruppe zugeordnet werden (leg-a, leg-b, wing, tail).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'figures', 'pixel');
const PX = 8;

/** palette: char → color | [color, group] */
function build(name, rows, palette) {
  const grid = rows.map(r => r.padEnd(16, '.').slice(0, 16));
  while (grid.length < 16) grid.unshift('.'.repeat(16));
  const groups = { body: [], 'leg-a': [], 'leg-b': [], wing: [], tail: [] };
  for (let y = 0; y < 16; y++) {
    let x = 0;
    while (x < 16) {
      const ch = grid[y][x];
      if (ch === '.' || ch === ' ') { x++; continue; }
      let len = 1;
      while (x + len < 16 && grid[y][x + len] === ch) len++;
      const p = palette[ch];
      if (!p) throw new Error(`${name}: Farbe für "${ch}" fehlt`);
      const [color, group] = Array.isArray(p) ? p : [p, 'body'];
      groups[group].push(`<rect x="${x * PX}" y="${y * PX}" width="${len * PX}" height="${PX}" fill="${color}"/>`);
      x += len;
    }
  }
  // Schatten-Outline: jede Gruppe zuerst leicht versetzt dunkel (Tiefe), dann Farbe
  const order = ['tail', 'leg-b', 'wing', 'body', 'leg-a'];
  const parts = order.filter(g => groups[g].length).map(g => {
    const rects = groups[g].join('');
    return g === 'body' ? `<g class="body">${rects}</g>` : `<g class="${g}">${rects}</g>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" shape-rendering="crispEdges">
  <title>${name}</title>
  <ellipse cx="64" cy="124" rx="40" ry="4" fill="#000" opacity=".18" shape-rendering="auto"/>
  ${parts}
</svg>
`;
}

const FIGS = {
  pixel_01: ['Block-Schweinchen', [
    '................',
    '................',
    '................',
    '.........DD.....',
    '..PPPPPPPPPPP...',
    '.PPPPPPPPPPPPP..',
    '.PPPPPPPPPPKPP..',
    'TPPPPPPPPPPPPSSS',
    'TPPPPPPPPPPPPSKS',
    '.PPPPPPPPPPPPSSS',
    '.PPPPPPPPPPPPP..',
    '.HHHHHHHHHHHHH..',
    '..aa.bb...aa.bb.',
    '..aa.bb...aa.bb.',
    '..AA.BB...AA.BB.',
    '................',
  ], { P: '#F4A6B8', D: '#D9788F', H: '#E58FA5', K: '#2B1B22', S: '#E07A95', T: ['#D9788F', 'tail'], a: ['#E58FA5', 'leg-a'], A: ['#8A4A5A', 'leg-a'], b: ['#D9788F', 'leg-b'], B: ['#6E3A48', 'leg-b'] }],

  pixel_02: ['Pixel-Huhn', [
    '................',
    '................',
    '.........RR.....',
    '........WWWR....',
    '........WKWW....',
    '........WWWWYY..',
    '........WWWWYY..',
    '..T.....WWWWR...',
    '.TTWWWWWWWWWR...',
    '.TWWWWWWWWWWW...',
    '..WWwwwwwWWWW...',
    '..WWWwwwwWWWW...',
    '...WWWWWWWWW....',
    '.....a...b......',
    '.....a...b......',
    '....aaa.bbb.....',
  ], { W: '#FAFAF5', w: ['#D9D9D0', 'wing'], R: '#E53935', Y: '#FFC107', K: '#222', T: ['#E0E0D8', 'tail'], a: ['#FF9800', 'leg-a'], b: ['#F57C00', 'leg-b'] }],

  pixel_03: ['Wollschaf', [
    '................',
    '................',
    '................',
    '...WWWWWWWW.....',
    '..WWwWWWWwWWGG..',
    '.WWWWWWWWWWWGGG.',
    '.WWWWWwWWWWGKGGE',
    '.WWwWWWWWWWGGGG.',
    '.WWWWWWWWwWWGG..',
    '.WWWWWWWWWWWW...',
    '..WWWWWWWWWWW...',
    '...aa.bb.aa.bb..',
    '...aa.bb.aa.bb..',
    '...aa.bb.aa.bb..',
    '...AA.BB.AA.BB..',
    '................',
  ], { W: '#F5F5F5', w: '#DADADA', G: '#9E9E9E', K: '#212121', E: '#757575', a: ['#8D8D8D', 'leg-a'], A: ['#424242', 'leg-a'], b: ['#7A7A7A', 'leg-b'], B: ['#333333', 'leg-b'] }],

  pixel_04: ['Kistenkobold', [
    '................',
    '................',
    '..OOOOOOOOOOOO..',
    '..ObbbbbbbbbbO..',
    '..ObBBBBBBBBbO..',
    '..ObBWKBBWKBbO..',
    '..ObBKKBBKKBbO..',
    '..ObBBBBBBBBbO..',
    '..ObBBMMMMBBbO..',
    '..ObBBBMMBBBbO..',
    '..ObbbbbbbbbbO..',
    '..OOOOOOOOOOOO..',
    '....aa....cc....',
    '....aa....cc....',
    '...aaa....ccc...',
    '................',
  ], { O: '#5D3A1A', b: '#C68B4E', B: '#A0693A', W: '#FFFFFF', K: '#1B1B1B', M: '#3E2410', a: ['#5D3A1A', 'leg-a'], c: ['#4A2E14', 'leg-b'] }],

  pixel_05: ['Pilz-Männchen', [
    '................',
    '.....RRRRRR.....',
    '...RRWWRRRRRR...',
    '..RRRWWRRRWWRR..',
    '.RRRRRRRRRWWRRR.',
    '.RRWWRRRRRRRRRR.',
    '.RRWWRRRRRRWWRR.',
    '..DDDDDDDDDDDD..',
    '....SSSSSSSS....',
    '....SKSSSSKS....',
    '....SSSMMSSS....',
    '....SSSSSSSS....',
    '.....SSSSSS.....',
    '.....a....c.....',
    '....aa....cc....',
    '................',
  ], { R: '#E53935', W: '#FFFFFF', D: '#B71C1C', S: '#F3E2C7', K: '#2B2B2B', M: '#C62828', a: ['#8D6E63', 'leg-a'], c: ['#795548', 'leg-b'] }],

  pixel_06: ['Kleiner Golem', [
    '................',
    '.....GGGGGG.....',
    '....GgGGGGgG....',
    '....GGCGGCGG....',
    '....GGGGGGGG....',
    '..mmGGGGGGGGmm..',
    '.GGGGGGGGGGGGGG.',
    '.GGgGGGGGGGGgGG.',
    '.GG.GGGmGGGG.GG.',
    '.GG.GGGGGGGG.GG.',
    '....GGGGGGGG....',
    '....aaa..ccc....',
    '....aaa..ccc....',
    '....aaa..ccc....',
    '...AAAA..ZZZZ...',
    '................',
  ], { G: '#8E8E8E', g: '#5E5E5E', C: '#4DE8FF', m: '#5D8C3E', a: ['#7A7A7A', 'leg-a'], A: ['#4A4A4A', 'leg-a'], c: ['#6E6E6E', 'leg-b'], Z: ['#3E3E3E', 'leg-b'] }],

  pixel_07: ['Kristall-Fuchs', [
    '................',
    '...........c.c..',
    '..........cccc..',
    '..........OOOO..',
    '..........OKOOW.',
    'xxx.......OOOWWK',
    'xCCx.....OOOWW..',
    'xCCCxOOOOOOOW...',
    '.xCCCOOOOOOOW...',
    '..xxOOOOOOOWW...',
    '....OOOOOOOO....',
    '....OWWWWWWO....',
    '....a.b..a.b....',
    '....a.b..a.b....',
    '....A.B..A.B....',
    '................',
  ], { O: '#FF8A3D', W: '#FFF3E6', K: '#1E1E1E', c: '#5CE1FF', x: ['#B3F2FF', 'tail'], C: ['#2EC5F0', 'tail'], a: ['#E06B22', 'leg-a'], A: ['#2B1A10', 'leg-a'], b: ['#C85A18', 'leg-b'], B: ['#2B1A10', 'leg-b'] }],

  pixel_08: ['Feuer-Fledermaus', [
    '................',
    '................',
    '......E..E......',
    '......DDDD......',
    'w....DFDDFD....w',
    'ww...DDDDDD...ww',
    'wWw..DDMMDD..wWw',
    'wWWw.DDDDDD.wWWw',
    'wWyWwDDDDDDwWyWw',
    '.wWyWwDDDDwWyWw.',
    '..wWWWwDDwWWWw..',
    '...w.w.DD.w.w...',
    '.......d.d......',
    '................',
    '................',
    '................',
  ], { E: '#3B2A4F', D: '#4A3366', F: '#FFE14D', M: '#FFFFFF', d: '#2A1D3A', w: ['#D84315', 'wing'], W: ['#FF7043', 'wing'], y: ['#FFCA28', 'wing'] }],

  pixel_09: ['Smaragd-Schildkröte', [
    '................',
    '................',
    '................',
    '................',
    '.....EEEEEE.....',
    '....EeEEEEeE....',
    '...EEEgEEgEEE.HH',
    '..EEeEEEEEEeEHKH',
    '..EEEEgEEgEEEHHH',
    '..EEEEEEEEEEEHH.',
    '.tRRRRRRRRRRRR..',
    '..RRRRRRRRRRRR..',
    '...aa.bb..aa.bb.',
    '...aa.bb..aa.bb.',
    '................',
    '................',
  ], { E: '#10B981', e: '#6EE7B7', g: '#ECFDF5', R: '#047857', H: '#A3E635', K: '#1A1A1A', t: ['#84CC16', 'tail'], a: ['#84CC16', 'leg-a'], b: ['#65A30D', 'leg-b'] }],

  pixel_10: ['Diamant-Drache', [
    '................',
    '..w.........Y.Y.',
    '..wW.......DDDD.',
    '..wWW......DKDDd',
    '..wWWW....DDDDdd',
    '..wWWWW..SDDD...',
    '..wWWWWWSDDD....',
    '...wWWWDDDD.....',
    '.....SDDLDD.....',
    'tt..SDDLLDD.....',
    '.tSDDDDLLDDa....',
    '..tDDDDDDDDa....',
    '...tt.DD.D......',
    '.....bb..aa.....',
    '................',
    '................',
  ], { D: '#38D9F5', L: '#FFE68A', d: '#1BA9C9', K: '#0B2A33', Y: '#FFD34D', S: '#FFC21A', w: ['#7DE8FF', 'wing'], W: ['#C9F6FF', 'wing'], t: ['#1BA9C9', 'tail'], a: ['#1BA9C9', 'leg-a'], b: ['#168AA5', 'leg-b'] }],

  pixel_11: ['Obsidian-Phönix', [
    '.......FF.......',
    '......FffF......',
    '.......KK.......',
    'w.....KKKK.....w',
    'ww...KEKKEK...ww',
    'wWw..KKBBKK..wWw',
    'wWWw.KkBBkK.wWWw',
    'wWyWwKKKKKKwWyWw',
    '.wWyWKKkkKKWyWw.',
    '..wWWKKkkKKWWw..',
    '...wwKKKKKKww...',
    '.....KKKKKK.....',
    '......a..b......',
    '.....TtTtTt.....',
    '......TtTt......',
    '.......tt.......',
  ], { K: '#2A1B3D', k: '#4B2E6B', E: '#FF4FD8', B: '#FFB020', F: '#B14CFF', f: '#FF8AE6', w: ['#6B21A8', 'wing'], W: ['#A855F7', 'wing'], y: ['#F0ABFC', 'wing'], T: ['#B14CFF', 'tail'], t: ['#FF4FD8', 'tail'], a: ['#FFB020', 'leg-a'], b: ['#E08A00', 'leg-b'] }],

  pixel_12: ['Sternen-Axolotl', [
    '................',
    '................',
    '................',
    '..........G.G...',
    '.........GgGgG..',
    '........NNNNNNG.',
    '.......NNNNKNNNg',
    'tt....NNYNNNNNN.',
    'tTt.NNNNNNNNMNN.',
    '.tTNNNYNNNNNNN..',
    '..TNNNNNNNYNNN..',
    '...NNNNNNNNNN...',
    '...nnnnnnnnnn...',
    '....aa..bb.aa.bb',
    '....AA..BB.AA.BB',
    '................',
  ], { N: '#2B3A9E', n: '#5B6CE0', Y: '#FFE14D', K: '#0B0F2E', M: '#FF6FD8', G: '#FF6FD8', g: '#FFC2F1', t: ['#5B6CE0', 'tail'], T: ['#2B3A9E', 'tail'], a: ['#2B3A9E', 'leg-a'], A: ['#FF6FD8', 'leg-a'], b: ['#1F2B80', 'leg-b'], B: ['#E055BE', 'leg-b'] }],
};

mkdirSync(OUT, { recursive: true });
for (const [id, [name, rows, palette]] of Object.entries(FIGS)) {
  writeFileSync(join(OUT, `${id}.svg`), build(name, rows, palette));
}
console.log(`${Object.keys(FIGS).length} Pixel-Figuren erzeugt in ${OUT}`);
