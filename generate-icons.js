#!/usr/bin/env node
/**
 * Focus Engine — PWA Icon Generator
 * Generates all required icon sizes as PNG using canvas
 * Run: node generate-icons.js
 * Requires: npm install canvas
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT_DIR = path.join(__dirname, 'icons');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const pad    = size * 0.12;
  const r      = size * 0.22;

  // Background
  ctx.fillStyle = '#090910';
  ctx.fillRect(0, 0, size, size);

  // Rounded rect background
  ctx.beginPath();
  ctx.roundRect(pad, pad, size - pad*2, size - pad*2, r);
  ctx.fillStyle = '#18181f';
  ctx.fill();

  // Indigo ring arc
  const cx = size / 2, cy = size / 2;
  const radius = size * 0.30;
  const lineW  = size * 0.055;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI * 0.7, Math.PI * 0.9);
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth   = lineW;
  ctx.lineCap     = 'round';
  ctx.shadowColor  = 'rgba(99, 102, 241, 0.5)';
  ctx.shadowBlur   = size * 0.06;
  ctx.stroke();

  // Inner dot
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = '#6366f1';
  ctx.shadowBlur = size * 0.04;
  ctx.fill();

  // "FE" text for larger icons
  if (size >= 128) {
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(238, 238, 245, 0.9)';
    ctx.font       = `bold ${size * 0.13}px sans-serif`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FE', cx, cy * 1.55);
  }

  const buffer = canvas.toBuffer('image/png');
  const out    = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(out, buffer);
  console.log(`✓ Generated icon-${size}.png`);
}

SIZES.forEach(generateIcon);
console.log('\n✅ All icons generated in /icons/');
