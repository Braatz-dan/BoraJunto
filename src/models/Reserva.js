/**
 * Model Reserva - pedidos de carona feitos por passageiros.
 * Liga o passageiro (requisito 3) a uma carona oferecida e sustenta
 * o fluxo de aceite/recusa do motorista.
 */
const { db } = require('../config/db');

const Reserva = {
  /** Cria um pedido de carona. Retorna o id. Lanca erro se ja existir (UNIQUE). */
  criar({ carona_id, passageiro_id }) {
    return db.prepare(
      `INSERT INTO reservas (carona_id, passageiro_id) VALUES (?, ?)`
    ).run(carona_id, passageiro_id).lastInsertRowid;
  },

  buscarPorId(id) {
    return db.prepare('SELECT * FROM reservas WHERE id = ?').get(id);
  },

  /** Verifica se o passageiro ja pediu carona nesta viagem. */
  existe(carona_id, passageiro_id) {
    return db.prepare(
      'SELECT * FROM reservas WHERE carona_id = ? AND passageiro_id = ?'
    ).get(carona_id, passageiro_id);
  },

  /** Reservas de um passageiro, com dados da carona e do motorista. */
  listarPorPassageiro(passageiroId) {
    return db.prepare(
      `SELECT r.*,
              c.origem, c.destino, c.sentido, c.data_viagem, c.horario, c.valor_rateio, c.status AS carona_status,
              c.motorista_id,
              u.nome AS motorista_nome, u.telefone AS motorista_telefone
       FROM reservas r
       JOIN caronas  c ON c.id = r.carona_id
       JOIN usuarios u ON u.id = c.motorista_id
       WHERE r.passageiro_id = ?
       ORDER BY c.data_viagem DESC, c.horario DESC`
    ).all(passageiroId);
  },

  /** Reservas recebidas em uma carona (para o motorista aceitar/recusar). */
  listarPorCarona(caronaId) {
    return db.prepare(
      `SELECT r.*,
              u.nome AS passageiro_nome, u.telefone AS passageiro_telefone, u.email AS passageiro_email
       FROM reservas r
       JOIN usuarios u ON u.id = r.passageiro_id
       WHERE r.carona_id = ?
       ORDER BY r.criado_em ASC`
    ).all(caronaId);
  },

  atualizarStatus(id, status) {
    db.prepare('UPDATE reservas SET status = ? WHERE id = ?').run(status, id);
  },

  /** Reservas ACEITAS de uma carona — os passageiros confirmados.
   *  Usada para avisar todo mundo quando o motorista inicia a corrida. */
  listarAceitasPorCarona(caronaId) {
    return db.prepare(
      `SELECT r.id, r.passageiro_id, u.nome AS passageiro_nome
         FROM reservas r
         JOIN usuarios u ON u.id = r.passageiro_id
        WHERE r.carona_id = ? AND r.status = 'aceita'`
    ).all(caronaId);
  },
};

module.exports = Reserva;
