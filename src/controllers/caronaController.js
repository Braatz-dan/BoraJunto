/**
 * Controller de caronas: oferecer, buscar/parear, gerenciar reservas.
 * Requisitos 2 (Oferecer), 3 (Buscar) e 4 (Pareamento de trajetos).
 */
const Carona = require('../models/Carona');
const Reserva = require('../models/Reserva');
const Usuario = require('../models/Usuario');
const Recorrencia = require('../models/Recorrencia');
const Mensagem = require('../models/Mensagem');
const Avaliacao = require('../models/Avaliacao');
const Veiculo = require('../models/Veiculo');
const { buscarCep, limparCep } = require('../lib/cep');

// Rótulos dos dias da semana (0=Domingo ... 6=Sábado), para os selects e telas.
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Pausa/retoma uma rotina do motorista logado (checa dono). Fora do objeto
// para não depender de `this` (os handlers são chamados desvinculados).
function definirRotina(req, res, ativa, msg) {
  const rotina = Recorrencia.buscarPorId(req.params.id);
  if (!rotina || rotina.motorista_id !== req.session.usuarioId) {
    req.session.flash = { tipo: 'erro', texto: 'Ação não permitida.' };
    return res.redirect('/caronas/minhas');
  }
  Recorrencia.definirAtiva(rotina.id, ativa);
  if (ativa) Recorrencia.gerarOcorrencias(); // ao retomar, repõe as próximas datas
  req.session.flash = { tipo: 'sucesso', texto: msg };
  res.redirect('/caronas/minhas');
}

