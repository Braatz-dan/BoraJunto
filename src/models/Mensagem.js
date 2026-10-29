// Acesso à tabela "mensagens". Cada conversa é uma reserva, e só as duas pontas
// dela (passageiro e motorista) conversam — não existe mensagem solta entre
// estranhos. É de propósito, por segurança.
const { db } = require('../config/db');

const Mensagem = {
  // A reserva + a carona + as duas pessoas. Usada para checar quem pode ver a
  // conversa e para montar o cabeçalho. undefined se a reserva não existe.
  conversa(reservaId) {
    return db.prepare(
      `SELECT r.id AS reserva_id, r.passageiro_id, r.status AS reserva_status,
              c.id AS carona_id, c.motorista_id,
              c.origem, c.destino, c.sentido, c.data_viagem, c.horario, c.status AS carona_status,
              pass.nome AS passageiro_nome,
              moto.nome AS motorista_nome
       FROM reservas r
       JOIN caronas  c    ON c.id = r.carona_id
       JOIN usuarios pass ON pass.id = r.passageiro_id
       JOIN usuarios moto ON moto.id = c.motorista_id
       WHERE r.id = ?`
    ).get(reservaId);
  },

  // O usuário faz parte desta conversa? Faz, se for o passageiro ou o motorista.
  participa(conversa, usuarioId) {
    return !!conversa && (conversa.passageiro_id === usuarioId || conversa.motorista_id === usuarioId);
  },

  // As conversas de alguém: toda reserva em que ele é passageiro ou motorista,
  // com o nome da outra pessoa, a última mensagem e as não lidas. Quem tem
  // mensagem sobe ao topo, da mais recente para a mais antiga.
  listarConversas(usuarioId) {
    return db.prepare(
      `SELECT r.id AS reserva_id,
              c.id AS carona_id, c.origem, c.destino, c.sentido,
              c.data_viagem, c.horario, c.status AS carona_status,
              CASE WHEN c.motorista_id = @uid THEN pass.nome ELSE moto.nome END AS outro_nome,
              CASE WHEN c.motorista_id = @uid THEN 1 ELSE 0 END AS sou_motorista,
              (SELECT m.texto     FROM mensagens m WHERE m.reserva_id = r.id ORDER BY m.id DESC LIMIT 1) AS ultima_texto,
              (SELECT m.criado_em FROM mensagens m WHERE m.reserva_id = r.id ORDER BY m.id DESC LIMIT 1) AS ultima_em,
              (SELECT COUNT(*)    FROM mensagens m WHERE m.reserva_id = r.id AND m.lida = 0 AND m.remetente_id <> @uid) AS nao_lidas
       FROM reservas r
       JOIN caronas  c    ON c.id = r.carona_id
       JOIN usuarios pass ON pass.id = r.passageiro_id
       JOIN usuarios moto ON moto.id = c.motorista_id
       WHERE r.passageiro_id = @uid OR c.motorista_id = @uid
       ORDER BY (ultima_em IS NULL) ASC, ultima_em DESC, r.criado_em DESC`
    ).all({ uid: usuarioId });
  },

  // Todas as mensagens de uma conversa, da mais antiga para a mais nova.
  listar(reservaId) {
    return db.prepare(
      `SELECT id, remetente_id, texto, lida, criado_em
       FROM mensagens WHERE reserva_id = ? ORDER BY id ASC`
    ).all(reservaId);
  },

  // Grava uma mensagem e devolve a linha recém-criada (o chat usa ela de volta).
  criar({ reserva_id, remetente_id, texto }) {
    const id = db.prepare(
      `INSERT INTO mensagens (reserva_id, remetente_id, texto) VALUES (?, ?, ?)`
    ).run(reserva_id, remetente_id, texto).lastInsertRowid;
    return db.prepare('SELECT id, remetente_id, texto, lida, criado_em FROM mensagens WHERE id = ?').get(id);
  },

  // Dá baixa nas mensagens que a OUTRA pessoa mandou nesta conversa.
  marcarLidas(reservaId, usuarioId) {
    db.prepare(
      `UPDATE mensagens SET lida = 1
       WHERE reserva_id = ? AND remetente_id <> ? AND lida = 0`
    ).run(reservaId, usuarioId);
  },

  // Quantas mensagens o usuário ainda não leu somando todas as conversas dele.
  // É o número que vai no balãozinho do widget.
  totalNaoLidas(usuarioId) {
    const { total } = db.prepare(
      `SELECT COUNT(*) AS total
       FROM mensagens m
       JOIN reservas r ON r.id = m.reserva_id
       JOIN caronas  c ON c.id = r.carona_id
       WHERE m.lida = 0 AND m.remetente_id <> @uid
         AND (r.passageiro_id = @uid OR c.motorista_id = @uid)`
    ).get({ uid: usuarioId });
    return total;
  },
};

module.exports = Mensagem;
