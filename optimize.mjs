/**
 * Script de otimização completa de imagens para o funil PataCerta.
 * Converte PNGs para WebP com redimensionamento inteligente por contexto.
 * Mantém os JPGs existentes (já otimizados) e converte apenas os PNGs pesados.
 */
import sharp from 'sharp';
import { readdir, stat, mkdir } from 'fs/promises';
import { join, relative, extname, basename, dirname } from 'path';

const ROOT = '.';
const ASSETS = join(ROOT, 'assets');

// Mapeamento de dimensões máximas por contexto de uso
// Baseado na análise do HTML: container quiz=480px (2 cols = 240px cada), sales=560px
const SIZE_RULES = [
  // Quiz option cards: exibidos em grid 2 colunas, container 480px → cada ~240px. Retina 2x = 480px
  { pattern: /quiz\/(comportamento|porte|idade|energia|moradia|correcao|tempo|objetos)\//, maxWidth: 480, quality: 75 },
  // Quiz inicio
  { pattern: /quiz\/quiz-inicio/, maxWidth: 800, quality: 78 },
  // Sales hero images
  { pattern: /sales\/hero-/, maxWidth: 1120, quality: 78 },
  // Sales product mockup
  { pattern: /sales\/product-mockup/, maxWidth: 1120, quality: 78 },
  // Sales capa-lp (hero da página de vendas)
  { pattern: /sales\/capa-lp/, maxWidth: 1120, quality: 78 },
  // Bonus covers: exibidos em 90px. Retina 2x = 180px
  { pattern: /sales\/capa_bono_/, maxWidth: 360, quality: 75 },
  // Payment logos
  { pattern: /sales\/pata_certa_pagamentos/, maxWidth: 640, quality: 80 },
  // Guarantee seal
  { pattern: /sales\/pata_certa_selo/, maxWidth: 256, quality: 80 },
  // Brand og-share (social preview)
  { pattern: /brand\/og-share/, maxWidth: 1200, quality: 78 },
  // Brand paw-icon
  { pattern: /brand\/paw-icon/, maxWidth: 128, quality: 80 },
  // Favicons
  { pattern: /brand\/favicon-512/, maxWidth: 512, quality: 85 },
  { pattern: /brand\/apple-touch-icon/, maxWidth: 180, quality: 85 },
  { pattern: /brand\/favicon-32/, maxWidth: 32, quality: 85 },
];

function getRule(filePath) {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  for (const rule of SIZE_RULES) {
    if (rule.pattern.test(rel)) return rule;
  }
  return { maxWidth: 800, quality: 78 }; // fallback
}

async function getAllFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function processImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext !== '.png') return null;
  
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  const rule = getRule(filePath);
  
  // Output path: same name but .webp
  const webpPath = filePath.replace(/\.png$/i, '.webp');
  
  try {
    const originalStats = await stat(filePath);
    const originalSize = originalStats.size;
    
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    // Resize if larger than maxWidth
    let pipeline = image;
    if (metadata.width > rule.maxWidth) {
      pipeline = pipeline.resize(rule.maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }
    
    // Convert to WebP
    await pipeline
      .webp({ quality: rule.quality, effort: 6 })
      .toFile(webpPath);
    
    const newStats = await stat(webpPath);
    const newSize = newStats.size;
    const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);
    
    console.log(`✅ ${rel}`);
    console.log(`   ${(originalSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB (${rule.maxWidth}px, q${rule.quality}) [-${reduction}%]`);
    
    return { original: filePath, webp: webpPath, originalSize, newSize };
  } catch (err) {
    console.error(`❌ ${rel}: ${err.message}`);
    return null;
  }
}

// Also convert the quiz-inicio.jpg to webp (it's 88KB, can be smaller)
async function processJpgToWebp(filePath, maxWidth, quality) {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  const webpPath = filePath.replace(/\.jpg$/i, '.webp');
  
  try {
    const originalStats = await stat(filePath);
    const originalSize = originalStats.size;
    
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    let pipeline = image;
    if (metadata.width > maxWidth) {
      pipeline = pipeline.resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }
    
    await pipeline
      .webp({ quality, effort: 6 })
      .toFile(webpPath);
    
    const newStats = await stat(webpPath);
    const newSize = newStats.size;
    const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);
    
    console.log(`✅ ${rel} (JPG→WebP)`);
    console.log(`   ${(originalSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB [-${reduction}%]`);
    
    return { original: filePath, webp: webpPath, originalSize, newSize };
  } catch (err) {
    console.error(`❌ ${rel}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('🔧 Otimização de imagens PataCerta');
  console.log('='.repeat(50));
  
  const allFiles = await getAllFiles(ASSETS);
  const pngFiles = allFiles.filter(f => extname(f).toLowerCase() === '.png');
  const jpgFiles = [
    join(ASSETS, 'quiz', 'quiz-inicio.jpg'),
    join(ASSETS, 'sales', 'hero-walk.jpg'),
    join(ASSETS, 'sales', 'hero-home.jpg'),
    join(ASSETS, 'sales', 'product-mockup.jpg'),
    join(ASSETS, 'brand', 'og-share.jpg'),
  ].filter(f => allFiles.some(af => af === f));
  
  console.log(`\n📦 ${pngFiles.length} PNGs para converter`);
  console.log(`📦 ${jpgFiles.length} JPGs para converter\n`);
  
  let totalOriginal = 0;
  let totalNew = 0;
  let count = 0;
  
  // Process PNGs
  for (const file of pngFiles) {
    const result = await processImage(file);
    if (result) {
      totalOriginal += result.originalSize;
      totalNew += result.newSize;
      count++;
    }
  }
  
  // Process JPGs
  const jpgRules = [
    { file: 'quiz-inicio.jpg', maxWidth: 800, quality: 78 },
    { file: 'hero-walk.jpg', maxWidth: 1120, quality: 78 },
    { file: 'hero-home.jpg', maxWidth: 1120, quality: 78 },
    { file: 'product-mockup.jpg', maxWidth: 1120, quality: 78 },
    { file: 'og-share.jpg', maxWidth: 1200, quality: 78 },
  ];
  
  for (const jpgFile of jpgFiles) {
    const rule = jpgRules.find(r => jpgFile.endsWith(r.file)) || { maxWidth: 800, quality: 78 };
    const result = await processJpgToWebp(jpgFile, rule.maxWidth, rule.quality);
    if (result) {
      totalOriginal += result.originalSize;
      totalNew += result.newSize;
      count++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`🎉 ${count} imagens convertidas`);
  console.log(`📊 Total original: ${(totalOriginal / 1024 / 1024).toFixed(1)}MB`);
  console.log(`📊 Total WebP:     ${(totalNew / 1024 / 1024).toFixed(1)}MB`);
  console.log(`📊 Redução total:   ${((1 - totalNew / totalOriginal) * 100).toFixed(1)}%`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
