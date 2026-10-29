/**
 * Model Carona - acesso a dados da tabela "caronas".
 * Cobre os requisitos 2 (Oferecer), 3 (Buscar) e 4 (Pareamento de trajetos).
 */
const { db } = require('../config/db');

const Carona = {
  /** Cria uma carona oferecida por um motorista. Retorna o id.
   *  vagas_disponiveis nasce igual a vagas_total (lugares do carro). */
  criar(dados) {
    const stmt = db.prepare(
      `INSERT INTO caronas
        (motorista_id, origem, destino, sentido, ponto_referencia, cep, bairro, cidade, uf,
         data_viagem, horario, veiculo_modelo, veiculo_placa, veiculo_cor,
         vagas_total, vagas_disponiveis, valor_rateio, observacoes, status)
       VALUES
        (@motorista_id, @origem, @destino, @sentido, @ponto_referencia, @cep, @bairro, @cidade, @uf,
         @data_viagem, @horario, @veiculo_modelo, @veiculo_placa, @veiculo_cor,
         @vagas_total, @vagas_total, @valor_rateio, @observacoes, 'ativa')`
    );
    return stmt.run(dados).lastInsertRowid;
  },

  /** Busca uma carona pelo id, ja com os dados do motorista. */
  buscarPorId(id) {
    return db.prepare(
      `SELECT c.*,
              u.nome  AS motorista_nome,
              u.email AS motorista_email,
              u.telefone AS motorista_telefone
       FROM caronas c
       JOIN usuarios u ON u.id = c.motorista_id
       WHERE c.id = ?`
    ).get(id);
  },

  /**
   * Busca/pareamento de caronas (requisitos 3 e 4).
   * Filtros opcionais:
   *   - regiao:    texto (trajeto/bairro/cidade) — casa em varios campos.
   *   - diaSemana: '0'..'6' (0=Dom ... 6=Sab) OU 'uteis' (seg a sex).
   *   - horario:   'HH:MM' — caronas que saem a partir desse horario.
   *   - data:      'YYYY-MM-DD' — dia exato (opcional).
   * So retorna caronas ativas e com lugar disponivel, ordenadas por data/horario.
   */
  buscar({ regiao, diaSemana, horario, data, sentido } = {}) {
    const condicoes = ["c.status = 'ativa'", 'c.vagas_disponiveis > 0'];
    const params = {};

    // Só caronas que ainda vão acontecer: data futura, ou data de hoje com
    // horário que ainda não passou. Esconde as de datas antigas/já saídas.
    // (Mesma régua do Recorrencia.gerarOcorrencias, que não gera a de hoje já vencida.)
    condicoes.push(`(
      c.data_viagem > date('now','localtime')
      OR (c.data_viagem = date('now','localtime') AND c.horario >= strftime('%H:%M','now','localtime'))
    )`);

    if (sentido === 'ida' || sentido === 'volta') {
      condicoes.push('c.sentido = @sentido');
      params.sentido = sentido;
    }

    if (regiao) {
      // Pareamento por trajeto/regiao: casa em origem, destino, ponto, bairro e cidade.
      condicoes.push(`(
        c.destino LIKE @termo OR c.origem LIKE @termo OR c.ponto_referencia LIKE @termo
        OR c.bairro LIKE @termo OR c.cidade LIKE @termo
      )`);
      params.termo = `%${regiao}%`;
    }

    if (diaSemana === 'uteis') {
      condicoes.push("strftime('%w', c.data_viagem) IN ('1','2','3','4','5')");
    } else if (diaSemana !== undefined && diaSemana !== '' && diaSemana !== null) {
      condicoes.push("strftime('%w', c.data_viagem) = @dia");
      params.dia = String(diaSemana);
    }

    if (horario) {
      // Compativel = a partir do horario informado (o passageiro sai depois da aula).
      condicoes.push('c.horario >= @horario');
      params.horario = horario;
    }
    if (data) {
      condicoes.push('c.data_viagem = @data');
      params.data = data;
    }

    const sql =
      `SELECT c.*,
              u.nome AS motorista_nome,
              ROUND((SELECT AVG(nota) FROM avaliacoes WHERE avaliado_id = c.motorista_id) * u.fator_reputacao, 1) AS motorista_nota
       FROM caronas c
       JOIN usuarios u ON u.id = c.motorista_id
       WHERE ${condicoes.join(' AND ')}
       ORDER BY c.data_viagem ASC, c.horario ASC`;

    return db.prepare(sql).all(params);
  },

  /** Caronas oferecidas por um motorista (tela "Minhas caronas"). */
  listarPorMotorista(motoristaId) {
    return db.prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM reservas r
                WHERE r.carona_id = c.id AND r.status = 'pendente') AS pedidos_pendentes
       FROM caronas c
       WHERE c.motorista_id = ?
       ORDER BY c.data_viagem DESC, c.horario DESC`
    ).all(motoristaId);
  },

  /** Desconta uma vaga (ao aceitar um passageiro). */
  decrementarVaga(id) {
    db.prepare(
      `UPDATE caronas SET vagas_disponiveis = vagas_disponiveis - 1
       WHERE id = ? AND vagas_disponiveis > 0`
    ).run(id);
  },

  /** Devolve uma vaga (ao cancelar uma reserva aceita). */
  incrementarVaga(id) {
    db.prepare(
      `UPDATE caronas SET vagas_disponiveis = vagas_disponiveis + 1
       WHERE id = ? AND vagas_disponiveis < vagas_total`
    ).run(id);
  },

  /** Muda o status (ativa | encerrada | cancelada). */
  atualizarStatus(id, status) {
    db.prepare('UPDATE caronas SET status = ? WHERE id = ?').run(status, id);
  },

  /** TODAS as caronas, com motorista e nº de pedidos — para o painel do admin. */
  listarTodas() {
    return db.prepare(
      `SELECT c.*,
              u.nome AS motorista_nome, u.email AS motorista_email,
              (SELECT COUNT(*) FROM reservas r WHERE r.carona_id = c.id) AS n_reservas
         FROM caronas c
         JOIN usuarios u ON u.id = c.motorista_id
        ORDER BY c.data_viagem DESC, c.horario DESC`
    ).all();
  },

  /** Remove uma carona (cascata apaga reservas, mensagens, avaliações e posições). */
  remover(id) {
    db.prepare('DELETE FROM caronas WHERE id = ?').run(id);
  },

  /** Motorista avisou que a corrida vai começar: grava "em X min" e o ponto
   *  de encontro, e carimba a hora do aviso. Pode ser chamado de novo para
   *  reenviar (atualiza os campos). */
  marcarInicio(id, minutos, pontoEncontro) {
    db.prepare(
      `UPDATE caronas
          SET inicio_minutos    = @minutos,
              ponto_encontro    = @ponto,
              inicio_avisado_em = datetime('now', 'localtime')
        WHERE id = @id`
    ).run({ id, minutos, ponto: pontoEncontro });
  },
};

module.exports = Carona;
