/**
 * Consulta de CEP via ViaCEP (https://viacep.com.br).
 * Usa o fetch nativo do Node. Nunca lanca: em erro/timeout/CEP invalido
 * devolve null, para a busca e o cadastro seguirem sem travar.
 */

/** Deixa so os digitos do CEP. */
function limparCep(valor) {
  return String(valor || '').replace(/\D/g, '');
}

/** Formata para exibicao: 18000000 -> 18000-000. */
function formatarCep(valor) {
  const d = limparCep(valor);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (valor || '');
}

/**
 * Resolve um CEP para regiao. Retorna:
 *   { cep, logradouro, bairro, cidade, uf }  ou  null
 */
async function buscarCep(valor) {
  const cep = limparCep(valor);
  if (cep.length !== 8) return null;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const d = await resp.json();
    if (!d || d.erro) return null;
    return {
      cep,
      logradouro: d.logradouro || '',
      bairro: d.bairro || '',
      cidade: d.localidade || '',
      uf: d.uf || '',
    };
  } catch {
    return null; // rede/timeout/JSON invalido -> segue sem CEP
  }
}

module.exports = { buscarCep, formatarCep, limparCep };
