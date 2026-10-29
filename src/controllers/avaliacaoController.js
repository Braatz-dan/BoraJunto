/**
 * Controller de avaliacoes - avaliacao mutua apos a viagem (requisito 5).
 */
const Avaliacao = require('../models/Avaliacao');
const Carona = require('../models/Carona');
const Reserva = require('../models/Reserva');
const Usuario = require('../models/Usuario');
const Veiculo = require('../models/Veiculo');

const avaliacaoController = {
  /**
   * Tela para avaliar o outro participante de uma carona.
   * Motorista avalia passageiros aceitos; passageiro avalia o motorista.
   */
  tela(req, res) {
    const carona = Carona.buscarPorId(req.params.caronaId);
    const meuId = req.session.usuarioId;
    if (!carona) {
      req.session.flash = { tipo: 'erro', texto: 'Carona nao encontrada.' };
      return res.redirect('/caronas/minhas');
    }

    let avaliaveis = [];
    if (carona.motorista_id === meuId) {
      // Motorista avalia os passageiros aceitos.
      avaliaveis = Reserva.listarPorCarona(carona.id)
        .filter((r) => r.status === 'aceita')
        .map((r) => ({ id: r.passageiro_id, nome: r.passageiro_nome }));
    } else {
      // Passageiro (com reserva aceita) avalia o motorista.
      const minha = Reserva.existe(carona.id, meuId);
      if (minha && minha.status === 'aceita') {
        avaliaveis = [{ id: carona.motorista_id, nome: carona.motorista_nome }];
      }
    }

    if (avaliaveis.length === 0) {
      req.session.flash = { tipo: 'erro', texto: 'Nao ha ninguem para avaliar nesta carona.' };
      return res.redirect('/caronas/minhas');
    }

    // Marca quem ja foi avaliado por mim nesta carona.
    avaliaveis = avaliaveis.map((p) => ({
      ...p,
      jaAvaliado: !!Avaliacao.existe(carona.id, meuId, p.id),
    }));

    res.render('avaliacoes/nova', { titulo: 'Avaliar', carona, avaliaveis });
  },

  registrar(req, res) {
    const carona = Carona.buscarPorId(req.params.caronaId);
    const meuId = req.session.usuarioId;
    const { avaliado_id, nota, comentario } = req.body;

    if (!carona) {
      req.session.flash = { tipo: 'erro', texto: 'Carona nao encontrada.' };
      return res.redirect('/caronas/minhas');
    }

    const notaNum = parseInt(nota, 10);
    if (!avaliado_id || !(notaNum >= 1 && notaNum <= 5)) {
      req.session.flash = { tipo: 'erro', texto: 'Selecione quem avaliar e uma nota de 1 a 5.' };
      return res.redirect(`/caronas/${carona.id}/avaliar`);
    }

    // Verifica vinculo real com a carona (evita avaliar estranhos).
    const souMotorista = carona.motorista_id === meuId;
    const minhaReserva = Reserva.existe(carona.id, meuId);
    const souPassageiroAceito = minhaReserva && minhaReserva.status === 'aceita';
    if (!souMotorista && !souPassageiroAceito) {
      req.session.flash = { tipo: 'erro', texto: 'Voce nao participou desta carona.' };
      return res.redirect('/caronas/minhas');
    }

    if (Avaliacao.existe(carona.id, meuId, Number(avaliado_id))) {
      req.session.flash = { tipo: 'erro', texto: 'Voce ja avaliou esta pessoa nesta carona.' };
      return res.redirect('/caronas/minhas');
    }

    Avaliacao.criar({
      carona_id: carona.id,
      avaliador_id: meuId,
      avaliado_id: Number(avaliado_id),
      nota: notaNum,
      comentario,
    });

    req.session.flash = { tipo: 'sucesso', texto: 'Avaliacao registrada. Obrigado!' };
    res.redirect('/caronas/minhas');
  },

  /** Perfil publico com reputacao e avaliacoes recebidas. */
  perfil(req, res) {
    const alvo = Usuario.buscarPorId(req.params.id);
    if (!alvo) {
      req.session.flash = { tipo: 'erro', texto: 'Usuario nao encontrado.' };
      return res.redirect('/caronas/buscar');
    }
    const reputacao = Usuario.reputacao(alvo.id);
    const avaliacoes = Avaliacao.listarPorAvaliado(alvo.id);
    // Carros só aparecem no próprio perfil (gestão pessoal).
    const veiculos = (req.session.usuarioId === alvo.id) ? Veiculo.listarPorUsuario(alvo.id) : [];
    res.render('perfil', { titulo: `Perfil de ${alvo.nome}`, alvo, reputacao, avaliacoes, veiculos });
  },
};

module.exports = avaliacaoController;
