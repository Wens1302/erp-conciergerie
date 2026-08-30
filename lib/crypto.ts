import crypto from 'crypto';

// Chiffrement des identifiants sensibles (mots de passe, codes 2FA) avant stockage.
// La clé ne doit JAMAIS être commitée — elle vit uniquement dans les variables
// d'environnement (ENCRYPTION_KEY), différente pour chaque déploiement client.
//
// Génération d'une clé : node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      "ENCRYPTION_KEY manquante dans l'environnement. Génère-en une avec :\n" +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"\n" +
        'et ajoute-la dans .env / les variables Vercel.'
    );
  }
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY doit faire 32 octets (base64 de 44 caractères environ).');
  }
  return key;
}

// Renvoie une chaîne base64 : iv (12o) + authTag (16o) + ciphertext
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decrypt(payload: string): string {
  const key = getKey();
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function encryptOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return encrypt(value);
}

export function decryptOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return null; // valeur corrompue ou chiffrée avec une autre clé
  }
}
