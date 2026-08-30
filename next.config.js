const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Empêche Next.js de se tromper de racine de projet si un package-lock.json
  // ou node_modules traîne dans un dossier parent (ex: C:\Users\hp\Documents).
  // Sans ça, la résolution des alias "@/..." peut pointer vers le mauvais dossier.
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config) => {
    config.resolve.alias['@'] = __dirname;
    return config;
  },
};

module.exports = nextConfig;
