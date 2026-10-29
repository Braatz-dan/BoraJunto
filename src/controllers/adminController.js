/**
 * Controller do painel do administrador.
 * Só é alcançado por contas com papel 'admin' (middleware exigirAdmin).
 * O admin administra: vê usuários e corridas, bane/desbane e remove corridas.
 * Ele NÃO oferece nem pega carona.
 */
const Usuario = require('../models/Usuario');
const Carona = require('../models/Carona');

const adminController = {
  /** Painel inicial com os números gerais. */
  painel(req, res) {
    res.render('admin/painel', { titulo: 'Painel do admin', totais: Usuario.totais() });
  },

  /** Lista de usuários (com banir/desbanir e o formulário de banir por e-mail). */
  usuarios(req, res) {
    res.render('admin/usuarios', { titulo: 'Usuários', usuarios: Usuario.listarTodos() });
  },

  /** Banir pelo e-mail digitado no formulário. */
  banirPorEmail(req, res) {
    const email = String(req.body.email || '').toLowerCase().trim();
    const voltar = () => res.redirect('/admin/usuarios');
    if (!email) {
      req.session.flash = { tipo: 'erro', texto: 'Informe um e-mail.' };
      return voltar();
    }
    const alvo = Usuario.buscarPorEmail(email);
    if (!alvo) {
      req.session.flash = { tipo: 'erro', texto: `Nenhum usuário com o e-mail ${email}.` };
      return voltar();
    }
    const bloqueio = impedir(alvo, req);
    if (bloqueio) { req.session.flash = { tipo: 'erro', texto: bloqueio }; return voltar(); }

    Usuario.definirBanido(alvo.id, true);
    req.session.flash = { tipo: 'sucesso', texto: `${alvo.nome} (${email}) foi banido(a).` };
    voltar();
  },

  /** Banir pelo id (botão na linha da tabela). */
  banir(req, res) {
    const voltar = () => res.redirect('/admin/usuarios');
    const alvo = Usuario.buscarPorId(req.params.id);
    if (!alvo) { req.session.flash = { tipo: 'erro', texto: 'Usuário não encontrado.' }; return voltar(); }
    const bloqueio = impedir(alvo, req);
    if (bloqueio) { req.session.flash = { tipo: 'erro', texto: bloqueio }; return voltar(); }

    Usuario.definirBanido(alvo.id, true);
    req.session.flash = { tipo: 'sucesso', texto: `${alvo.nome} foi banido(a).` };
    voltar();
  },

  /** Desbanir pelo id. */
  desbanir(req, res) {
    const voltar = () => res.redirect('/admin/usuarios');
    const alvo = Usuario.buscarPorId(req.params.id);
    if (!alvo) { req.session.flash = { tipo: 'erro', texto: 'Usuário não encontrado.' }; return voltar(); }
    Usuario.definirBanido(alvo.id, false);
    req.session.flash = { tipo: 'sucesso', texto: `${alvo.nome} foi desbanido(a).` };
    voltar();
  },

  /** Lista de todas as corridas. */
  caronas(req, res) {
    res.render('admin/caronas', { titulo: 'Corridas', caronas: Carona.listarTodas() });
  },

  /** Remove uma corrida (moderação). */
  removerCarona(req, res) {
    const voltar = () => res.redirect('/admin/caronas');
    const carona = Carona.buscarPorId(req.params.id);
    if (!carona) { req.session.flash = { tipo: 'erro', texto: 'Corrida não encontrada.' }; return voltar(); }
    Carona.remover(carona.id);
    req.session.flash = { tipo: 'sucesso', texto: `Corrida #${carona.id} removida.` };
    voltar();
  },
};

// Regras de proteção ao banir: não bane a si mesmo nem outro admin.
function impedir(alvo, req) {
  if (alvo.id === req.session.usuarioId) return 'Você não pode banir a si mesmo.';
  if (alvo.papel === 'admin') return 'Não é possível banir outra conta de administração.';
  return null;
}

module.exports = adminController;
