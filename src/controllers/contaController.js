/**
 * Controller da própria conta do usuário logado: alterar dados/e-mail e senha.
 * Sempre opera sobre req.session.usuarioId — nunca sobre um id vindo da tela,
 * então um usuário só edita a si mesmo.
 */
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { DOMINIOS, emailInstitucional } = require('../lib/email-institucional');

const contaController = {
  /** Atualiza nome, telefone e e-mail (e-mail validado e único). */
  async atualizarDados(req, res) {
    const id = req.session.usuarioId;
    const { nome, telefone, email } = req.body;
    const voltar = () => res.redirect(`/usuarios/${id}`);

    if (!nome || !nome.trim()) {
      req.session.flash = { tipo: 'erro', texto: 'O nome não pode ficar vazio.' };
      return voltar();
    }

    const emailLimpo = (email || '').toLowerCase().trim();
    const atual = Usuario.buscarPorId(id);
    const trocouEmail = emailLimpo && emailLimpo !== atual.email;

    if (trocouEmail) {
      if (!emailInstitucional(emailLimpo)) {
        req.session.flash = {
          tipo: 'erro',
          texto: `Use um e-mail institucional (${DOMINIOS.map((d) => '@' + d).join(' ou ')}).`,
        };
        return voltar();
      }
      if (Usuario.emailEmUso(emailLimpo, id)) {
        req.session.flash = { tipo: 'erro', texto: 'Esse e-mail já está em uso por outra conta.' };
        return voltar();
      }
    }

    Usuario.atualizarPerfil(id, { nome: nome.trim(), telefone });
    if (trocouEmail) Usuario.atualizarEmail(id, emailLimpo);

    req.session.flash = {
      tipo: 'sucesso',
      texto: trocouEmail ? 'Dados e e-mail atualizados.' : 'Dados atualizados.',
    };
    voltar();
  },

  /** Troca a senha, exigindo a senha atual. */
  async atualizarSenha(req, res) {
    const id = req.session.usuarioId;
    const { senha_atual, nova_senha, confirmar_senha } = req.body;
    const voltar = () => res.redirect(`/usuarios/${id}`);

    const usuario = Usuario.buscarPorId(id);
    const confere = usuario && (await bcrypt.compare(senha_atual || '', usuario.senha_hash));
    if (!confere) {
      req.session.flash = { tipo: 'erro', texto: 'Senha atual incorreta.' };
      return voltar();
    }
    if (!nova_senha || nova_senha.length < 6) {
      req.session.flash = { tipo: 'erro', texto: 'A nova senha deve ter ao menos 6 caracteres.' };
      return voltar();
    }
    if (nova_senha !== confirmar_senha) {
      req.session.flash = { tipo: 'erro', texto: 'A confirmação não confere com a nova senha.' };
      return voltar();
    }

    const hash = await bcrypt.hash(nova_senha, 10);
    Usuario.atualizarSenha(id, hash);
    req.session.flash = { tipo: 'sucesso', texto: 'Senha alterada com sucesso.' };
    voltar();
  },

  /** Define ou remove a foto de perfil (enviada como data URL base64 pelo navegador). */
  atualizarFoto(req, res) {
    const id = req.session.usuarioId;
    const voltar = () => res.redirect(`/usuarios/${id}`);
    const remover = !!req.body.remover;

    if (remover) {
      Usuario.atualizarFoto(id, null);
      req.session.flash = { tipo: 'sucesso', texto: 'Foto removida.' };
      return voltar();
    }

    const foto = String(req.body.foto || '').trim();
    // Aceita só imagem em data URL, com um teto de tamanho (~1,5 MB de base64).
    if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(foto)) {
      req.session.flash = { tipo: 'erro', texto: 'Envie um arquivo de imagem válido.' };
      return voltar();
    }
    if (foto.length > 1_500_000) {
      req.session.flash = { tipo: 'erro', texto: 'Imagem muito grande. Tente uma foto menor.' };
      return voltar();
    }

    Usuario.atualizarFoto(id, foto);
    req.session.flash = { tipo: 'sucesso', texto: 'Foto de perfil atualizada.' };
    voltar();
  },
};

module.exports = contaController;
