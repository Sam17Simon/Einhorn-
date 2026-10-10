/* Inselwelt: zehn Inseln, zehn Tierfreunde, Ausbau-Objekte. Alles SVG im Lumi-Stil
   (Kontur #3B2A52, Pastellfüllungen, runde Formen). Koordinatenraum je Insel 0..240 x 0..200.
   Tiere liegen in einem 100x100-Kasten, Füße auf y=92, Mitte x=50. */
(function(){
'use strict';
const INK='#3B2A52', BLUSH='#F8C8D8';

/* ---------- Tiere ---------- */
const ANIMALS={
  kueken:{name:'Küken Piep', draw:()=>`
    <ellipse cx="50" cy="62" rx="26" ry="24" fill="#FFE27A" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="52" cy="38" r="18" fill="#FFE27A" stroke="${INK}" stroke-width="3.5"/>
    <path d="M40 22 q4 -8 8 0 q4 -8 8 0" fill="#FFE27A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M30 60 q-12 4 -6 14 q8 -2 10 -10 Z" fill="#FFD24A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="60" cy="36" r="3" fill="${INK}"/><circle cx="61" cy="35" r="1" fill="#fff"/>
    <path d="M68 42 l10 3 l-10 4 Z" fill="#F7A33A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="66" cy="46" rx="4" ry="2.6" fill="${BLUSH}"/>
    <path d="M42 86 v8 M38 94 h8 M58 86 v8 M54 94 h8" stroke="#F7A33A" stroke-width="3.5" stroke-linecap="round"/>`},
  eule:{name:'Eule Luna', draw:()=>`
    <path d="M30 34 l-6 -20 l18 10 Z M70 34 l6 -20 l-18 10 Z" fill="#B493F0" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M24 44 q0 -26 26 -26 q26 0 26 26 v26 q0 22 -26 22 q-26 0 -26 -22 Z" fill="#B493F0" stroke="${INK}" stroke-width="3.5"/>
    <path d="M36 54 q14 -10 28 0 v28 q-14 10 -28 0 Z" fill="#EFE6FC" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="40" cy="42" r="10" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="60" cy="42" r="10" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="41" cy="43" r="4" fill="${INK}"/><circle cx="61" cy="43" r="4" fill="${INK}"/><circle cx="42.5" cy="41.5" r="1.3" fill="#fff"/><circle cx="62.5" cy="41.5" r="1.3" fill="#fff"/>
    <path d="M46 52 l4 6 l4 -6 Z" fill="#F7A33A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 92 l-4 4 M40 92 l4 4 M60 92 l-4 4 M60 92 l4 4" stroke="#F7A33A" stroke-width="3.5" stroke-linecap="round"/>`},
  frosch:{name:'Frosch Hüpf', draw:()=>`
    <ellipse cx="50" cy="70" rx="30" ry="22" fill="#8FD6B0" stroke="${INK}" stroke-width="3.5"/>
    <ellipse cx="50" cy="48" rx="28" ry="20" fill="#8FD6B0" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="36" cy="32" r="9" fill="#8FD6B0" stroke="${INK}" stroke-width="3"/><circle cx="64" cy="32" r="9" fill="#8FD6B0" stroke="${INK}" stroke-width="3"/>
    <circle cx="36" cy="32" r="5" fill="#fff"/><circle cx="64" cy="32" r="5" fill="#fff"/><circle cx="37" cy="33" r="2.5" fill="${INK}"/><circle cx="65" cy="33" r="2.5" fill="${INK}"/>
    <path d="M38 54 q12 10 24 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="30" cy="50" rx="4" ry="2.6" fill="${BLUSH}"/><ellipse cx="70" cy="50" rx="4" ry="2.6" fill="${BLUSH}"/>
    <path d="M22 84 q-8 10 4 10 h10 M78 84 q8 10 -4 10 h-10" fill="#8FD6B0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`},
  hase:{name:'Hase Mümmel', draw:()=>`
    <path d="M36 44 q-10 -34 4 -34 q8 0 8 30 M64 44 q10 -34 -4 -34 q-8 0 -8 30" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M40 40 q-6 -24 2 -24 q4 0 4 22 M60 40 q6 -24 -2 -24 q-4 0 -4 22" fill="${BLUSH}"/>
    <ellipse cx="50" cy="72" rx="24" ry="20" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="50" cy="46" r="20" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="43" cy="44" r="3" fill="${INK}"/><circle cx="57" cy="44" r="3" fill="${INK}"/><circle cx="44" cy="43" r="1" fill="#fff"/><circle cx="58" cy="43" r="1" fill="#fff"/>
    <ellipse cx="50" cy="52" rx="3" ry="2" fill="#F6A0B8"/><path d="M47 56 q3 3 6 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="37" cy="52" rx="4" ry="2.6" fill="${BLUSH}"/><ellipse cx="63" cy="52" rx="4" ry="2.6" fill="${BLUSH}"/>
    <ellipse cx="38" cy="90" rx="9" ry="5" fill="#fff" stroke="${INK}" stroke-width="3"/><ellipse cx="62" cy="90" rx="9" ry="5" fill="#fff" stroke="${INK}" stroke-width="3"/>`},
  fuchs:{name:'Fuchs Flux', draw:()=>`
    <path d="M14 86 q-10 -18 10 -22 q10 4 6 22 Z" fill="#F9A066" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M16 72 q4 4 4 10" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="52" cy="72" rx="26" ry="20" fill="#F9A066" stroke="${INK}" stroke-width="3.5"/>
    <ellipse cx="52" cy="80" rx="14" ry="10" fill="#fff"/>
    <path d="M30 42 l2 -22 l16 14 M74 42 l-2 -22 l-16 14" fill="#F9A066" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M30 44 q22 -14 44 0 q4 16 -22 28 q-26 -12 -22 -28 Z" fill="#F9A066" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M40 54 q12 -6 24 0 q-2 12 -12 16 q-10 -4 -12 -16 Z" fill="#fff"/>
    <circle cx="43" cy="48" r="3" fill="${INK}"/><circle cx="61" cy="48" r="3" fill="${INK}"/>
    <ellipse cx="52" cy="64" rx="3.5" ry="2.5" fill="${INK}"/>
    <path d="M40 92 v4 M48 92 v4 M56 92 v4 M64 92 v4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`},
  schildi:{name:'Schildi Panzi', draw:()=>`
    <path d="M22 76 q0 -30 28 -30 q28 0 28 30 Z" fill="#8FD6B0" stroke="${INK}" stroke-width="3.5"/>
    <path d="M34 72 q16 -22 32 0 M26 76 q6 -10 12 -4 M74 76 q-6 -10 -12 -4" fill="none" stroke="${INK}" stroke-width="2.5" opacity=".55"/>
    <ellipse cx="50" cy="80" rx="32" ry="10" fill="#BFE9D2" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="82" cy="70" r="11" fill="#BFE9D2" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="85" cy="67" r="2.6" fill="${INK}"/><path d="M86 74 q3 1 5 -1" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="80" cy="73" rx="3.5" ry="2.2" fill="${BLUSH}"/>
    <ellipse cx="30" cy="90" rx="8" ry="4" fill="#BFE9D2" stroke="${INK}" stroke-width="3"/><ellipse cx="62" cy="90" rx="8" ry="4" fill="#BFE9D2" stroke="${INK}" stroke-width="3"/>`},
  falter:{name:'Falter Flora', draw:()=>`
    <path d="M48 56 q-26 -34 -32 -6 q-2 14 12 16 q-16 4 -8 18 q8 10 28 -8 Z" fill="#F8A0C8" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M52 56 q26 -34 32 -6 q2 14 -12 16 q16 4 8 18 q-8 10 -28 -8 Z" fill="#F8A0C8" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="34" cy="48" r="6" fill="#B493F0"/><circle cx="66" cy="48" r="6" fill="#B493F0"/><circle cx="36" cy="70" r="4" fill="#FFE27A"/><circle cx="64" cy="70" r="4" fill="#FFE27A"/>
    <ellipse cx="50" cy="62" rx="7" ry="22" fill="#B493F0" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="50" cy="38" r="9" fill="#B493F0" stroke="${INK}" stroke-width="3.5"/>
    <path d="M45 30 q-4 -8 -8 -8 M55 30 q4 -8 8 -8" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="47" cy="37" r="2" fill="${INK}"/><circle cx="53" cy="37" r="2" fill="${INK}"/><path d="M47 42 q3 2 6 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`},
  delfin:{name:'Delfin Dido', draw:()=>`
    <path d="M14 70 q10 -34 50 -30 q24 2 26 20 q-6 8 -16 4 q-10 22 -40 22 q-14 0 -20 -16 Z" fill="#8CC6F4" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M48 42 q6 -16 18 -12 q-8 6 -8 14 Z" fill="#8CC6F4" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M14 70 q-8 -8 -8 -18 q8 4 12 12 M14 70 q-10 4 -8 14 q8 -6 12 -8" fill="#8CC6F4" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M30 76 q22 10 46 -2" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>
    <circle cx="72" cy="52" r="3" fill="${INK}"/><circle cx="73" cy="51" r="1" fill="#fff"/>
    <path d="M80 62 q4 2 8 -2" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="70" cy="60" rx="4" ry="2.5" fill="${BLUSH}"/>`},
  panda:{name:'Panda Pom', draw:()=>`
    <ellipse cx="50" cy="74" rx="26" ry="20" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
    <ellipse cx="30" cy="80" rx="9" ry="12" fill="${INK}"/><ellipse cx="70" cy="80" rx="9" ry="12" fill="${INK}"/>
    <circle cx="32" cy="30" r="9" fill="${INK}"/><circle cx="68" cy="30" r="9" fill="${INK}"/>
    <circle cx="50" cy="46" r="22" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
    <ellipse cx="41" cy="44" rx="7" ry="8" fill="${INK}" transform="rotate(-15 41 44)"/><ellipse cx="59" cy="44" rx="7" ry="8" fill="${INK}" transform="rotate(15 59 44)"/>
    <circle cx="42" cy="44" r="2.6" fill="#fff"/><circle cx="58" cy="44" r="2.6" fill="#fff"/>
    <ellipse cx="50" cy="54" rx="3.5" ry="2.5" fill="${INK}"/><path d="M46 58 q4 3 8 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="35" cy="54" rx="4" ry="2.6" fill="${BLUSH}"/><ellipse cx="65" cy="54" rx="4" ry="2.6" fill="${BLUSH}"/>`},
  drache:{name:'Drache Dax', draw:()=>`
    <path d="M22 82 q-16 -6 -14 -20 q10 8 18 6" fill="#B493F0" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M34 62 q-14 -24 -2 -30 q6 12 10 20 M66 62 q14 -24 2 -30 q-6 12 -10 20" fill="#F8A0C8" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <ellipse cx="50" cy="72" rx="26" ry="20" fill="#B493F0" stroke="${INK}" stroke-width="3.5"/>
    <ellipse cx="50" cy="78" rx="14" ry="11" fill="#E7DDF5"/>
    <circle cx="50" cy="44" r="22" fill="#B493F0" stroke="${INK}" stroke-width="3.5"/>
    <path d="M38 24 l-4 -12 l10 6 M62 24 l4 -12 l-10 6" fill="#FFE27A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="42" cy="42" r="3.5" fill="${INK}"/><circle cx="58" cy="42" r="3.5" fill="${INK}"/><circle cx="43" cy="41" r="1.2" fill="#fff"/><circle cx="59" cy="41" r="1.2" fill="#fff"/>
    <path d="M44 54 q6 5 12 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="47" cy="50" r="1.5" fill="${INK}"/><circle cx="53" cy="50" r="1.5" fill="${INK}"/>
    <ellipse cx="36" cy="52" rx="4" ry="2.6" fill="${BLUSH}"/><ellipse cx="64" cy="52" rx="4" ry="2.6" fill="${BLUSH}"/>
    <ellipse cx="38" cy="90" rx="8" ry="4" fill="#B493F0" stroke="${INK}" stroke-width="3"/><ellipse cx="62" cy="90" rx="8" ry="4" fill="#B493F0" stroke="${INK}" stroke-width="3"/>`}
};

/* ---------- Ausbau-Objekte (je in einem 80x80-Kasten, Boden auf y=76, Mitte x=40) ---------- */
const BUILDS={
  huhnhaus:{name:'Hühnerhäuschen', draw:()=>`<path d="M14 40 l26 -22 l26 22 v34 h-52 Z" fill="#F9D7A0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M8 42 l32 -28 l32 28" fill="none" stroke="#E07AA8" stroke-width="5" stroke-linecap="round"/><rect x="31" y="50" width="18" height="24" rx="4" fill="#B7793C" stroke="${INK}" stroke-width="2.5"/><circle cx="40" cy="38" r="5" fill="#FFE27A" stroke="${INK}" stroke-width="2.2"/>`},
  sonnenblume:{name:'Sonnenblume', draw:()=>`<path d="M40 76 v-34" stroke="#5FB98C" stroke-width="4" stroke-linecap="round"/><path d="M40 60 q-14 -2 -12 10 q10 2 12 -10 M40 54 q14 -2 12 10 q-10 2 -12 -10" fill="#8FD6B0" stroke="${INK}" stroke-width="2.2"/>${[0,45,90,135,180,225,270,315].map(a=>`<ellipse cx="40" cy="14" rx="5" ry="9" fill="#FFE27A" stroke="${INK}" stroke-width="2" transform="rotate(${a} 40 28)"/>`).join('')}<circle cx="40" cy="28" r="8" fill="#B7793C" stroke="${INK}" stroke-width="2.5"/>`},
  zaun:{name:'Bunter Zaun', draw:()=>`${[10,25,40,55,70].map((x,i)=>`<path d="M${x-4} 76 v-30 l4 -6 l4 6 v30 Z" fill="${['#F8A0C8','#FFE27A','#8FD6B0','#B493F0','#8CC6F4'][i]}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`).join('')}<rect x="4" y="52" width="72" height="5" fill="#fff" stroke="${INK}" stroke-width="2"/><rect x="4" y="64" width="72" height="5" fill="#fff" stroke="${INK}" stroke-width="2"/>`},
  baumhaus:{name:'Baumhaus', draw:()=>`<rect x="34" y="40" width="12" height="36" fill="#B7793C" stroke="${INK}" stroke-width="2.5"/><circle cx="40" cy="30" r="24" fill="#5FB98C" stroke="${INK}" stroke-width="3"/><rect x="26" y="22" width="28" height="20" rx="3" fill="#F9D7A0" stroke="${INK}" stroke-width="2.5"/><path d="M22 24 l18 -12 l18 12 Z" fill="#E07AA8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><rect x="36" y="30" width="8" height="8" fill="#FFE27A" stroke="${INK}" stroke-width="2"/>`},
  laterne:{name:'Laterne', draw:()=>`<rect x="37" y="34" width="6" height="42" fill="${INK}"/><path d="M26 34 h28 l-4 -22 h-20 Z" fill="#FFE27A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><rect x="30" y="6" width="20" height="7" rx="2" fill="${INK}"/><circle cx="40" cy="24" r="6" fill="#fff" opacity=".9"/><circle cx="40" cy="24" r="14" fill="#FFE27A" opacity=".25"/>`},
  mondschaukel:{name:'Mondschaukel', draw:()=>`<path d="M14 76 l12 -60 M66 76 l-12 -60" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M26 16 h28" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M32 18 v30 M48 18 v30" stroke="#B493F0" stroke-width="2.5"/><path d="M28 48 q12 20 24 0" fill="#FFE27A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`},
  seerose:{name:'Seerose', draw:()=>`<ellipse cx="40" cy="66" rx="30" ry="12" fill="#8FD6B0" stroke="${INK}" stroke-width="3"/><path d="M40 66 l26 -8 l-4 10 Z" fill="#BFE9D2"/><path d="M40 60 q-16 -8 -12 -24 q12 4 12 24 M40 60 q16 -8 12 -24 q-12 4 -12 24 M40 60 q-4 -22 0 -30 q4 8 0 30" fill="#F8A0C8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="40" cy="56" r="4" fill="#FFE27A"/>`},
  schilf:{name:'Schilf', draw:()=>`${[18,30,42,54,66].map((x,i)=>`<path d="M${x} 76 q${i%2?3:-3} -30 ${i%2?6:-6} -56" fill="none" stroke="#5FB98C" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="${x+(i%2?5:-5)}" cy="${22+i*4}" rx="4" ry="10" fill="#B7793C" stroke="${INK}" stroke-width="2"/>`).join('')}`},
  steg:{name:'Holzsteg', draw:()=>`<path d="M6 50 h68 v16 h-68 Z" fill="#D9A866" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M20 50 v16 M34 50 v16 M48 50 v16 M62 50 v16" stroke="${INK}" stroke-width="2" opacity=".5"/><path d="M14 66 v10 M66 66 v10" stroke="#B7793C" stroke-width="5" stroke-linecap="round"/>`},
  moehrenbeet:{name:'Möhrenbeet', draw:()=>`<rect x="6" y="56" width="68" height="20" rx="6" fill="#B7793C" stroke="${INK}" stroke-width="3"/>${[18,34,50,66].map(x=>`<path d="M${x} 58 l-4 16 l8 0 Z" fill="#F9A066" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M${x} 56 q-6 -10 -2 -16 M${x} 56 q6 -10 2 -16 M${x} 56 v-14" fill="none" stroke="#5FB98C" stroke-width="3" stroke-linecap="round"/>`).join('')}`},
  hasenbau:{name:'Hasenbau', draw:()=>`<ellipse cx="40" cy="66" rx="34" ry="14" fill="#8FD6B0" stroke="${INK}" stroke-width="3"/><path d="M22 66 q0 -22 18 -22 q18 0 18 22 Z" fill="${INK}"/><path d="M26 66 q0 -16 14 -16 q14 0 14 16 Z" fill="#6B4A2E"/><path d="M58 50 q6 -10 12 -4 M10 56 q6 -10 12 -4" fill="none" stroke="#5FB98C" stroke-width="3" stroke-linecap="round"/>`},
  vogelscheuche:{name:'Lustige Vogelscheuche', draw:()=>`<path d="M40 76 v-50 M18 40 h44" stroke="#B7793C" stroke-width="5" stroke-linecap="round"/><path d="M26 34 h28 v18 h-28 Z" fill="#8CC6F4" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="40" cy="22" r="11" fill="#F9D7A0" stroke="${INK}" stroke-width="2.5"/><path d="M24 14 h32 l-6 -8 h-20 Z" fill="#FFE27A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="36" cy="21" r="1.8" fill="${INK}"/><circle cx="44" cy="21" r="1.8" fill="${INK}"/><path d="M36 26 q4 3 8 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`},
  hoehle:{name:'Fuchshöhle', draw:()=>`<path d="M6 76 q0 -40 34 -40 q34 0 34 40 Z" fill="#B7793C" stroke="${INK}" stroke-width="3"/><path d="M24 76 q0 -22 16 -22 q16 0 16 22 Z" fill="${INK}"/><path d="M12 50 q6 -8 12 0 M56 46 q6 -8 12 0" fill="none" stroke="#5FB98C" stroke-width="3" stroke-linecap="round"/>`},
  pilze:{name:'Pilzfamilie', draw:()=>`${[[18,0.9],[44,1.2],[64,0.7]].map(([x,s])=>`<g transform="translate(${x} 76) scale(${s})"><rect x="-6" y="-22" width="12" height="22" rx="4" fill="#FFF3D6" stroke="${INK}" stroke-width="2.5"/><path d="M-18 -20 q18 -26 36 0 Z" fill="#F96D6D" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="-7" cy="-30" r="3" fill="#fff"/><circle cx="6" cy="-26" r="2.5" fill="#fff"/></g>`).join('')}`},
  laubhaufen:{name:'Laubhaufen', draw:()=>`<path d="M4 76 q10 -30 36 -28 q26 -2 36 28 Z" fill="#F9A066" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>${[[20,62,'#F96D6D'],[36,54,'#FFE27A'],[52,58,'#E07AA8'],[60,68,'#F96D6D'],[30,70,'#FFE27A']].map(([x,y,c])=>`<path d="M${x} ${y} q6 -6 10 0 q-4 6 -10 0 Z" fill="${c}" stroke="${INK}" stroke-width="1.8"/>`).join('')}`},
  palme:{name:'Palme', draw:()=>`<path d="M36 76 q4 -40 10 -56" stroke="#B7793C" stroke-width="6" stroke-linecap="round"/><path d="M46 20 q-24 -12 -30 4 q14 -2 30 -4 M46 20 q24 -12 30 4 q-14 -2 -30 -4 M46 20 q-16 10 -18 26 q12 -10 18 -26 M46 20 q16 10 18 26 q-12 -10 -18 -26 M46 20 q0 -16 -10 -18 q4 10 10 18" fill="#5FB98C" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="44" cy="26" r="3.5" fill="#B7793C" stroke="${INK}" stroke-width="1.8"/><circle cx="51" cy="25" r="3.5" fill="#B7793C" stroke="${INK}" stroke-width="1.8"/>`},
  sonnenschirm:{name:'Sonnenschirm', draw:()=>`<path d="M40 76 v-48" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M8 32 q32 -34 64 0 Z" fill="#F8A0C8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M24 32 q16 -26 16 -26 q0 0 16 26 M8 32 q6 -10 12 -14 M72 32 q-6 -10 -12 -14" fill="#fff" stroke="${INK}" stroke-width="2"/><rect x="8" y="64" width="40" height="10" rx="4" fill="#8CC6F4" stroke="${INK}" stroke-width="2.5"/>`},
  sandburg:{name:'Sandburg', draw:()=>`<rect x="10" y="44" width="60" height="32" rx="4" fill="#F9D7A0" stroke="${INK}" stroke-width="3"/><rect x="10" y="36" width="10" height="10" fill="#F9D7A0" stroke="${INK}" stroke-width="2.5"/><rect x="35" y="36" width="10" height="10" fill="#F9D7A0" stroke="${INK}" stroke-width="2.5"/><rect x="60" y="36" width="10" height="10" fill="#F9D7A0" stroke="${INK}" stroke-width="2.5"/><rect x="30" y="16" width="20" height="28" fill="#F9D7A0" stroke="${INK}" stroke-width="2.5"/><path d="M40 16 v-10 l10 3 l-10 3" fill="#F96D6D" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M34 76 q0 -14 6 -14 q6 0 6 14 Z" fill="${INK}"/>`},
  blumen:{name:'Blumenbeet', draw:()=>`${[[14,'#F8A0C8'],[30,'#FFE27A'],[46,'#B493F0'],[62,'#8CC6F4']].map(([x,c],i)=>`<path d="M${x} 76 v-${22+i*4}" stroke="#5FB98C" stroke-width="3" stroke-linecap="round"/>${[0,72,144,216,288].map(a=>`<ellipse cx="${x}" cy="${48-i*4}" rx="4" ry="6.5" fill="${c}" stroke="${INK}" stroke-width="1.8" transform="rotate(${a} ${x} ${54-i*4})"/>`).join('')}<circle cx="${x}" cy="${54-i*4}" r="3.5" fill="#FFE27A" stroke="${INK}" stroke-width="1.6"/>`).join('')}`},
  bienenhaus:{name:'Bienenhäuschen', draw:()=>`<rect x="36" y="46" width="8" height="30" fill="#B7793C" stroke="${INK}" stroke-width="2.5"/><path d="M22 46 q0 -30 18 -30 q18 0 18 30 Z" fill="#FFE27A" stroke="${INK}" stroke-width="3"/><path d="M24 36 h32 M23 26 h34" stroke="${INK}" stroke-width="2" opacity=".5"/><circle cx="40" cy="40" r="4" fill="${INK}"/><g><ellipse cx="62" cy="22" rx="5" ry="3.5" fill="#FFE27A" stroke="${INK}" stroke-width="1.8"/><path d="M60 19 v7 M64 19 v7" stroke="${INK}" stroke-width="1.5"/><ellipse cx="60" cy="18" rx="3" ry="2" fill="#fff" opacity=".9"/></g>`},
  regenbogenbogen:{name:'Regenbogen-Tor', draw:()=>["#F96D6D","#FFE27A","#8FD6B0","#8CC6F4","#B493F0"].map((c,i)=>`<path d="M${6+i*4} 76 A${34-i*4} ${34-i*4} 0 0 1 ${74-i*4} 76" fill="none" stroke="${c}" stroke-width="4.5"/>`).join('')+`<path d="M6 76 A34 34 0 0 1 74 76" fill="none" stroke="${INK}" stroke-width="2"/>`},
  leuchtturm:{name:'Leuchtturm', draw:()=>`<path d="M28 76 l6 -56 h12 l6 56 Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M31 44 h18 M30 58 h20" stroke="#F96D6D" stroke-width="7"/><rect x="30" y="10" width="20" height="12" rx="2" fill="#FFE27A" stroke="${INK}" stroke-width="2.5"/><path d="M28 10 h24 l-2 -6 h-20 Z" fill="#F96D6D" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 16 l24 -8 v16 Z" fill="#FFE27A" opacity=".5"/>`},
  boot:{name:'Segelboot', draw:()=>`<path d="M8 60 h64 l-10 16 h-44 Z" fill="#F96D6D" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M40 60 v-50" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M42 12 l26 44 h-26 Z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M38 20 l-20 36 h20 Z" fill="#8CC6F4" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`},
  koralle:{name:'Korallenriff', draw:()=>`<path d="M16 76 q-4 -20 4 -32 q4 12 2 32 M26 76 q-2 -30 10 -40 q0 20 -2 40 M48 76 q-2 -24 8 -30 q2 16 -2 30 M64 76 q-6 -20 2 -28 q6 12 4 28" fill="#F8A0C8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="40" cy="64" r="8" fill="#FFE27A" stroke="${INK}" stroke-width="2.5"/><circle cx="36" cy="60" r="2" fill="#fff"/><path d="M20 44 q4 -6 8 0" fill="none" stroke="#B493F0" stroke-width="3" stroke-linecap="round"/>`},
  bambus:{name:'Bambushain', draw:()=>`${[16,32,48,64].map((x,i)=>`<path d="M${x} 76 v-${50+(i%2)*14}" stroke="#8FD6B0" stroke-width="7" stroke-linecap="round"/><path d="M${x-4} ${56-(i%2)*6} h8 M${x-4} ${38-(i%2)*6} h8" stroke="${INK}" stroke-width="2.5"/><path d="M${x+3} ${30-(i%2)*8} q10 -8 14 -2 q-8 4 -14 2" fill="#5FB98C" stroke="${INK}" stroke-width="2"/>`).join('')}`},
  pagode:{name:'Kleine Pagode', draw:()=>`<rect x="22" y="48" width="36" height="28" fill="#F96D6D" stroke="${INK}" stroke-width="3"/><path d="M12 48 q28 -12 56 0 Z" fill="#B493F0" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><rect x="28" y="26" width="24" height="18" fill="#F96D6D" stroke="${INK}" stroke-width="2.5"/><path d="M18 26 q22 -12 44 0 Z" fill="#B493F0" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M40 14 v-8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><rect x="34" y="60" width="12" height="16" fill="#FFE27A" stroke="${INK}" stroke-width="2"/>`},
  lampion:{name:'Lampions', draw:()=>`<path d="M6 20 q34 14 68 0" fill="none" stroke="${INK}" stroke-width="2.5"/>${[[18,'#F96D6D'],[40,'#FFE27A'],[62,'#F8A0C8']].map(([x,c])=>`<path d="M${x} 24 v6" stroke="${INK}" stroke-width="2"/><ellipse cx="${x}" cy="44" rx="10" ry="14" fill="${c}" stroke="${INK}" stroke-width="2.5"/><path d="M${x-10} 44 h20" stroke="${INK}" stroke-width="1.5" opacity=".4"/><path d="M${x} 58 v8" stroke="#FFE27A" stroke-width="3" stroke-linecap="round"/>`).join('')}`},
  burg:{name:'Drachenburg', draw:()=>`<rect x="8" y="40" width="64" height="36" fill="#CDB4F0" stroke="${INK}" stroke-width="3"/><path d="M8 40 h10 v-10 h10 v10 h8 v-10 h10 v10 h8 v-10 h10 v10 h8" fill="#CDB4F0" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 76 q0 -18 8 -18 q8 0 8 18 Z" fill="${INK}"/><rect x="18" y="50" width="8" height="10" fill="#FFE27A" stroke="${INK}" stroke-width="2"/><rect x="54" y="50" width="8" height="10" fill="#FFE27A" stroke="${INK}" stroke-width="2"/>`},
  fahne:{name:'Drachenfahne', draw:()=>`<path d="M30 76 v-66" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M32 12 l40 10 l-40 12 Z" fill="#F8A0C8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M44 18 l6 -4 l2 6 l6 -2 l-4 6 l4 4 l-7 0 l-2 6 l-4 -6 l-6 2 Z" fill="#FFE27A" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="30" cy="8" r="4" fill="#FFE27A" stroke="${INK}" stroke-width="2"/>`},
  schatz:{name:'Schatztruhe', draw:()=>`<rect x="12" y="44" width="56" height="32" rx="4" fill="#B7793C" stroke="${INK}" stroke-width="3"/><path d="M12 44 q0 -18 28 -18 q28 0 28 18 Z" fill="#D9A866" stroke="${INK}" stroke-width="3"/><rect x="34" y="40" width="12" height="12" rx="2" fill="#FFE27A" stroke="${INK}" stroke-width="2.5"/>${[[22,30],[40,24],[58,30],[30,20],[50,20]].map(([x,y])=>`<path d="M${x} ${y} l2 4 l4 .5 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 -.5 Z" fill="#FFE27A" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`).join('')}`}
};

/* ---------- Inseln: Thema je Reihe ---------- */
const ISLANDS={
  2:{animal:'kueken', title:'Wiesen-Insel',    ground:'#A9E3A1', rim:'#7BC57E', sky:'#EAF4FD', builds:['huhnhaus','sonnenblume','zaun']},
  10:{animal:'eule',  title:'Nachtwald-Insel', ground:'#8FA8E0', rim:'#6B7FC9', sky:'#2E3060', night:true, builds:['baumhaus','laterne','mondschaukel']},
  5:{animal:'frosch', title:'Teich-Insel',     ground:'#9FD9C3', rim:'#6EC0A3', sky:'#E3F3F0', water:true, builds:['seerose','schilf','steg']},
  1:{animal:'hase',   title:'Möhren-Insel',    ground:'#C9E8A0', rim:'#9FCB7A', sky:'#FDF4E3', builds:['moehrenbeet','hasenbau','vogelscheuche']},
  4:{animal:'fuchs',  title:'Herbstwald-Insel',ground:'#F6C690', rim:'#E0A266', sky:'#FBEDE0', builds:['hoehle','pilze','laubhaufen']},
  8:{animal:'schildi',title:'Strand-Insel',    ground:'#F7E2B2', rim:'#E7C98A', sky:'#DCF1FB', water:true, builds:['palme','sonnenschirm','sandburg']},
  3:{animal:'falter', title:'Blüten-Insel',    ground:'#F8C7DF', rim:'#E99FC4', sky:'#FFF0F7', builds:['blumen','bienenhaus','regenbogenbogen']},
  6:{animal:'delfin', title:'Riff-Insel',      ground:'#A6D8F5', rim:'#7CBEEA', sky:'#E6F3FD', water:true, builds:['leuchtturm','boot','koralle']},
  9:{animal:'panda',  title:'Bambus-Insel',    ground:'#B5E3B0', rim:'#86C98A', sky:'#F0F8EC', builds:['bambus','pagode','lampion']},
  7:{animal:'drache', title:'Drachen-Insel',    ground:'#D5B3F0', rim:'#B48BE0', sky:'#F3E9FB', builds:['burg','fahne','schatz']}
};
const BUILD_COST=[8,15,25];

/* Ein Stück: Himmel, Wolken/Wasser, Insel, Ausbauten, Tier. opts: {built:[ids], mastered, open, animate, size} */
function islandSVG(row, opts){
  opts=opts||{};
  const I=ISLANDS[row]; if(!I) return '';
  const built=opts.built||[];
  const A=ANIMALS[I.animal];
  const cls=opts.animate?' isl-anim':'';
  const w=opts.size||240, h=Math.round(w*200/240);
  const water=I.water;
  const slots=[[26,114,0.66],[152,120,0.8],[206,100,0.6]];   // x, y(Boden), Skalierung je Ausbau
  const buildsHtml=I.builds.map((id,i)=>{ if(!built.includes(id)) return ''; const [x,y,s]=slots[i]; return `<g class="isl-build" transform="translate(${x-40*s} ${y-76*s}) scale(${s})">${BUILDS[id].draw()}</g>`; }).join('');
  const sleeping=!opts.mastered;
  return `
  <svg viewBox="0 0 240 200" width="${w}" height="${h}" class="isl${cls}${opts.open?'':' isl-locked'}" role="img" aria-label="${I.title}">
    <defs><clipPath id="islclip${row}"><rect x="0" y="0" width="240" height="200" rx="28"/></clipPath></defs>
    <g clip-path="url(#islclip${row})">
      <rect width="240" height="200" fill="${I.sky}"/>
      ${I.night?`<circle cx="196" cy="40" r="16" fill="#FFF3C9"/><circle cx="188" cy="34" r="14" fill="${I.sky}"/>${[20,60,120,150,230].map((x,i)=>`<circle cx="${x}" cy="${18+i*9}" r="1.8" fill="#FFF3C9" class="isl-twinkle" style="animation-delay:${i*0.4}s"/>`).join('')}`:`<circle cx="200" cy="38" r="18" fill="#FFE9A8" opacity=".9"/>`}
      <g class="isl-cloud"><ellipse cx="44" cy="40" rx="26" ry="11" fill="#fff" opacity=".9"/><ellipse cx="58" cy="34" rx="16" ry="10" fill="#fff" opacity=".9"/></g>
      <g class="isl-cloud2"><ellipse cx="150" cy="60" rx="20" ry="8" fill="#fff" opacity=".7"/></g>
      ${water?`<rect x="0" y="130" width="240" height="70" fill="#8CC6F4"/><g class="isl-wave"><path d="M-20 142 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#fff" stroke-width="4" opacity=".7"/></g>`:
        `<rect x="0" y="134" width="240" height="70" fill="${I.night?'#3A3F7A':'#DCEBF7'}"/><g class="isl-cloud"><ellipse cx="30" cy="170" rx="46" ry="16" fill="#fff" opacity="${I.night?'.35':'.95'}"/><ellipse cx="210" cy="176" rx="50" ry="16" fill="#fff" opacity="${I.night?'.35':'.95'}"/></g>`}
      <path d="M12 134 q0 -26 44 -30 q64 -8 128 0 q44 4 44 30 q0 24 -20 28 q-88 10 -176 0 q-20 -4 -20 -28 Z" fill="${I.rim}" stroke="${INK}" stroke-width="3.5"/>
      <path d="M26 124 q0 -18 36 -22 q58 -6 116 0 q36 4 36 22 q-94 16 -188 0 Z" fill="${I.ground}"/>
      ${buildsHtml}
      <g class="isl-animal${sleeping?' isl-sleep':''}" transform="translate(44 28) scale(1.0)">${A.draw()}
        ${sleeping?`<g class="isl-zzz" fill="${INK}" font-family="'Baloo 2',sans-serif" font-weight="700"><text x="78" y="26" font-size="12">z</text><text x="86" y="16" font-size="15">z</text><text x="96" y="4" font-size="18">Z</text></g>`:''}
      </g>
      ${opts.open?'':`<rect width="240" height="200" fill="#EEE8F8" opacity=".55"/><g class="isl-cloud"><ellipse cx="120" cy="110" rx="90" ry="34" fill="#fff" opacity=".95"/><ellipse cx="80" cy="92" rx="44" ry="26" fill="#fff" opacity=".95"/><ellipse cx="160" cy="94" rx="48" ry="28" fill="#fff" opacity=".95"/></g>`}
    </g>
  </svg>`;
}

window.Inselwelt={ISLANDS, ANIMALS, BUILDS, BUILD_COST, islandSVG,
  buildIconSVG:(id,size)=>`<svg viewBox="0 0 80 80" width="${size||56}" height="${size||56}">${BUILDS[id].draw()}</svg>`};
})();
