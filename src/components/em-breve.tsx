export function EmBreve({ titulo, quando, itens }: { titulo: string; quando: string; itens: string[] }) {
  return (
    <div>
      <h1 className="titulo-pagina">{titulo}</h1>
      <div className="cartao mt-6 p-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-latao-escuro uppercase">Chega no {quando}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-cinza">
          {itens.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
