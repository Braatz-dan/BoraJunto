// Lado servidor do chat. As respostas são JSON — quem consome é o widget
// (public/js/chat.js), não uma página. Cada conversa mora numa reserva, e só as
// duas pessoas dela podem abrir ou escrever.
const Mensagem = require('../models/Mensagem');

const LIMITE_TEXTO = 1000;

// Um resuminho da conversa (a rota e o sentido) para mostrar na lista e no topo.
function contextoDaConversa(c) {
  return {
    reservaId: c.reserva_id,
    caronaId: c.carona_id,
    rota: `${c.origem} → ${c.destino}`,
    sentido: c.sentido,
    data: c.data_viagem,
    horario: c.horario,
    caronaStatus: c.carona_status,
  };
}

const mensagemController = {
  // GET /mensagens/nao-lidas -> { total }
  // O widget bate aqui de tempos em tempos só para saber se acende o balãozinho.
  // De propósito, a rota mais barata do chat.
  naoLidas(req, res) {
    res.json({ total: Mensagem.totalNaoLidas(req.session.usuarioId) });
  },

  // GET /mensagens/conversas -> a lista de conversas de quem está logado
  conversas(req, res) {
    const lista = Mensagem.listarConversas(req.session.usuarioId).map((c) => ({
      reservaId: c.reserva_id,
      outroNome: c.outro_nome,
      souMotorista: !!c.sou_motorista,
      rota: `${c.origem} → ${c.destino}`,
      sentido: c.sentido,
      data: c.data_viagem,
      horario: c.horario,
      caronaStatus: c.carona_status,
      ultimaTexto: c.ultima_texto,
      ultimaEm: c.ultima_em,
      naoLidas: c.nao_lidas,
    }));
    res.json({ conversas: lista });
  },

  // GET /mensagens/conversas/:reservaId -> as mensagens e o cabeçalho.
  // Abrir a conversa já marca como lidas as mensagens da outra pessoa.
  thread(req, res) {
    const conversa = Mensagem.conversa(req.params.reservaId);
    if (!Mensagem.participa(conversa, req.session.usuarioId)) {
      return res.status(403).json({ erro: 'Conversa nao encontrada.' });
    }

    const euSouMotorista = conversa.motorista_id === req.session.usuarioId;
    const outroNome = euSouMotorista ? conversa.passageiro_nome : conversa.motorista_nome;

    Mensagem.marcarLidas(conversa.reserva_id, req.session.usuarioId);

    const mensagens = Mensagem.listar(conversa.reserva_id).map((m) => ({
      id: m.id,
      minha: m.remetente_id === req.session.usuarioId,
      texto: m.texto,
      criadoEm: m.criado_em,
    }));

    res.json({
      contexto: { ...contextoDaConversa(conversa), outroNome, souMotorista: euSouMotorista },
      mensagens,
    });
  },

  // POST /mensagens/conversas/:reservaId  { texto } -> a mensagem recém-criada
  enviar(req, res) {
    const conversa = Mensagem.conversa(req.params.reservaId);
    if (!Mensagem.participa(conversa, req.session.usuarioId)) {
      return res.status(403).json({ erro: 'Conversa nao encontrada.' });
    }

    const texto = String(req.body.texto || '').trim();
    if (!texto) return res.status(400).json({ erro: 'Mensagem vazia.' });
    if (texto.length > LIMITE_TEXTO) {
      return res.status(400).json({ erro: `Mensagem muito longa (maximo ${LIMITE_TEXTO} caracteres).` });
    }

    const msg = Mensagem.criar({
      reserva_id: conversa.reserva_id,
      remetente_id: req.session.usuarioId,
      texto,
    });

    res.status(201).json({
      mensagem: { id: msg.id, minha: true, texto: msg.texto, criadoEm: msg.criado_em },
    });
  },
};

module.exports = mensagemController;
