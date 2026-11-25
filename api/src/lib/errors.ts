// Erro de aplicação com código estável e status HTTP, tratado pelo handler central.
export class ErroAplicacao extends Error {
  constructor(
    public readonly codigo: string,
    public readonly status: number,
    mensagem?: string,
  ) {
    super(mensagem ?? codigo);
    this.name = "ErroAplicacao";
  }
}
