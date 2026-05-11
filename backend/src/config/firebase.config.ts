import { registerAs } from '@nestjs/config';

export interface FirebaseConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  /** When false, FCM calls become no-ops (safe for local dev / CI). */
  enabled: boolean;
}

function normalizePrivateKey(key: string | undefined): string {
  if (!key) return '';
  return key.replace(/\\n/g, '\n').trim();
}

export default registerAs('firebase', (): FirebaseConfig => {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? '';
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  return {
    projectId,
    clientEmail,
    privateKey,
    enabled: Boolean(projectId && clientEmail && privateKey),
  };
});
