// Run this once with Node.js to generate a simple notification.mp3 placeholder
// OR place any short notification sound as public/notification.mp3
// This script generates a minimal WAV file (rename to .mp3 or use as .wav)

const fs = require('fs');
const path = require('path');

// Generate a simple 440Hz beep WAV (0.3 seconds)
const sampleRate = 44100;
const duration = 0.3;
const frequency = 880;
const numSamples = Math.floor(sampleRate * duration);
const buffer = Buffer.alloc(44 + numSamples * 2);

// WAV header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + numSamples * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(numSamples * 2, 40);

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const envelope = Math.min(1, (duration - t) / 0.1); // fade out
  const sample = Math.floor(envelope * 0.5 * 32767 * Math.sin(2 * Math.PI * frequency * t));
  buffer.writeInt16LE(sample, 44 + i * 2);
}

const outPath = path.join(__dirname, '..', 'public', 'notification.mp3');
fs.writeFileSync(outPath, buffer);
console.log('✅ notification.mp3 created at public/notification.mp3');
