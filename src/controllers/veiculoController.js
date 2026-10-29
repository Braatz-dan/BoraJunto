/**
 * Controller dos carros do motorista (tabela "veiculos").
 * Opera sempre sobre req.session.usuarioId — o usuário só mexe nos próprios carros.
 */
const Veiculo = require('../models/Veiculo');

const veiculoController = {
  /** Cadastra um carro novo no perfil do usuário logado. */
  adicionar(req, res) {
    const id = req.session.usuarioId;
    const voltar = () => res.redirect(`/usuarios/${id}`);

    const modelo = String(req.body.modelo || '').trim();
    if (!modelo) {
      req.session.flash = { tipo: 'erro', texto: 'Informe o modelo do carro.' };
      return voltar();
    }
    const placa = String(req.body.placa || '').trim().toUpperCase() || null;
    const cor = String(req.body.cor || '').trim() || null;
    let capacidade = parseInt(req.body.capacidade, 10);
    if (!(capacidade >= 1 && capacidade <= 8)) capacidade = 4;

    if (Veiculo.existeIgual(id, modelo, placa)) {
      req.session.flash = { tipo: 'erro', texto: 'Você já tem esse carro cadastrado.' };
      return voltar();
    }

    Veiculo.criar({ usuario_id: id, modelo, placa, cor, capacidade });
    req.session.flash = { tipo: 'sucesso', texto: `Carro "${modelo}" salvo no seu perfil.` };
    voltar();
  },

  /** Remove um carro do usuário logado. */
  remover(req, res) {
    const id = req.session.usuarioId;
    const veiculo = Veiculo.buscarPorId(req.params.id);
    if (!veiculo || veiculo.usuario_id !== id) {
      req.session.flash = { tipo: 'erro', texto: 'Ação não permitida.' };
      return res.redirect(`/usuarios/${id}`);
    }
    Veiculo.remover(veiculo.id, id);
    req.session.flash = { tipo: 'sucesso', texto: 'Carro removido.' };
    res.redirect(`/usuarios/${id}`);
  },
};

module.exports = veiculoController;
