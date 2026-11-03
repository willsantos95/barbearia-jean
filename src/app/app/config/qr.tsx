"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";

export function QrCheckin({ nome }: { nome: string }) {
  const [origem, setOrigem] = useState("");
  useEffect(() => setOrigem(window.location.origin), []);
  const url = origem ? `${origem}/checkin?origem=qr` : "";

  function imprimir() {
    const svg = document.getElementById("qr-checkin")?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>QR Check-in</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:48px;color:#17140f}
      h1{font-size:28px;margin:0 0 6px}p{font-size:18px;margin:0 0 32px;color:#555}
      svg{width:360px;height:360px}small{display:block;margin-top:24px;color:#888;font-size:13px}</style></head>
      <body><h1>${nome}</h1><p>Aponte a câmera e entre na fila</p>${svg}<small>${url}</small>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div className="rounded-xl border border-linha bg-white p-4">
        {url ? <QRCodeSVG id="qr-checkin" value={url} size={168} marginSize={1} /> : <div className="size-[168px]" />}
      </div>
      <div className="space-y-2 text-sm">
        <p className="text-cinza">Imprima e cole na recepção. O cliente aponta a câmera, faz o check-in e acompanha a posição no próprio celular.</p>
        <p className="font-mono text-xs break-all text-cinza">{url}</p>
        <button onClick={imprimir} className="btn-secundario py-2">
          <Printer className="size-4" /> Imprimir QR code
        </button>
      </div>
    </div>
  );
}
