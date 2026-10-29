/**
 * Model Veiculo - carros salvos de um usuário (tabela "veiculos").
 * O motorista cadastra o carro uma vez e reaproveita ao oferecer caronas,
 * sem precisar digitar modelo/placa/cor toda vez.
 */
const { db } = require('../config/db');

const Veiculo = {
  /** Cadastra um carro para o usuário. Retorna o id. */
  criar({ usuario_id, modelo, placa, cor, capacidade }) {
    return db.prepare(
      `INSERT INTO veiculos (usuario_id, modelo, placa, cor, capacidade)
       VALUES (@usuario_id, @modelo, @placa, @cor, @capacidade)`
    ).run({
      usuario_id,
      modelo,
      placa: placa || null,
      cor: cor || null,
      capacidade: capacidade || 4,
    }).lastInsertRowid;
  },

  /** Carros de um usuário (os mais recentes primeiro). */
  listarPorUsuario(usuarioId) {
    return db.prepare(
      'SELECT * FROM veiculos WHERE usuario_id = ? ORDER BY criado_em DESC, id DESC'
    ).all(usuarioId);
  },

  buscarPorId(id) {
    return db.prepare('SELECT * FROM veiculos WHERE id = ?').get(id);
  },

  /** Já existe um carro igual (mesmo modelo+placa) deste usuário? Evita duplicar. */
  existeIgual(usuarioId, modelo, placa) {
    return db.prepare(
      `SELECT * FROM veiculos
        WHERE usuario_id = ? AND modelo = ? AND IFNULL(placa,'') = IFNULL(?, '')`
    ).get(usuarioId, modelo, placa || null);
  },

  /** Remove um carro — só se for do próprio usuário (checagem de dono embutida). */
  remover(id, usuarioId) {
    return db.prepare('DELETE FROM veiculos WHERE id = ? AND usuario_id = ?').run(id, usuarioId);
  },
};

module.exports = Veiculo;
