/**
 * Middlewares de autenticacao/sessao.
 */
const Localizacao = require('../models/Localizacao');

/** Bloqueia rotas que exigem login. */
function exigirLogin(req, res, next) {
  if (req.session && req.session.usuarioId) return next();
  req.session.flash = { tipo: 'erro', texto: 'Faca login para continuar.' };
  return res.redirect('/login');
}

/** Só admin passa (usa res.locals.usuario já carregado pelo contextoGlobal). */
function exigirAdmin(req, res, next) {
  if (res.locals.usuario && res.locals.usuario.papel === 'admin') return next();
  req.session.flash = { tipo: 'erro', texto: 'Área restrita à administração.' };
  return res.redirect(req.session.usuarioId ? '/caronas/buscar' : '/login');
}

/** Impede o admin de usar os fluxos de carona (ele administra, não pega carona). */
function bloquearAdmin(req, res, next) {
  if (res.locals.usuario && res.locals.usuario.papel === 'admin') {
    req.session.flash = { tipo: 'erro', texto: 'Contas de administração não oferecem nem pedem carona.' };
    return res.redirect('/admin');
  }
  next();
}

/**
 * Disponibiliza dados comuns para TODAS as views:
 *  - usuario logado (res.locals.usuario)
 *  - mensagem flash (res.locals.flash) consumida uma unica vez
 */
function contextoGlobal(Usuario) {
  return (req, res, next) => {
    res.locals.usuario = req.session.usuarioId
      ? Usuario.buscarPorId(req.session.usuarioId)
      : null;
    // Corrida em andamento em que o usuário está agora (para o aviso "Você está
    // em uma corrida" com o botão de compartilhar localização).
    res.locals.corridaAoVivo = req.session.usuarioId
      ? Localizacao.corridaAoVivoDoUsuario(req.session.usuarioId)
      : null;
    res.locals.path = req.path;
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    next();
  };
}

module.exports = { exigirLogin, exigirAdmin, bloquearAdmin, contextoGlobal };
