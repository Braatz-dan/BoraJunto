// Rotinas semanais de carona (tabela caronas_recorrentes). Uma rotina não é uma
// carona: é o molde ("seg a sex, 22:40, Facens -> Eden"). gerarOcorrencias()
// transforma os moldes ativos em caronas comuns com data, para os próximos dias.
// Assim busca, reserva, chat e vagas trabalham só com caronas normais e nem
// sabem que recorrência existe.
const { db } = require('../config/db');

// Quantos dias à frente gerar. Curto de propósito: não inunda "Minhas caronas" e
// o passageiro reserva semana a semana. Aumente aqui para antecipar mais.
const JANELA_DIAS = 7;

// Pequenos ajudantes de data, no horário local: "AAAA-MM-DD" e "HH:MM".
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

const Recorrencia = {
  // Grava uma rotina nova e devolve o id dela.
  criar(dados) {
    return db.prepare(
      `INSERT INTO caronas_recorrentes
        (motorista_id, origem, destino, sentido, ponto_referencia, cep, bairro, cidade, uf,
         dias_semana, horario, veiculo_modelo, veiculo_placa, veiculo_cor,
         vagas_total, valor_rateio, observacoes, validade, ativa)
       VALUES
        (@motorista_id, @origem, @destino, @sentido, @ponto_referencia, @cep, @bairro, @cidade, @uf,
         @dias_semana, @horario, @veiculo_modelo, @veiculo_placa, @veiculo_cor,
         @vagas_total, @valor_rateio, @observacoes, @validade, 1)`
    ).run(dados).lastInsertRowid;
  },

  buscarPorId(id) {
    return db.prepare('SELECT * FROM caronas_recorrentes WHERE id = ?').get(id);
  },

  // As rotinas de um motorista, já com quantos pedidos ainda estão esperando
  // resposta nas caronas que cada rotina gerou.
  listarPorMotorista(motoristaId) {
    return db.prepare(
      `SELECT r.*,
              (SELECT COUNT(*) FROM reservas res
                 JOIN caronas c ON c.id = res.carona_id
                WHERE c.recorrencia_id = r.id AND res.status = 'pendente') AS pedidos_pendentes
       FROM caronas_recorrentes r
       WHERE r.motorista_id = ?
       ORDER BY r.ativa DESC, r.criado_em DESC`
    ).all(motoristaId);
  },

  // Liga/desliga a rotina (se ela segue gerando datas). É o "pausar" e o "retomar".
  definirAtiva(id, ativa) {
    db.prepare('UPDATE caronas_recorrentes SET ativa = ? WHERE id = ?').run(ativa ? 1 : 0, id);
  },

  // Cria as caronas dos próximos JANELA_DIAS dias a partir das rotinas ativas.
  // Pode chamar à vontade (a cada tela, por exemplo): o índice único parcial
  // (recorrencia_id, data_viagem) + INSERT OR IGNORE garante uma data só uma vez,
  // e ocorrência encerrada ou cancelada não volta — a linha fica, o IGNORE pula.
  gerarOcorrencias() {
    const templates = db.prepare('SELECT * FROM caronas_recorrentes WHERE ativa = 1').all();
    if (!templates.length) return;

    const agora = new Date();
    const hojeStr = ymd(agora);
    const horaAgora = hm(agora);

    const inserir = db.prepare(
      `INSERT OR IGNORE INTO caronas
        (motorista_id, origem, destino, sentido, ponto_referencia, cep, bairro, cidade, uf,
         data_viagem, horario, veiculo_modelo, veiculo_placa, veiculo_cor,
         vagas_total, vagas_disponiveis, valor_rateio, observacoes, status, recorrencia_id)
       VALUES
        (@motorista_id, @origem, @destino, @sentido, @ponto_referencia, @cep, @bairro, @cidade, @uf,
         @data_viagem, @horario, @veiculo_modelo, @veiculo_placa, @veiculo_cor,
         @vagas_total, @vagas_total, @valor_rateio, @observacoes, 'ativa', @recorrencia_id)`
    );

    const gerar = db.transaction(() => {
      for (const t of templates) {
        if (t.validade && t.validade < hojeStr) continue; // rotina já venceu
        const dias = String(t.dias_semana)
          .split(',').map((s) => parseInt(s, 10)).filter((n) => n >= 0 && n <= 6);
        if (!dias.length) continue;

        for (let i = 0; i < JANELA_DIAS; i++) {
          const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i);
          if (!dias.includes(d.getDay())) continue;
          const dataStr = ymd(d);
          if (t.validade && dataStr > t.validade) continue;
          // Não cria a ocorrência de HOJE se o horário de saída já passou.
          if (dataStr === hojeStr && t.horario <= horaAgora) continue;

          inserir.run({
            motorista_id: t.motorista_id,
            origem: t.origem, destino: t.destino, sentido: t.sentido,
            ponto_referencia: t.ponto_referencia,
            cep: t.cep, bairro: t.bairro, cidade: t.cidade, uf: t.uf,
            data_viagem: dataStr, horario: t.horario,
            veiculo_modelo: t.veiculo_modelo, veiculo_placa: t.veiculo_placa, veiculo_cor: t.veiculo_cor,
            vagas_total: t.vagas_total, valor_rateio: t.valor_rateio, observacoes: t.observacoes,
            recorrencia_id: t.id,
          });
        }
      }
    });
    gerar();
  },
};

module.exports = Recorrencia;
