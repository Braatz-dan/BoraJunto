/**
 * Cria (ou atualiza) o banco de dados SEM iniciar o servidor web.
 *
 * Uso:
 *   npm run init-db
 *
 * O que faz:
 *   - Verifica se o arquivo borajunto.db existe.
 *   - Se NÃO existir, cria a partir de banco/criar_banco.txt e insere os dados
 *     de exemplo.
 *   - Se já existir, aplica migrações pendentes (novas colunas) sem apagar nada.
 *
 * É seguro rodar quantas vezes quiser (idempotente).
 */
require('dotenv').config();
const { inicializar, CAMINHO_BANCO } = require('../src/config/db');

console.log('\n  Inicializando o banco do BoraJunto...');
inicializar();
console.log(`\n  OK! Banco disponível em: ${CAMINHO_BANCO}\n`);
process.exit(0);
