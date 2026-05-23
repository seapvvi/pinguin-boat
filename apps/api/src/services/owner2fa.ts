import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export function generateSecret(): speakeasy.GeneratedSecret {
  return speakeasy.generateSecret({
    name: 'Pinguin BOAT (Dashboard)',
    length: 20,
  });
}

export async function generateQRCode(
  secret: string
): Promise<string> {
  const otpauthUrl = speakeasy.otpauthURL({
    secret,
    label: 'Pinguin BOAT Dashboard',
    issuer: 'Pinguin BOAT',
    encoding: 'base32',
  });

  return QRCode.toDataURL(otpauthUrl);
}

export function verifyToken(
  secret: string,
  token: string
): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2,
  });
}
