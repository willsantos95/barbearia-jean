"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirFoto, registrarFoto } from "../actions";

export type Foto = { id: string; url: string | null; legenda: string | null; created_at: string };

/** Reduz a foto para no máx. 1600px em JPEG (fotos de celular passam de 5 MB) */
async function comprimir(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
}

export function Fotos({ clienteId, fotos }: { clienteId: string; fotos: Foto[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<Foto | null>(null);
  const [, startTransition] = useTransition();

  async function enviar(files: FileList | null) {
    if (!files?.length) return;
    setErro(null);
    setEnviando(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        const blob = await comprimir(file);
        const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "jpg");
        const path = `${clienteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("fotos-clientes")
          .upload(path, blob, { contentType: blob.type || file.type });
        if (error) throw error;
        await registrarFoto(clienteId, path);
      }
    } catch (e) {
      setErro("Falha ao enviar a foto. " + (e instanceof Error ? e.message : ""));
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  function remover(f: Foto) {
    if (!confirm("Excluir esta foto?")) return;
    setAmpliada(null);
    startTransition(() => excluirFoto(f.id, clienteId).catch((e) => setErro(e.message)));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-carvao">Fotos do corte</h2>
        <button onClick={() => input.current?.click()} disabled={enviando} className="btn-secundario py-2">
          <Camera className="size-4" /> {enviando ? "Enviando..." : "Adicionar"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => enviar(e.target.files)}
        />
      </div>
      {erro && <p className="mt-2 text-sm text-perigo">{erro}</p>}

      {fotos.length === 0 ? (
        <p className="mt-3 text-sm text-cinza">Nenhuma foto ainda. Tire uma ao final do atendimento.</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((f) => (
            <button
              key={f.id}
              onClick={() => setAmpliada(f)}
              className="aspect-square overflow-hidden rounded-lg bg-papel-2"
            >
              {f.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt="Foto do corte" className="size-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {ampliada && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-4" onClick={() => setAmpliada(null)}>
          {ampliada.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ampliada.url} alt="Foto do corte" className="max-h-[80dvh] max-w-full rounded-lg" />
          )}
          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
            <span className="self-center text-sm text-papel/70">
              {new Date(ampliada.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </span>
            <button onClick={() => remover(ampliada)} className="btn-perigo py-2">
              <Trash2 className="size-4" /> Excluir
            </button>
            <button onClick={() => setAmpliada(null)} className="btn-secundario py-2">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
