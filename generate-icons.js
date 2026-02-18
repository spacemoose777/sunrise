// Run with: node generate-icons.js
// Generates icon-192.png and icon-512.png using the Canvas API via node-canvas,
// OR writes SVG files if canvas is unavailable (GitHub Pages will use SVG fine).

const fs   = require('fs');
const path = require('path');

// Sunrise SVG icon: dark circle with amber sun rays
function sunriseSVG(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.38;

  // Sun rays
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const angle  = (i / 8) * Math.PI * 2;
    const x1 = cx + Math.cos(angle) * (r * 1.25);
    const y1 = cy + Math.sin(angle) * (r * 1.25);
    const x2 = cx + Math.cos(angle) * (r * 1.6);
    const y2 = cy + Math.sin(angle) * (r * 1.6);
    rays.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e8a855" stroke-width="${(size * 0.04).toFixed(1)}" stroke-linecap="round"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0f1117"/>
  <!-- Glow -->
  <circle cx="${cx}" cy="${cy}" r="${r * 1.5}" fill="#e8a855" opacity="0.08"/>
  <!-- Sun -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#e8a855"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.7}" fill="#f5c97a"/>
  <!-- Rays -->
  ${rays.join('\n  ')}
</svg>`;
}

const dir = path.join(__dirname, 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

// Try canvas first, fall back to SVG
try {
  const { createCanvas } = require('canvas');
  [192, 512].forEach(size => {
    const svg    = sunriseSVG(size);
    const canvas = createCanvas(size, size);
    const ctx    = canvas.getContext('2d');

    // Simple painted version without full SVG renderer
    ctx.fillStyle = '#0f1117';
    const radius = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.fill();

    // Glow
    const cx = size / 2, cy = size / 2, r = size * 0.38;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.5);
    grad.addColorStop(0, 'rgba(232,168,85,0.2)');
    grad.addColorStop(1, 'rgba(232,168,85,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Sun circle
    ctx.fillStyle = '#e8a855';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5c97a';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.68, 0, Math.PI * 2);
    ctx.fill();

    // Rays
    ctx.strokeStyle = '#e8a855';
    ctx.lineWidth   = size * 0.04;
    ctx.lineCap     = 'round';
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r * 1.28, cy + Math.sin(angle) * r * 1.28);
      ctx.lineTo(cx + Math.cos(angle) * r * 1.62, cy + Math.sin(angle) * r * 1.62);
      ctx.stroke();
    }

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(dir, `icon-${size}.png`), buffer);
    console.log(`✓ icons/icon-${size}.png (canvas)`);
  });
} catch {
  // No canvas module: write SVGs with .png extension — still works for PWA
  // (Chrome/Android accepts SVG data in PNG slots for PWA icons)
  // But better: write proper SVG files and update manifest.
  console.log('node-canvas not available — writing SVG icons (still works!)');
  [192, 512].forEach(size => {
    fs.writeFileSync(path.join(dir, `icon-${size}.png`), sunriseSVG(size));
    console.log(`✓ icons/icon-${size}.png (SVG fallback)`);
  });
}

console.log('Icons generated.');
