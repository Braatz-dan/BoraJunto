/**
 * Model Localizacao - posição ao vivo dos participantes de uma corrida em andamento.
 * Só vale enquanto a corrida está "ao vivo" (status 'ativa' e já iniciada pelo
 * motorista). Participantes = motorista + passageiros com reserva aceita.
 */
const { db } = require('../config/db');

// Quantos segundos uma posição continua "no ar" no mapa sem nova atualização.
const JANELA_SEG = 120;

const Localizacao = {
  /**
   * Devolve a carona (com o motorista) se ela está AO VIVO e o usuário participa
   * dela — motorista ou passageiro aceito. Senão, undefined. É a checagem de
   * acesso usada por todas as rotas de localização.
   */
  caronaAoVivoSeParticipante(caronaId, usuarioId) {
    return db.prepare(
      `SELECT c.*, u.nome AS motorista_nome
         FROM caronas c
         JOIN usuarios u ON u.id = c.motorista_id
        WHERE c.id = @cid
          AND c.status = 'ativa'
          AND c.inicio_avisado_em IS NOT NULL
          AND (
            c.motorista_id = @uid
            OR EXISTS (SELECT 1 FROM reservas r
                        WHERE r.carona_id = c.id AND r.passageiro_id = @uid AND r.status = 'aceita')
          )`
    ).get({ cid: caronaId, uid: usuarioId });
  },

  /** A corrida ao vivo em que o usuário está agora (motorista ou passageiro aceito),
   *  para mostrar o aviso "Você está em uma corrida". A mais recém-iniciada vence. */
  corridaAoVivoDoUsuario(usuarioId) {
    return db.prepare(
      `SELECT c.*, u.nome AS motorista_nome,
              CASE WHEN c.motorista_id = @uid THEN 'motorista' ELSE 'passageiro' END AS papel
         FROM caronas c
         JOIN usuarios u ON u.id = c.motorista_id
        WHERE c.status = 'ativa'
          AND c.inicio_avisado_em IS NOT NULL
          AND (
            c.motorista_id = @uid
            OR EXISTS (SELECT 1 FROM reservas r
                        WHERE r.carona_id = c.id AND r.passageiro_id = @uid AND r.status = 'aceita')
          )
        ORDER BY c.inicio_avisado_em DESC
        LIMIT 1`
    ).get({ uid: usuarioId });
  },

  /** Grava/atualiza a posição de um participante (upsert por carona+usuário). */
  salvar(caronaId, usuarioId, lat, lng) {
    db.prepare(
      `INSERT INTO localizacoes (carona_id, usuario_id, lat, lng, atualizado_em)
       VALUES (@cid, @uid, @lat, @lng, datetime('now','localtime'))
       ON CONFLICT(carona_id, usuario_id)
       DO UPDATE SET lat = excluded.lat, lng = excluded.lng, atualizado_em = excluded.atualizado_em`
    ).run({ cid: caronaId, uid: usuarioId, lat, lng });
  },

  /** Posições recentes (últimos JANELA_SEG s) de todos os participantes da carona. */
  listar(caronaId) {
    return db.prepare(
      `SELECT l.usuario_id, l.lat, l.lng, l.atualizado_em,
              u.nome,
              CASE WHEN c.motorista_id = l.usuario_id THEN 'motorista' ELSE 'passageiro' END AS papel
         FROM localizacoes l
         JOIN usuarios u ON u.id = l.usuario_id
         JOIN caronas  c ON c.id = l.carona_id
        WHERE l.carona_id = @cid
          AND l.atualizado_em >= datetime('now','localtime', @janela)
        ORDER BY papel DESC, u.nome ASC`
    ).all({ cid: caronaId, janela: `-${JANELA_SEG} seconds` });
  },
};

module.exports = Localizacao;
