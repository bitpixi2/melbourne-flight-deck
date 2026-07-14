import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface ProjectorPairingProps {
  pairUrl: string | null;
  connected: boolean;
  controllerConnected: boolean;
  error: string | null;
}

export function ProjectorPairing({ pairUrl, connected, controllerConnected, error }: ProjectorPairingProps) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!pairUrl) {
      setQr(null);
      return;
    }
    void QRCode.toDataURL(pairUrl, {
      width: 420,
      margin: 2,
      color: { dark: "#031014", light: "#f2fbf9" },
      errorCorrectionLevel: "M",
    }).then((value) => {
      if (active) setQr(value);
    });
    return () => { active = false; };
  }, [pairUrl]);

  if (!pairUrl && !error) {
    return (
      <div className="projector-link-status" aria-live="polite">
        <i className={controllerConnected ? "online" : ""} />
        {controllerConnected ? "Phone controls connected" : connected ? "Ceiling controls ready" : "Reconnecting controls"}
      </div>
    );
  }

  return (
    <section className="projector-pairing" aria-label="Pair Brenton's Ceiling Controls">
      <div className="projector-pairing-copy">
        <span>Private phone pairing</span>
        <h1>Brenton's Ceiling Controls</h1>
        <p>Scan once with Brenton’s phone. The phone becomes the flight deck while this ceiling keeps running independently.</p>
        <small>{error ?? "Pairing expires in ten minutes · no account required"}</small>
      </div>
      {qr ? <img src={qr} alt="Private pairing QR code" /> : <div className="projector-qr-loading">Preparing private code…</div>}
    </section>
  );
}
