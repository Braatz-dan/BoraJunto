/**
 * Cria (ou promove) uma conta de ADMINISTRADOR.
 *
 * Uso:
 *   node scripts/criar-admin.js <email> <senha> ["Nome do Admin"]
 *
 * - Se o e-mail não existir, cria a conta já como admin.
 * - Se já existir, promove a conta a admin (e troca a senha, se informada).
 *
 * Admin administra a plataforma (vê usuários/corridas, bane contas) e NÃO
 * oferece nem pega carona.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { inicializar } = require('../src/config/db');
const { db } = require('../src/config/db');

inicializar();

const [, , emailArg, senhaArg, nomeArg] = process.argv;
if (!emailArg || !senhaArg) {
  console.error('\n  Uso: node scripts/criar-admin.js <email> <senha> ["Nome"]\n');
  process.exit(1);
}

const email = emailArg.toLowerCase().trim();
const hash = bcrypt.hashSync(senhaArg, 10);
const existente = db.prepare('SELECT id, nome FROM usuarios WHERE email = ?').get(email);

if (existente) {
  db.prepare("UPDATE usuarios SET papel = 'admin', banido = 0, senha_hash = ? WHERE id = ?")
    .run(hash, existente.id);
  console.log(`\n  OK! "${existente.nome}" (${email}) agora é ADMIN e a senha foi atualizada.\n`);
} else {
  const nome = (nomeArg && nomeArg.trim()) || 'Administrador';
  db.prepare(
    "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, 'admin')"
  ).run(nome, email, hash);
  console.log(`\n  OK! Admin criado: ${nome} <${email}>.\n`);
}

process.exit(0);
