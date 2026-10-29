/**
 * Controller da localização ao vivo da corrida.
 * Só participantes de uma corrida EM ANDAMENTO (motorista + passageiros aceitos)
 * enviam e veem posições. As respostas de enviar/listar são JSON (o mapa é o
 * cliente, via public/js/mapa — carregado na própria página).
 */
const Localizacao = require('../models/Localizacao');

const localizacaoController = {
  /** Página do mapa ao vivo da corrida. */
  mapa(req, res) {
    const carona = Localizacao.caronaAoVivoSeParticipante(req.params.id, req.session.usuarioId);
    if (!carona) {
      req.session.flash = { tipo: 'erro', texto: 'Esta corrida não está em andamento ou você não participa dela.' };
      return res.redirect('/caronas/minhas');
    }
    const souMotorista = carona.motorista_id === req.session.usuarioId;
    res.render('caronas/mapa', {
      titulo: 'Localização da corrida',
      carona,
      souMotorista,
      meuId: req.session.usuarioId,
    });
  },

  /** POST: envia a minha posição. Body { lat, lng }. */
  enviar(req, res) {
    const carona = Localizacao.caronaAoVivoSeParticipante(req.params.id, req.session.usuarioId);
    if (!carona) return res.status(403).json({ erro: 'Corrida indisponível.' });

    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const ok = Number.isFinite(lat) && Number.isFinite(lng) &&
               lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    if (!ok) return res.status(400).json({ erro: 'Coordenadas inválidas.' });

    Localizacao.salvar(carona.id, req.session.usuarioId, lat, lng);
    res.json({ ok: true });
  },

  /** GET: posições recentes de todos os participantes. */
  listar(req, res) {
    const carona = Localizacao.caronaAoVivoSeParticipante(req.params.id, req.session.usuarioId);
    if (!carona) return res.status(403).json({ erro: 'Corrida indisponível.' });

    const pontos = Localizacao.listar(carona.id).map((p) => ({
      usuarioId: p.usuario_id,
      nome: p.nome,
      papel: p.papel,
      lat: p.lat,
      lng: p.lng,
      atualizadoEm: p.atualizado_em,
      souEu: p.usuario_id === req.session.usuarioId,
    }));
    res.json({ pontos });
  },
};

module.exports = localizacaoController;
