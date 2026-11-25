// Formatacao de exibicao: preco em centavos para reais e data ISO para texto.
export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Converte a data de um <input type="datetime-local"> para ISO com fuso.
export function localParaIso(valor: string): string {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toISOString();
}

// Converte um ISO para o formato do <input type="datetime-local"> (sem fuso).
export function isoParaLocal(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return "";
  }
  const ajustada = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return ajustada.toISOString().slice(0, 16);
}
