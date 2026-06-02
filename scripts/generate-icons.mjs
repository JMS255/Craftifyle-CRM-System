import sharp from 'sharp'

const SIZE = 512

const svg = `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="512" height="512" rx="112" fill="#7c6ff7"/>
  <!-- Subtle inner glow -->
  <rect width="512" height="512" rx="112" fill="url(#grad)" opacity="0.4"/>
  <defs>
    <radialGradient id="grad" cx="35%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Letter C -->
  <text
    x="256"
    y="346"
    font-family="'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
    font-size="300"
    font-weight="700"
    fill="white"
    text-anchor="middle"
    letter-spacing="-8"
  >C</text>
</svg>
`

const buf = Buffer.from(svg)

await sharp(buf).resize(512, 512).png().toFile('public/icon-512.png')
await sharp(buf).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(buf).resize(180, 180).png().toFile('public/apple-touch-icon.png')
await sharp(buf).resize(32, 32).png().toFile('public/favicon-32.png')

console.log('Icons generated.')
