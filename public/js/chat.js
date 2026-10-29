// Widget do chat flutuante, falando com a API em /mensagens/*.
// Sem push no SQLite, então é polling: não lidas a cada 8s, conversa aberta a cada 4s.
// Texto do servidor sempre entra por textContent (nunca innerHTML): é digitado por
// gente, e innerHTML deixaria passar HTML malicioso.
(function () {
  'use strict';

  var raiz = document.getElementById('chat-widget');
  if (!raiz) return; // o widget só é renderizado para quem está logado

  var el = {
    botao: document.getElementById('chat-botao'),
    badge: document.getElementById('chat-badge'),
    painel: document.getElementById('chat-painel'),
    voltar: document.getElementById('chat-voltar'),
    fechar: document.getElementById('chat-fechar'),
    titulo: document.getElementById('chat-titulo'),
    subtitulo: document.getElementById('chat-subtitulo'),
    lista: document.getElementById('chat-lista'),
    thread: document.getElementById('chat-thread'),
    mensagens: document.getElementById('chat-mensagens'),
    form: document.getElementById('chat-form'),
    input: document.getElementById('chat-input'),
  };

  var estado = {
    aberto: false,
    reservaAtual: null, // id da conversa aberta, ou null (na lista)
    badgeTimer: null,
    threadTimer: null,
  };

  // ----- utilidades -----
  function pegar(url) {
    return fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function postar(url, corpo) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(corpo),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, dados: d }; }); });
  }
  function hora(ts) {
    // ts = "YYYY-MM-DD HH:MM:SS" (hora local do servidor). Mostra HH:MM.
    if (!ts) return '';
    var m = String(ts).match(/(\d{2}):(\d{2})/);
    return m ? m[1] + ':' + m[2] : '';
  }
  function sentidoRotulo(s) { return s === 'ida' ? '🎓 Ida' : '🏠 Volta'; }
  function limpar(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ----- badge (não lidas) -----
  function atualizarBadge() {
    pegar('/mensagens/nao-lidas').then(function (d) {
      var n = d.total || 0;
      if (n > 0) {
        el.badge.textContent = n > 99 ? '99+' : String(n);
        el.badge.hidden = false;
        el.botao.classList.add('tem-novas');
      } else {
        el.badge.hidden = true;
        el.botao.classList.remove('tem-novas');
      }
    }).catch(function () { /* silencioso: rede/sessão */ });
  }

  // ----- lista de conversas -----
  function mostrarLista() {
    estado.reservaAtual = null;
    pararThreadTimer();
    el.thread.hidden = true;
    el.lista.hidden = false;
    el.voltar.hidden = true;
    el.titulo.textContent = 'Conversas';
    el.subtitulo.textContent = '';
    carregarLista();
  }

  function carregarLista() {
    pegar('/mensagens/conversas').then(function (d) {
      var conversas = d.conversas || [];
      limpar(el.lista);

      if (!conversas.length) {
        var vazio = document.createElement('p');
        vazio.className = 'chat-vazio';
        vazio.textContent = 'Nenhuma conversa ainda. A conversa abre quando há um pedido de carona entre você e a outra pessoa.';
        el.lista.appendChild(vazio);
        return;
      }

      conversas.forEach(function (c) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'chat-conversa';
        item.setAttribute('data-reserva', c.reservaId);

        var topo = document.createElement('div');
        topo.className = 'chat-conversa-topo';
        var nome = document.createElement('span');
        nome.className = 'chat-conversa-nome';
        nome.textContent = c.outroNome;
        topo.appendChild(nome);
        if (c.naoLidas > 0) {
          var pino = document.createElement('span');
          pino.className = 'chat-conversa-badge';
          pino.textContent = c.naoLidas > 99 ? '99+' : String(c.naoLidas);
          topo.appendChild(pino);
        }
        item.appendChild(topo);

        var ctx = document.createElement('div');
        ctx.className = 'chat-conversa-ctx';
        ctx.textContent = sentidoRotulo(c.sentido) + ' · ' + c.rota;
        item.appendChild(ctx);

        var ultima = document.createElement('div');
        ultima.className = 'chat-conversa-ultima';
        ultima.textContent = c.ultimaTexto ? c.ultimaTexto : 'Sem mensagens ainda — diga olá.';
        item.appendChild(ultima);

        item.addEventListener('click', function () { abrirThread(c.reservaId); });
        el.lista.appendChild(item);
      });
    }).catch(function () { /* silencioso */ });
  }

  // ----- thread (conversa aberta) -----
  function abrirThread(reservaId) {
    estado.reservaAtual = reservaId;
    el.lista.hidden = true;
    el.thread.hidden = false;
    el.voltar.hidden = false;
    el.titulo.textContent = 'Carregando…';
    el.subtitulo.textContent = '';
    limpar(el.mensagens);
    carregarThread(true);
    iniciarThreadTimer();
    setTimeout(function () { el.input.focus(); }, 60);
  }

  function carregarThread(rolarFim) {
    var id = estado.reservaAtual;
    if (!id) return;
    pegar('/mensagens/conversas/' + id).then(function (d) {
      if (estado.reservaAtual !== id) return; // trocou de conversa no meio
      el.titulo.textContent = d.contexto.outroNome;
      el.subtitulo.textContent = sentidoRotulo(d.contexto.sentido) + ' · ' + d.contexto.rota;
      desenharMensagens(d.mensagens || [], rolarFim);
      atualizarBadge(); // o servidor marcou como lidas ao abrir
    }).catch(function () { /* silencioso */ });
  }

  function desenharMensagens(msgs, rolarFim) {
    // Evita redesenhar tudo: só anexa o que ainda não está na tela (por id).
    var existentes = {};
    Array.prototype.forEach.call(el.mensagens.children, function (n) {
      if (n.dataset.id) existentes[n.dataset.id] = true;
    });
    var algumNovo = false;
    msgs.forEach(function (m) {
      if (existentes[m.id]) return;
      algumNovo = true;
      var bolha = document.createElement('div');
      bolha.className = 'chat-bolha ' + (m.minha ? 'chat-bolha-minha' : 'chat-bolha-outro');
      bolha.dataset.id = m.id;
      var txt = document.createElement('div');
      txt.className = 'chat-bolha-txt';
      txt.textContent = m.texto; // texto, nunca HTML
      bolha.appendChild(txt);
      var h = document.createElement('time');
      h.className = 'chat-bolha-hora';
      h.textContent = hora(m.criadoEm);
      bolha.appendChild(h);
      el.mensagens.appendChild(bolha);
    });
    if (algumNovo && rolarFim !== false) {
      el.mensagens.scrollTop = el.mensagens.scrollHeight;
    }
  }

  function enviar(ev) {
    ev.preventDefault();
    var id = estado.reservaAtual;
    var texto = el.input.value.trim();
    if (!id || !texto) return;
    el.input.value = '';
    postar('/mensagens/conversas/' + id, { texto: texto }).then(function (res) {
      if (!res.ok) { el.input.value = texto; return; } // devolve o texto se falhou
      if (estado.reservaAtual === id && res.dados.mensagem) {
        desenharMensagens([res.dados.mensagem], true);
      }
    }).catch(function () { el.input.value = texto; });
  }

  // ----- timers -----
  function iniciarBadgeTimer() {
    atualizarBadge();
    estado.badgeTimer = setInterval(function () {
      atualizarBadge();
      if (estado.aberto && estado.reservaAtual === null) carregarLista();
    }, 8000);
  }
  function iniciarThreadTimer() {
    pararThreadTimer();
    estado.threadTimer = setInterval(function () { carregarThread(false); }, 4000);
  }
  function pararThreadTimer() {
    if (estado.threadTimer) { clearInterval(estado.threadTimer); estado.threadTimer = null; }
  }

  // ----- abrir/fechar painel -----
  function abrirPainel(reservaId) {
    estado.aberto = true;
    el.painel.hidden = false;
    el.botao.setAttribute('aria-expanded', 'true');
    if (reservaId) abrirThread(reservaId); else mostrarLista();
  }
  function fecharPainel() {
    estado.aberto = false;
    estado.reservaAtual = null;
    pararThreadTimer();
    el.painel.hidden = true;
    el.botao.setAttribute('aria-expanded', 'false');
  }

  // ----- eventos -----
  el.botao.addEventListener('click', function () {
    if (estado.aberto) fecharPainel(); else abrirPainel();
  });
  el.fechar.addEventListener('click', fecharPainel);
  el.voltar.addEventListener('click', mostrarLista);
  el.form.addEventListener('submit', enviar);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && estado.aberto) fecharPainel();
  });

  // Deep-link opcional: qualquer elemento com data-chat-reserva="<id>" abre a conversa.
  document.addEventListener('click', function (e) {
    var alvo = e.target.closest('[data-chat-reserva]');
    if (!alvo) return;
    e.preventDefault();
    abrirPainel(alvo.getAttribute('data-chat-reserva'));
  });

  iniciarBadgeTimer();
})();
