import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface UpiQrCodeProps {
  upiLink: string;
  size?: number;
}

/**
 * Generates a black-and-white UPI QR code from a `upi://pay?...` link.
 * Renders as a crisp PNG data URL on a white rounded background.
 */
export default function UpiQrCode({ upiLink, size = 240 }: UpiQrCodeProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(upiLink, {
      width: size * 2,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => { if (active) { setQrUrl(url); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [upiLink, size]);

  if (error) {
    return (
      <div className="grid place-items-center rounded-xl bg-white p-4" style={{ width: size, height: size }}>
        <span className="text-xs text-gray-500">QR unavailable</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-3 shadow-neon">
      {qrUrl ? (
        <img
          src={qrUrl}
          alt="UPI Payment QR Code"
          width={size}
          height={size}
          className="rounded-lg"
          style={{ width: size, height: size, imageRendering: 'crisp-edges' }}
        />
      ) : (
        <div
          className="grid animate-pulse place-items-center rounded-lg bg-gray-200"
          style={{ width: size, height: size }}
        >
          <span className="text-xs text-gray-400">Generating…</span>
        </div>
      )}
    </div>
  );
}