const caronaController = {
  // ---- Requisito 2: Oferecer carona -------------------------------------
  telaOferecer(req, res) {
    res.render('caronas/oferecer', {
      titulo: 'Oferecer carona',
      dados: {},
      diasSemana: DIAS_SEMANA,
      veiculos: Veiculo.listarPorUsuario(req.session.usuarioId),
    });
  },

  async oferecer(req, res) {
    const b = req.body;
    const recorrente = !!b.recorrente;
    const sentidoOk = b.sentido === 'ida' ? 'ida' : 'volta'; // padrão: volta (da faculdade)

    const falhar = (texto) => {
      req.session.flash = { tipo: 'erro', texto };
      return res.status(400).render('caronas/oferecer', {
        titulo: 'Oferecer carona', flash: { tipo: 'erro', texto },
        dados: b, diasSemana: DIAS_SEMANA,
        veiculos: Veiculo.listarPorUsuario(req.session.usuarioId),
      });
    };

    // Validações comuns à carona avulsa e à rotina.
    if (!b.origem || !b.destino || !b.horario) {
      return falhar('Preencha origem, destino e horário.');
    }
    if (!b.veiculo_modelo || !b.veiculo_modelo.trim()) {
      return falhar('Informe o carro que fará a carona (modelo).');
    }
    const lugares = parseInt(b.vagas_total, 10);
    if (!(lugares >= 1 && lugares <= 8)) {
      return falhar('Informe de 1 a 8 lugares disponíveis no carro.');
    }

    // Região do destino: o bairro digitado tem prioridade; cidade/UF vêm do CEP.
    const bairroDigitado = (b.bairro || '').trim();
    let regiao = { cep: null, bairro: bairroDigitado || null, cidade: null, uf: null };
    if (b.cep && limparCep(b.cep).length === 8) {
      const r = await buscarCep(b.cep);
      if (r) {
        regiao = {
          cep: r.cep,
          bairro: bairroDigitado || r.bairro || null, // digitado vence; senão o do CEP
          cidade: r.cidade || null,
          uf: r.uf || null,
        };
      } else {
        regiao.cep = limparCep(b.cep); // guarda o CEP mesmo se o ViaCEP não responder
      }
    }

    // Campos compartilhados por carona avulsa e rotina (sem data nem dias ainda).
    const comum = {
      motorista_id: req.session.usuarioId,
      origem: b.origem.trim(),
      destino: b.destino.trim(),
      sentido: sentidoOk,
      ponto_referencia: (b.ponto_referencia || '').trim() || null,
      cep: regiao.cep, bairro: regiao.bairro, cidade: regiao.cidade, uf: regiao.uf,
      horario: b.horario,
      veiculo_modelo: b.veiculo_modelo.trim(),
      veiculo_placa: (b.veiculo_placa || '').trim().toUpperCase() || null,
      veiculo_cor: (b.veiculo_cor || '').trim() || null,
      vagas_total: lugares,
      valor_rateio: parseFloat(String(b.valor_rateio).replace(',', '.')) || 0,
      observacoes: (b.observacoes || '').trim() || null,
    };

    // Se o motorista pediu, guarda este carro no perfil para reusar depois
    // (não duplica o que já está salvo). Falha aqui nunca derruba a publicação.
    if (b.salvar_veiculo) {
      try {
        if (!Veiculo.existeIgual(req.session.usuarioId, comum.veiculo_modelo, comum.veiculo_placa)) {
          Veiculo.criar({
            usuario_id: req.session.usuarioId,
            modelo: comum.veiculo_modelo,
            placa: comum.veiculo_placa,
            cor: comum.veiculo_cor,
            capacidade: lugares,
          });
        }
      } catch (e) { /* salvar o carro é um extra; ignora erro */ }
    }

    // ----- Rotina semanal (recorrente): cria o molde e já gera as caronas -----
    if (recorrente) {
      // "dias_semana" pode vir como string (um dia) ou array (vários checkboxes).
      const brutos = [].concat(b.dias_semana || []);
      const dias = Array.from(new Set(
        brutos.map((d) => parseInt(d, 10)).filter((n) => n >= 0 && n <= 6)
      )).sort((x, y) => x - y);
      if (!dias.length) return falhar('Escolha pelo menos um dia da semana para a rotina.');

      Recorrencia.criar({
        ...comum,
        dias_semana: dias.join(','),
        validade: (b.validade || '').trim() || null, // YYYY-MM-DD opcional; vazio = sem fim
      });
      Recorrencia.gerarOcorrencias(); // materializa as caronas dos próximos dias

      req.session.flash = { tipo: 'sucesso', texto: 'Rotina criada! Já publicamos as caronas dos próximos dias.' };
      return res.redirect('/caronas/minhas');
    }

    // ----- Carona avulsa (comportamento original): exige a data -----
    if (!b.data_viagem) return falhar('Informe a data da carona (ou marque "repetir toda semana").');
    Carona.criar({ ...comum, data_viagem: b.data_viagem });

    req.session.flash = { tipo: 'sucesso', texto: 'Carona publicada com sucesso!' };
    res.redirect('/caronas/minhas');
  },

  pausarRotina(req, res) {
    definirRotina(req, res, 0, 'Rotina pausada. As caronas já publicadas continuam — encerre-as se quiser.');
  },
  retomarRotina(req, res) {
    definirRotina(req, res, 1, 'Rotina retomada! Voltamos a publicar as próximas datas.');
  },

  // ---- Requisitos 3 e 4: Buscar / Pareamento ----------------------------
  async telaBuscar(req, res) {
    Recorrencia.gerarOcorrencias(); // garante as caronas das rotinas antes de buscar

    const filtros = {
      cep: (req.query.cep || '').trim(),
      regiao: (req.query.regiao || '').trim(),
      diaSemana: (req.query.diaSemana || '').trim(), // '' | '0'..'6' | 'uteis'
      horario: req.query.horario || '',
      // Sentido é obrigatório: só 'ida' ou 'volta' (sem opção "ambos"). Padrão: volta.
      sentido: req.query.sentido === 'ida' ? 'ida' : 'volta',
    };

    // Se veio CEP, resolve a regiao (bairro/cidade) e usa como termo de busca.
    let regiaoResolvida = null;
    let termoRegiao = filtros.regiao;
    if (filtros.cep && limparCep(filtros.cep).length === 8) {
      const r = await buscarCep(filtros.cep);
      if (r) {
        regiaoResolvida = r;
        // Prioriza bairro; cai para cidade. O texto livre continua valendo se preenchido.
        termoRegiao = filtros.regiao || r.bairro || r.cidade;
      }
    }

    const resultados = Carona.buscar({
      regiao: termoRegiao,
      diaSemana: filtros.diaSemana,
      horario: filtros.horario,
      sentido: filtros.sentido,
    });

    // Separa por sentido: ida (para a Facens) x volta (da Facens).
    const idas = resultados.filter((c) => c.sentido === 'ida');
    const voltas = resultados.filter((c) => c.sentido !== 'ida');

    res.render('caronas/buscar', {
      titulo: 'Buscar carona',
      filtros,
      regiaoResolvida,
      diasSemana: DIAS_SEMANA,
      resultados,
      idas,
      voltas,
    });
  },

  detalhes(req, res) {
    const carona = Carona.buscarPorId(req.params.id);
    if (!carona) {
      req.session.flash = { tipo: 'erro', texto: 'Carona nao encontrada.' };
      return res.redirect('/caronas/buscar');
    }
    const minhaReserva = Reserva.existe(carona.id, req.session.usuarioId);
    const reputacao = Usuario.reputacao(carona.motorista_id);
    const avaliacoesMotorista = Avaliacao.listarPorAvaliado(carona.motorista_id);
    res.render('caronas/detalhes', {
      titulo: 'Detalhes da carona',
      carona, minhaReserva, reputacao, avaliacoesMotorista,
    });
  },

  // ---- Passageiro pede carona ------------------------------------------
  reservar(req, res) {
    const carona = Carona.buscarPorId(req.params.id);
    if (!carona) {
      req.session.flash = { tipo: 'erro', texto: 'Carona nao encontrada.' };
      return res.redirect('/caronas/buscar');
    }
    if (carona.motorista_id === req.session.usuarioId) {
      req.session.flash = { tipo: 'erro', texto: 'Voce nao pode pedir carona na sua propria oferta.' };
      return res.redirect(`/caronas/${carona.id}`);
    }
    if (Reserva.existe(carona.id, req.session.usuarioId)) {
      req.session.flash = { tipo: 'erro', texto: 'Voce ja pediu carona nesta viagem.' };
      return res.redirect(`/caronas/${carona.id}`);
    }
    if (carona.vagas_disponiveis < 1) {
      req.session.flash = { tipo: 'erro', texto: 'Esta carona já está lotada.' };
      return res.redirect(`/caronas/${carona.id}`);
    }

    Reserva.criar({ carona_id: carona.id, passageiro_id: req.session.usuarioId });
    req.session.flash = { tipo: 'sucesso', texto: 'Pedido enviado! Aguarde o motorista aceitar.' };
    res.redirect('/caronas/minhas');
  },

  // ---- Tela "Minhas caronas" (motorista + passageiro) -------------------
  minhas(req, res) {
    const id = req.session.usuarioId;
    Recorrencia.gerarOcorrencias(); // repõe as próximas datas das rotinas do motorista

    const oferecidas = Carona.listarPorMotorista(id).map((c) => ({
      ...c,
      reservas: Reserva.listarPorCarona(c.id),
    }));
    const pedidas = Reserva.listarPorPassageiro(id);
    const rotinas = Recorrencia.listarPorMotorista(id);
    res.render('caronas/minhas', {
      titulo: 'Minhas caronas', oferecidas, pedidas, rotinas, diasSemana: DIAS_SEMANA,
    });
  },

  // ---- Motorista aceita / recusa um pedido ------------------------------
  responderReserva(req, res) {
    const reserva = Reserva.buscarPorId(req.params.reservaId);
    const acao = req.body.acao; // 'aceita' | 'recusada'
    if (!reserva) {
      req.session.flash = { tipo: 'erro', texto: 'Reserva nao encontrada.' };
      return res.redirect('/caronas/minhas');
    }
    const carona = Carona.buscarPorId(reserva.carona_id);
    if (!carona || carona.motorista_id !== req.session.usuarioId) {
      req.session.flash = { tipo: 'erro', texto: 'Acao nao permitida.' };
      return res.redirect('/caronas/minhas');
    }

    if (acao === 'aceita' && reserva.status !== 'aceita') {
      if (carona.vagas_disponiveis < 1) {
        req.session.flash = { tipo: 'erro', texto: 'Carona lotada — não há mais lugares.' };
        return res.redirect('/caronas/minhas');
      }
      Reserva.atualizarStatus(reserva.id, 'aceita');
      Carona.decrementarVaga(carona.id);
      const restam = carona.vagas_disponiveis - 1;
      req.session.flash = {
        tipo: 'sucesso',
        texto: restam <= 0 ? 'Passageiro aceito. A carona lotou! 🎉' : `Passageiro aceito. Restam ${restam} lugar(es).`,
      };
    } else if (acao === 'recusada') {
      if (reserva.status === 'aceita') Carona.incrementarVaga(carona.id);
      Reserva.atualizarStatus(reserva.id, 'recusada');
      req.session.flash = { tipo: 'sucesso', texto: 'Pedido recusado.' };
    }
    res.redirect('/caronas/minhas');
  },

  // ---- Passageiro cancela o proprio pedido ------------------------------
  cancelarReserva(req, res) {
    const reserva = Reserva.buscarPorId(req.params.reservaId);
    if (!reserva || reserva.passageiro_id !== req.session.usuarioId) {
      req.session.flash = { tipo: 'erro', texto: 'Acao nao permitida.' };
      return res.redirect('/caronas/minhas');
    }
    if (reserva.status === 'aceita') Carona.incrementarVaga(reserva.carona_id);
    Reserva.atualizarStatus(reserva.id, 'cancelada');
    req.session.flash = { tipo: 'sucesso', texto: 'Reserva cancelada.' };
    res.redirect('/caronas/minhas');
  },

  // ---- Motorista avisa que a corrida vai começar ------------------------
  // Dispara uma mensagem no chat de CADA passageiro aceito, dizendo que a
  // corrida começa em até X minutos e combinando o ponto de encontro.
  iniciar(req, res) {
    const carona = Carona.buscarPorId(req.params.id);
    if (!carona || carona.motorista_id !== req.session.usuarioId) {
      req.session.flash = { tipo: 'erro', texto: 'Ação não permitida.' };
      return res.redirect('/caronas/minhas');
    }
    if (carona.status !== 'ativa') {
      req.session.flash = { tipo: 'erro', texto: 'Só dá para iniciar uma carona ativa.' };
      return res.redirect('/caronas/minhas');
    }

    // Minutos: inteiro de 1 a 120 (padrão 10). Ponto de encontro é obrigatório.
    const minutos = Math.min(120, Math.max(1, parseInt(req.body.minutos, 10) || 10));
    const ponto = String(req.body.ponto_encontro || '').trim();
    if (!ponto) {
      req.session.flash = { tipo: 'erro', texto: 'Informe o ponto de encontro para avisar os passageiros.' };
      return res.redirect('/caronas/minhas');
    }

    const passageiros = Reserva.listarAceitasPorCarona(carona.id);
    if (passageiros.length === 0) {
      req.session.flash = { tipo: 'erro', texto: 'Nenhum passageiro aceito ainda — ninguém para avisar.' };
      return res.redirect('/caronas/minhas');
    }

    const texto =
      `🚗 A corrida "${carona.origem} → ${carona.destino}" vai começar em até ${minutos} min!\n` +
      `📍 Ponto de encontro: ${ponto}.\n` +
      `Fique pronto(a) por favor. 🙌`;

    // Uma mensagem por conversa (cada reserva aceita é um chat passageiro↔motorista).
    for (const p of passageiros) {
      Mensagem.criar({ reserva_id: p.id, remetente_id: req.session.usuarioId, texto });
    }
    Carona.marcarInicio(carona.id, minutos, ponto);

    req.session.flash = {
      tipo: 'sucesso',
      texto: `Aviso enviado para ${passageiros.length} passageiro(s): a corrida começa em até ${minutos} min, ponto de encontro "${ponto}".`,
    };
    res.redirect('/caronas/minhas');
  },

  // ---- Motorista finaliza a corrida (só depois de iniciada) -------------
  // Avisa os passageiros no chat que a corrida acabou e libera a avaliação.
  finalizar(req, res) {
    const carona = Carona.buscarPorId(req.params.id);
    if (!carona || carona.motorista_id !== req.session.usuarioId) {
      req.session.flash = { tipo: 'erro', texto: 'Ação não permitida.' };
      return res.redirect('/caronas/minhas');
    }
    if (carona.status !== 'ativa' || !carona.inicio_avisado_em) {
      req.session.flash = { tipo: 'erro', texto: 'Só dá para finalizar uma corrida que já foi iniciada.' };
      return res.redirect('/caronas/minhas');
    }

    const passageiros = Reserva.listarAceitasPorCarona(carona.id);
    const texto =
      `🏁 A corrida "${carona.origem} → ${carona.destino}" foi finalizada!\n` +
      `Obrigado por usar o BoraJunto. 🙏\n` +
      `Que tal avaliar o motorista? Dê uma nota de 1 a 5 e deixe um comentário em ` +
      `"Minhas caronas" → "⭐ Avaliar motorista".`;
    for (const p of passageiros) {
      Mensagem.criar({ reserva_id: p.id, remetente_id: req.session.usuarioId, texto });
    }

    Carona.atualizarStatus(carona.id, 'encerrada');
    req.session.flash = {
      tipo: 'sucesso',
      texto: `Corrida finalizada! Avisamos ${passageiros.length} passageiro(s) e liberamos a avaliação.`,
    };
    res.redirect('/caronas/minhas');
  },

  // ---- Motorista cancela a corrida (só ANTES de iniciar) ----------------
  // Perde 10% da nota atual e avisa os passageiros no chat.
  cancelar(req, res) {
    const carona = Carona.buscarPorId(req.params.id);
    if (!carona || carona.motorista_id !== req.session.usuarioId) {
      req.session.flash = { tipo: 'erro', texto: 'Ação não permitida.' };
      return res.redirect('/caronas/minhas');
    }
    if (carona.status !== 'ativa') {
      req.session.flash = { tipo: 'erro', texto: 'Esta carona não está mais ativa.' };
      return res.redirect('/caronas/minhas');
    }
    if (carona.inicio_avisado_em) {
      req.session.flash = { tipo: 'erro', texto: 'A corrida já foi iniciada — não dá mais para cancelar, só finalizar.' };
      return res.redirect('/caronas/minhas');
    }

    const passageiros = Reserva.listarAceitasPorCarona(carona.id);
    const texto =
      `❌ O motorista cancelou a corrida "${carona.origem} → ${carona.destino}" ` +
      `(${carona.data_viagem.split('-').reverse().join('/')} às ${carona.horario}).\n` +
      `Desculpe pelo transtorno — você pode procurar outra carona em "Buscar carona".`;
    for (const p of passageiros) {
      Mensagem.criar({ reserva_id: p.id, remetente_id: req.session.usuarioId, texto });
    }

    Carona.atualizarStatus(carona.id, 'cancelada');
    Usuario.penalizarPorCancelamento(carona.motorista_id); // perde 10% da nota atual

    req.session.flash = {
      tipo: 'sucesso',
      texto: `Corrida cancelada. ${passageiros.length} passageiro(s) avisado(s). Sua nota foi reduzida em 10% por cancelar.`,
    };
    res.redirect('/caronas/minhas');
  },

  // ---- Motorista encerra a carona ---------------------------------------
  encerrar(req, res) {
    const carona = Carona.buscarPorId(req.params.id);
    if (!carona || carona.motorista_id !== req.session.usuarioId) {
      req.session.flash = { tipo: 'erro', texto: 'Acao nao permitida.' };
      return res.redirect('/caronas/minhas');
    }
    Carona.atualizarStatus(carona.id, 'encerrada');
    req.session.flash = { tipo: 'sucesso', texto: 'Carona encerrada.' };
    res.redirect('/caronas/minhas');
  },
};

module.exports = caronaController;
