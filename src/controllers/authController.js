/**
 * Controller de autenticacao: cadastro validado por e-mail institucional,
 * login e logout (requisito 1 - Cadastro validado).
 */
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { DOMINIOS, emailInstitucional } = require('../lib/email-institucional');

const authController = {
  telaCadastro(req, res) {
    res.render('cadastro', { titulo: 'Cadastro', dominios: DOMINIOS, dados: {} });
  },

  async cadastrar(req, res) {
    const { nome, ra, email, senha, confirmar_senha, telefone } = req.body;
    const erro = (texto) => {
      req.session.flash = { tipo: 'erro', texto };
      return res.status(400).render('cadastro', {
        titulo: 'Cadastro', dominios: DOMINIOS,
        flash: { tipo: 'erro', texto },
        dados: { nome, ra, email, telefone },
      });
    };

    if (!nome || !email || !senha) return erro('Preencha nome, e-mail e senha.');
    if (!emailInstitucional(email)) {
      return erro(`Use seu e-mail institucional (${DOMINIOS.map((d) => '@' + d).join(' ou ')}).`);
    }
    if (senha.length < 6) return erro('A senha deve ter ao menos 6 caracteres.');
    if (senha !== confirmar_senha) return erro('As senhas nao conferem.');
    if (Usuario.buscarPorEmail(email.toLowerCase())) {
      return erro('Ja existe uma conta com este e-mail.');
    }

    const senha_hash = await bcrypt.hash(senha, 10);
    const id = Usuario.criar({
      nome: nome.trim(), ra, email: email.toLowerCase().trim(), senha_hash, telefone,
    });

    req.session.usuarioId = id;
    req.session.flash = { tipo: 'sucesso', texto: `Bem-vindo(a), ${nome.split(' ')[0]}! Conta criada.` };
    res.redirect('/caronas/buscar');
  },

  telaLogin(req, res) {
    res.render('login', { titulo: 'Entrar', dados: {} });
  },

  async login(req, res) {
    const { email, senha } = req.body;
    const usuario = email ? Usuario.buscarPorEmail(email.toLowerCase().trim()) : null;
    const ok = usuario && (await bcrypt.compare(senha || '', usuario.senha_hash));

    if (!ok) {
      req.session.flash = { tipo: 'erro', texto: 'E-mail ou senha invalidos.' };
      return res.status(401).render('login', {
        titulo: 'Entrar', flash: { tipo: 'erro', texto: 'E-mail ou senha invalidos.' },
        dados: { email },
      });
    }

    if (usuario.banido) {
      req.session.flash = { tipo: 'erro', texto: 'Esta conta foi banida. Fale com a administração.' };
      return res.status(403).render('login', {
        titulo: 'Entrar', flash: { tipo: 'erro', texto: 'Esta conta foi banida. Fale com a administração.' },
        dados: { email },
      });
    }

    req.session.usuarioId = usuario.id;
    req.session.flash = { tipo: 'sucesso', texto: `Ola, ${usuario.nome.split(' ')[0]}!` };
    // Admin não pega carona: vai direto para o painel.
    res.redirect(usuario.papel === 'admin' ? '/admin' : '/caronas/buscar');
  },

  logout(req, res) {
    req.session.destroy(() => res.redirect('/login'));
  },
};

module.exports = authController;
