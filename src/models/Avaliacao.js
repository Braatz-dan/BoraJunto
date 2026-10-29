/**
 * Model Avaliacao - avaliacao mutua entre usuarios apos a viagem (requisito 5).
 */
const { db } = require('../config/db');

const Avaliacao = {
  /** Registra uma avaliacao (1 a 5). UNIQUE evita avaliar a mesma pessoa 2x na carona. */
  criar({ carona_id, avaliador_id, avaliado_id, nota, comentario }) {
    return db.prepare(
      `INSERT INTO avaliacoes (carona_id, avaliador_id, avaliado_id, nota, comentario)
       VALUES (?, ?, ?, ?, ?)`
    ).run(carona_id, avaliador_id, avaliado_id, nota, comentario || null).lastInsertRowid;
  },

  /** Ja existe avaliacao deste avaliador para este avaliado nesta carona? */
  existe(carona_id, avaliador_id, avaliado_id) {
    return db.prepare(
      `SELECT * FROM avaliacoes
       WHERE carona_id = ? AND avaliador_id = ? AND avaliado_id = ?`
    ).get(carona_id, avaliador_id, avaliado_id);
  },

  /** Avaliacoes recebidas por um usuario (exibidas no perfil). */
  listarPorAvaliado(avaliadoId) {
    return db.prepare(
      `SELECT a.*, u.nome AS avaliador_nome
       FROM avaliacoes a
       JOIN usuarios u ON u.id = a.avaliador_id
       WHERE a.avaliado_id = ?
       ORDER BY a.criado_em DESC`
    ).all(avaliadoId);
  },
};

module.exports = Avaliacao;
