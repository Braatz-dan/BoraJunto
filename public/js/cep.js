/**
 * Melhoria progressiva do campo de CEP (#cep).
 * - Formata enquanto digita (00000-000).
 * - Ao sair do campo, consulta o ViaCEP e mostra a região (bairro/cidade).
 * - Na tela de "oferecer", preenche o campo Bairro automaticamente.
 * Se o navegador estiver offline ou o ViaCEP falhar, nada quebra:
 * o servidor resolve o CEP de novo ao salvar/buscar.
 */
(function () {
  var input = document.getElementById('cep');
  if (!input) return;

  var info = document.getElementById('cepInfo');   // existe na tela de oferecer
  var bairro = document.getElementById('bairro');  // campo bairro (tela de oferecer)

  function soDigitos(v) { return (v || '').replace(/\D/g, ''); }

  function formatar(v) {
    var d = soDigitos(v).slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  }

  input.addEventListener('input', function () {
    var pos = input.selectionStart;
    input.value = formatar(input.value);
    if (pos === input.value.length) input.setSelectionRange(pos, pos);
  });

  input.addEventListener('blur', async function () {
    var cep = soDigitos(input.value);
    if (cep.length !== 8) return;
    if (info) info.textContent = 'Buscando região do CEP...';
    try {
      var r = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
      var d = await r.json();
      if (d && !d.erro) {
        var regiao = [d.bairro, d.localidade].filter(Boolean).join(' — ') + (d.uf ? '/' + d.uf : '');
        if (info) info.innerHTML = '📍 Região: <strong>' + regiao + '</strong>';
        // Preenche o bairro (sobrescreve so se o usuario ainda nao tiver digitado nada).
        if (bairro && !bairro.value.trim() && d.bairro) {
          bairro.value = d.bairro;
        }
      } else if (info) {
        info.textContent = 'CEP não encontrado — confira o número.';
      }
    } catch (e) {
      if (info) info.textContent = 'Não foi possível consultar o CEP agora (será resolvido ao salvar).';
    }
  });
})();
