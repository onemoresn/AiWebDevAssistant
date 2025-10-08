// Generates a placeholder ICO (multi-size) using pure Node (no native deps)
// For production replace with a real designed icon.
const fs = require('fs');
const path = require('path');

// If SMAiAssistant.png exists, use it as the source image. Otherwise fallback to placeholder.
// Minimal blank PNG fallback (256x256)
const PLACEHOLDER_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAABdklEQVR4nO3RMQEAAAgDIN8/9K3hAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4J2mAAGYHk9UAAAAAElFTkSuQmCC';

// ICO format: We'll just write the PNG multiple times with different size headers.
// For simplicity, reuse the same PNG bytes for 16,32,48,256.

function buildICO(pngBuffer){
  const sizes = [16,32,48,256];
  const images = sizes.map(sz => ({
    width: sz === 256 ? 0 : sz, // 0 denotes 256 in ICO spec
    height: sz === 256 ? 0 : sz,
    colorCount: 0,
    reserved: 0,
    planes: 1,
    bitCount: 32,
    bytes: pngBuffer
  }));

  // ICONDIR header (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0,0); // reserved
  header.writeUInt16LE(1,2); // type 1 = icon
  header.writeUInt16LE(images.length,4); // count

  let offset = 6 + images.length * 16; // start of image data
  const entries = Buffer.alloc(images.length * 16);

  images.forEach((img, i)=>{
    const idx = i*16;
    entries[idx] = img.width; // width
    entries[idx+1] = img.height; // height
    entries[idx+2] = img.colorCount; // color count
    entries[idx+3] = img.reserved; // reserved
    entries.writeUInt16LE(img.planes, idx+4); // planes
    entries.writeUInt16LE(img.bitCount, idx+6); // bit count
    entries.writeUInt32LE(img.bytes.length, idx+8); // size of image data
    entries.writeUInt32LE(offset, idx+12); // offset
    offset += img.bytes.length;
  });

  return Buffer.concat([header, entries, ...images.map(i=> i.bytes)]);
}

function main(){
  const root = path.join(__dirname, '..');
  const candidate = path.join(root, 'SMAiAssistant.png');
  let pngBuffer;
  if(fs.existsSync(candidate)){
    try {
      pngBuffer = fs.readFileSync(candidate);
      console.log('Using SMAiAssistant.png as icon source');
    } catch(err){
      console.warn('Failed reading SMAiAssistant.png, using placeholder', err.message);
      pngBuffer = Buffer.from(PLACEHOLDER_BASE64, 'base64');
    }
  } else {
    pngBuffer = Buffer.from(PLACEHOLDER_BASE64, 'base64');
  }
  const outDir = path.join(root, 'build');
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ico = buildICO(pngBuffer);
  const target = path.join(outDir, 'icon.ico');
  fs.writeFileSync(target, ico);
  console.log('Generated icon at', target);
}

if(require.main === module){
  main();
}
