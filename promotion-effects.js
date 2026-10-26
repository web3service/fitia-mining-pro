// Illustrations et particules locales des décorations FITIA.
// Aucun texte administrateur n'est utilisé dans le SVG ou les particules.
(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let svgSequence = 0;
  const VARIANTS = Object.freeze([
    'gift', 'bells', 'snow', 'confetti', 'fireworks', 'hearts', 'blossom', 'halloween', 'badge'
  ]);
  const PARTICLE_COUNTS = {
    gift: 4, bells: 5, snow: 8, confetti: 10, fireworks: 8,
    hearts: 6, blossom: 7, halloween: 6, badge: 4
  };
  const PARTICLE_COLORS = {
    gift: ['#fde68a', '#f87171', '#86efac'],
    bells: ['#fef3c7', '#fbbf24', '#fca5a5'],
    snow: ['#ffffff', '#bfdbfe', '#dbeafe'],
    confetti: ['#fbbf24', '#f87171', '#60a5fa', '#34d399', '#c084fc'],
    fireworks: ['#fde68a', '#fb7185', '#93c5fd', '#c4b5fd'],
    hearts: ['#fda4af', '#fb7185', '#f9a8d4'],
    blossom: ['#fbcfe8', '#f9a8d4', '#bef264', '#fde68a'],
    halloween: ['#fb923c', '#c084fc', '#a3e635'],
    badge: ['#fde68a', '#f0b90b', '#fff7d6']
  };

  function isVariant(value) {
    return VARIANTS.includes(value);
  }

  function createSvg(document, variant) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('promotion-effect-svg');
    const add = (tag, attributes) => {
      const element = document.createElementNS(SVG_NS, tag);
      Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
      svg.appendChild(element);
      return element;
    };
    const defs = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(defs);
    const gradient = (colors, radial = false) => {
      const id = `fitia-promo-gradient-${svgSequence += 1}`;
      const element = document.createElementNS(SVG_NS, radial ? 'radialGradient' : 'linearGradient');
      element.setAttribute('id', id);
      if (radial) {
        element.setAttribute('cx', '32%');
        element.setAttribute('cy', '24%');
        element.setAttribute('r', '78%');
      } else {
        element.setAttribute('x1', '0%');
        element.setAttribute('y1', '0%');
        element.setAttribute('x2', '100%');
        element.setAttribute('y2', '100%');
      }
      colors.forEach((color, index) => {
        const stop = document.createElementNS(SVG_NS, 'stop');
        stop.setAttribute('offset', `${(index / (colors.length - 1)) * 100}%`);
        stop.setAttribute('stop-color', color);
        element.appendChild(stop);
      });
      defs.appendChild(element);
      return `url(#${id})`;
    };

    if (variant === 'gift') {
      add('rect', { x: 10, y: 27, width: 44, height: 29, rx: 5, fill: gradient(['#f87171', '#dc2626', '#991b1b']), stroke: '#fecaca', 'stroke-width': 1.4 });
      add('rect', { x: 7, y: 20, width: 50, height: 12, rx: 4, fill: gradient(['#ef4444', '#b91c1c', '#7f1d1d']), stroke: '#fecaca', 'stroke-width': 1.2 });
      add('rect', { x: 28, y: 20, width: 8, height: 36, fill: gradient(['#fff7d6', '#fbbf24', '#d97706']) });
      add('path', { d: 'M32 20C20 20 14 13 18 8C22 3 30 11 32 20Z', fill: 'none', stroke: '#fde68a', 'stroke-width': 3.2, 'stroke-linecap': 'round' });
      add('path', { d: 'M32 20C44 20 50 13 46 8C42 3 34 11 32 20Z', fill: 'none', stroke: '#fde68a', 'stroke-width': 3.2, 'stroke-linecap': 'round' });
      add('circle', { cx: 32, cy: 20, r: 4, fill: gradient(['#ffffff', '#fde68a', '#f59e0b'], true) });
      add('path', { d: 'M12 24H52M15 34V48', stroke: '#ffffff', 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0.32 });
      add('path', { d: 'M15 39H25M39 47H49', stroke: '#f87171', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.75 });
    } else if (variant === 'bells') {
      add('path', { d: 'M12 43C18 37 17 32 17 25C17 17 22 12 28 12C34 12 38 17 38 25C38 32 38 37 43 43Z', fill: gradient(['#fef3c7', '#f59e0b', '#b45309']), stroke: '#fef3c7', 'stroke-width': 1.5 });
      add('path', { d: 'M24 46C30 40 29 35 29 28C29 20 34 15 40 15C46 15 50 20 50 28C50 35 50 40 55 46Z', fill: gradient(['#fff7d6', '#fbbf24', '#d97706']), stroke: '#fef3c7', 'stroke-width': 1.5 });
      add('path', { d: 'M22 20C19 25 20 33 17 37M35 23C33 28 34 35 31 39', fill: 'none', stroke: '#ffffff', 'stroke-width': 1.5, 'stroke-linecap': 'round', opacity: 0.45 });
      add('circle', { cx: 28, cy: 47, r: 4, fill: gradient(['#ffffff', '#fde68a', '#d97706'], true) });
      add('circle', { cx: 40, cy: 50, r: 4, fill: '#fde68a' });
      add('path', { d: 'M32 15C22 13 16 7 20 4C25 1 31 8 32 15Z', fill: gradient(['#f87171', '#dc2626', '#991b1b']), stroke: '#fca5a5', 'stroke-width': 1 });
      add('path', { d: 'M32 15C42 13 48 7 44 4C39 1 33 8 32 15Z', fill: '#b91c1c', stroke: '#fca5a5', 'stroke-width': 1 });
      add('circle', { cx: 32, cy: 15, r: 4, fill: '#ef4444' });
      add('path', { d: 'M10 53H55', stroke: '#fde68a', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.65 });
    } else if (variant === 'snow') {
      add('circle', { cx: 32, cy: 32, r: 25, fill: gradient(['#60a5fa', '#1e3a8a', '#0f172a'], true), opacity: 0.48 });
      add('path', { d: 'M32 8V56M11 20L53 44M11 44L53 20', fill: 'none', stroke: '#eff6ff', 'stroke-width': 3, 'stroke-linecap': 'round' });
      add('path', { d: 'M25 13L32 20L39 13M25 51L32 44L39 51M15 27L24 25L21 17M43 47L40 39L49 37M15 37L24 39L21 47M43 17L40 25L49 27', fill: 'none', stroke: '#bfdbfe', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      add('circle', { cx: 32, cy: 32, r: 5, fill: '#ffffff' });
    } else if (variant === 'confetti') {
      add('path', { d: 'M12 55L24 22L47 48Z', fill: gradient(['#c4b5fd', '#7c3aed', '#4c1d95']), stroke: '#ddd6fe', 'stroke-width': 1.4 });
      add('path', { d: 'M19 42L36 36M23 32L29 30', stroke: '#fbbf24', 'stroke-width': 4, opacity: 0.85 });
      add('path', { d: 'M29 18C24 10 35 8 32 3M40 25C51 20 48 11 55 10M47 35C57 34 56 43 61 42', fill: 'none', stroke: '#f87171', 'stroke-width': 3, 'stroke-linecap': 'round' });
      add('path', { d: 'M12 18L17 13M46 5L49 9M8 33L13 35', stroke: '#60a5fa', 'stroke-width': 3, 'stroke-linecap': 'round' });
      add('circle', { cx: 43, cy: 14, r: 3, fill: '#34d399' });
      add('circle', { cx: 19, cy: 7, r: 2.5, fill: '#fbbf24' });
    } else if (variant === 'fireworks') {
      add('path', { d: 'M22 5V13M22 31V39M5 22H13M31 22H39M10 10L16 16M28 28L34 34M10 34L16 28M28 16L34 10', stroke: '#fde68a', 'stroke-width': 2.8, 'stroke-linecap': 'round' });
      add('circle', { cx: 22, cy: 22, r: 4, fill: '#fbbf24' });
      add('path', { d: 'M45 24V31M45 49V56M29 40H36M54 40H61M34 29L39 34M51 46L56 51M34 51L39 46M51 34L56 29', stroke: '#fb7185', 'stroke-width': 2.6, 'stroke-linecap': 'round' });
      add('circle', { cx: 45, cy: 40, r: 4, fill: '#c084fc' });
      add('path', { d: 'M48 4V9M48 15V20M40 12H44M52 12H56', stroke: '#93c5fd', 'stroke-width': 2.2, 'stroke-linecap': 'round' });
    } else if (variant === 'hearts') {
      add('path', { d: 'M29 54C25 48 9 38 7 25C5 13 20 8 29 20C38 8 53 13 51 25C49 38 33 48 29 54Z', fill: gradient(['#fecdd3', '#fb7185', '#be123c']), stroke: '#fecdd3', 'stroke-width': 1.5 });
      add('path', { d: 'M47 28C45 24 38 19 38 13C38 7 46 5 49 11C53 5 61 8 60 14C59 20 51 25 47 28Z', fill: gradient(['#fce7f3', '#f9a8d4', '#db2777']), stroke: '#fce7f3', 'stroke-width': 1.1 });
      add('path', { d: 'M16 23C17 18 21 17 24 20', fill: 'none', stroke: '#fff1f2', 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: 0.8 });
    } else if (variant === 'blossom') {
      const petal = gradient(['#fce7f3', '#f9a8d4', '#ec4899']);
      const petalShadow = gradient(['#f9a8d4', '#f472b6', '#be185d']);
      add('path', { d: 'M32 35V58M32 47C23 42 18 46 17 52C24 54 29 52 32 47ZM32 43C40 37 47 40 48 46C41 49 36 47 32 43Z', fill: gradient(['#86efac', '#22c55e', '#15803d']), stroke: '#86efac', 'stroke-width': 1.2 });
      add('ellipse', { cx: 32, cy: 17, rx: 8, ry: 13, fill: petal, stroke: '#fce7f3', 'stroke-width': 1.2 });
      add('ellipse', { cx: 32, cy: 17, rx: 8, ry: 13, fill: petalShadow, stroke: '#fce7f3', 'stroke-width': 1.2, transform: 'rotate(72 32 32)' });
      add('ellipse', { cx: 32, cy: 17, rx: 8, ry: 13, fill: petal, stroke: '#fce7f3', 'stroke-width': 1.2, transform: 'rotate(144 32 32)' });
      add('ellipse', { cx: 32, cy: 17, rx: 8, ry: 13, fill: petalShadow, stroke: '#fce7f3', 'stroke-width': 1.2, transform: 'rotate(216 32 32)' });
      add('ellipse', { cx: 32, cy: 17, rx: 8, ry: 13, fill: petal, stroke: '#fce7f3', 'stroke-width': 1.2, transform: 'rotate(288 32 32)' });
      add('circle', { cx: 32, cy: 32, r: 8, fill: gradient(['#fff7d6', '#fbbf24', '#d97706'], true), stroke: '#fef3c7', 'stroke-width': 1.5 });
      add('circle', { cx: 32, cy: 32, r: 3, fill: '#fff7d6' });
    } else if (variant === 'halloween') {
      add('path', { d: 'M31 15C30 9 34 5 39 5C36 9 37 12 39 16', fill: '#65a30d', stroke: '#a3e635', 'stroke-width': 2, 'stroke-linecap': 'round' });
      add('path', { d: 'M32 14C15 14 7 24 9 39C11 53 23 57 32 57C41 57 53 53 55 39C57 24 49 14 32 14Z', fill: gradient(['#fed7aa', '#f97316', '#c2410c'], true), stroke: '#fed7aa', 'stroke-width': 1.5 });
      add('path', { d: 'M32 15C23 21 22 49 32 56M32 15C41 21 42 49 32 56M20 17C14 28 15 45 23 53M44 17C50 28 49 45 41 53', fill: 'none', stroke: '#c2410c', 'stroke-width': 2, opacity: 0.75 });
      add('path', { d: 'M18 29L26 24L27 33ZM46 29L38 24L37 33ZM22 42L28 45L33 42L38 45L44 41C41 50 27 52 22 42Z', fill: '#31102f' });
    } else {
      add('path', { d: 'M20 36L13 58L28 50L34 60L40 39Z', fill: '#dc2626', stroke: '#fca5a5', 'stroke-width': 1.2 });
      add('path', { d: 'M40 36L51 56L38 51L32 60L25 39Z', fill: '#166534', stroke: '#86efac', 'stroke-width': 1.2 });
      add('circle', { cx: 32, cy: 27, r: 22, fill: gradient(['#fff7d6', '#f0b90b', '#b45309'], true), stroke: '#fff7d6', 'stroke-width': 2 });
      add('circle', { cx: 32, cy: 27, r: 17, fill: '#171203', opacity: 0.2 });
      add('path', { d: 'M32 12L36 21L46 22L38 29L40 39L32 34L24 39L26 29L18 22L28 21Z', fill: '#fff7d6', stroke: '#fde68a', 'stroke-width': 1 });
    }
    return svg;
  }

  function createIcon(document, variant) {
    const icon = document.createElement('span');
    icon.className = `promotion-effect-visual promotion-effect-${variant}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.appendChild(createSvg(document, isVariant(variant) ? variant : 'badge'));
    return icon;
  }

  function createParticles(document, variant) {
    const container = document.createElement('span');
    container.className = `promotion-effect-particles promotion-particles-${variant}`;
    container.setAttribute('aria-hidden', 'true');
    const colors = PARTICLE_COLORS[variant] || PARTICLE_COLORS.badge;
    const count = PARTICLE_COUNTS[variant] || 0;
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'promotion-particle';
      particle.style.setProperty('--particle-x', `${(index * 37 + 11) % 94}%`);
      particle.style.setProperty('--particle-y', `${(index * 23 + 7) % 38}%`);
      particle.style.setProperty('--particle-delay', `${(-index * 0.73).toFixed(2)}s`);
      particle.style.setProperty('--particle-duration', `${(3.8 + (index % 4) * 0.65).toFixed(2)}s`);
      particle.style.setProperty('--particle-drift', `${(index % 2 ? 1 : -1) * (8 + (index % 3) * 5)}px`);
      particle.style.setProperty('--particle-color', colors[index % colors.length]);
      container.appendChild(particle);
    }
    return container;
  }

  function clear(card) {
    if (!card) return;
    card.classList.remove('promotion-effect-static');
    card.querySelectorAll(':scope > .promotion-effect-decoration, :scope > .promotion-effect-visual, :scope > .promotion-effect-particles').forEach((element) => element.remove());
  }

  function decorate(card, variant, animated = true) {
    if (!card || !isVariant(variant)) return;
    clear(card);
    const document = card.ownerDocument;
    if (animated === false) card.classList.add('promotion-effect-static');
    if (animated !== false && PARTICLE_COUNTS[variant]) card.appendChild(createParticles(document, variant));
    const decoration = document.createElement('span');
    decoration.className = 'promotion-effect-decoration';
    decoration.setAttribute('aria-hidden', 'true');
    decoration.appendChild(createIcon(document, variant));
    card.appendChild(decoration);
  }

  window.FitiaPromotionEffects = { VARIANTS, isVariant, createIcon, decorate, clear };
})();
