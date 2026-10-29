/**
 * Regra de e-mail institucional, compartilhada entre o cadastro e a edição de conta.
 * Domínios aceitos vêm de EMAIL_DOMINIOS (.env), padrão facens.br / facens.edu.br.
 */
const DOMINIOS = (process.env.EMAIL_DOMINIOS || 'facens.br,facens.edu.br')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function emailInstitucional(email) {
  const dominio = String(email || '').toLowerCase().split('@')[1] || '';
  return DOMINIOS.includes(dominio);
}

module.exports = { DOMINIOS, emailInstitucional };
