/**
 * Model Usuario - acesso a dados da tabela "usuarios".
 * Toda a comunicacao com o banco relativa a usuarios passa por aqui.
 */
const { db } = require('../config/db');

const Usuario = {
  /** Cria um usuario. Recebe a senha ja com hash. Retorna o id gerado. */
  criar({ nome, ra, email, senha_hash, telefone }) {
    const stmt = db.prepare(
      `INSERT INTO usuarios (nome, ra, email, senha_hash, telefone)
       VALUES (?, ?, ?, ?, ?)`
    );
    const info = stmt.run(nome, ra || null, email, senha_hash, telefone || null);
    return info.lastInsertRowid;
  },

  /** Busca por e-mail (usado no login e para impedir cadastro duplicado). */
  buscarPorEmail(email) {
    return db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  },

  /** Busca por id. */
  buscarPorId(id) {
    return db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  },

  /** Atualiza dados de perfil (nome/telefone). */
  atualizarPerfil(id, { nome, telefone }) {
    db.prepare('UPDATE usuarios SET nome = ?, telefone = ? WHERE id = ?')
      .run(nome, telefone || null, id);
  },

  /** Verifica se o e-mail já está em uso por OUTRO usuário (para não duplicar). */
  emailEmUso(email, excetoId) {
    return db.prepare('SELECT id FROM usuarios WHERE email = ? AND id <> ?').get(email, excetoId);
  },

  /** Troca o e-mail (login) do usuário. */
  atualizarEmail(id, email) {
    db.prepare('UPDATE usuarios SET email = ? WHERE id = ?').run(email, id);
  },

  /** Troca a senha (recebe o hash já pronto). */
  atualizarSenha(id, senha_hash) {
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(senha_hash, id);
  },

  /** Define (ou remove, com null) a foto de perfil — data URL base64. */
  atualizarFoto(id, foto) {
    db.prepare('UPDATE usuarios SET foto = ? WHERE id = ?').run(foto || null, id);
  },

  // ---- Administração ----------------------------------------------------

  /** Todos os usuários, com contagens e nota, para o painel do admin. */
  listarTodos() {
    return db.prepare(
      `SELECT u.id, u.nome, u.email, u.telefone, u.papel, u.banido, u.foto, u.criado_em,
              (SELECT COUNT(*) FROM caronas  c WHERE c.motorista_id  = u.id) AS n_caronas,
              (SELECT COUNT(*) FROM reservas r WHERE r.passageiro_id = u.id) AS n_reservas,
              ROUND((SELECT AVG(nota) FROM avaliacoes WHERE avaliado_id = u.id) * u.fator_reputacao, 1) AS nota,
              (SELECT COUNT(*) FROM avaliacoes WHERE avaliado_id = u.id) AS n_avaliacoes
         FROM usuarios u
        ORDER BY u.banido ASC, u.criado_em DESC`
    ).all();
  },

  /** Contagens gerais para o painel. */
  totais() {
    return {
      usuarios: db.prepare('SELECT COUNT(*) n FROM usuarios').get().n,
      banidos: db.prepare('SELECT COUNT(*) n FROM usuarios WHERE banido = 1').get().n,
      admins: db.prepare("SELECT COUNT(*) n FROM usuarios WHERE papel = 'admin'").get().n,
      caronas: db.prepare('SELECT COUNT(*) n FROM caronas').get().n,
      caronasAtivas: db.prepare("SELECT COUNT(*) n FROM caronas WHERE status = 'ativa'").get().n,
      reservas: db.prepare('SELECT COUNT(*) n FROM reservas').get().n,
    };
  },

  /** Bane/desbane por id. */
  definirBanido(id, banido) {
    db.prepare('UPDATE usuarios SET banido = ? WHERE id = ?').run(banido ? 1 : 0, id);
  },

  /** Bane/desbane pelo e-mail. Devolve o usuário afetado, ou null se não existe. */
  definirBanidoPorEmail(email, banido) {
    const u = this.buscarPorEmail(String(email || '').toLowerCase().trim());
    if (!u) return null;
    this.definirBanido(u.id, banido);
    return u;
  },

  ehAdmin(usuario) {
    return !!usuario && usuario.papel === 'admin';
  },

  /**
   * Media de avaliacoes recebidas pelo usuario e quantidade de avaliacoes.
   * Usado no perfil e nos cartoes de carona.
   */
  reputacao(id) {
    // A média é multiplicada pelo fator de reputação do usuário (penalidades de
    // cancelamento o reduzem). Sem avaliações, media fica null (total = 0).
    return db.prepare(
      `SELECT ROUND(AVG(a.nota) * u.fator_reputacao, 1) AS media,
              COUNT(a.id) AS total
       FROM usuarios u
       LEFT JOIN avaliacoes a ON a.avaliado_id = u.id
       WHERE u.id = ?`
    ).get(id);
  },

  /** Penaliza o motorista por cancelar uma corrida: perde 10% da nota atual
   *  (fator x0.9, acumulativo). Guardado com 4 casas para não degradar. */
  penalizarPorCancelamento(id) {
    db.prepare(
      `UPDATE usuarios SET fator_reputacao = ROUND(fator_reputacao * 0.9, 4) WHERE id = ?`
    ).run(id);
  },
};

module.exports = Usuario;
