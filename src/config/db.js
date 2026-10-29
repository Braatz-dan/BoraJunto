/**
 * Configuracao e conexao com o banco de dados (SQLite).
 *
 * - VERIFICA se o arquivo borajunto.db existe; se NAO existir, cria do zero.
 * - Executa o script banco/criar_banco.txt para criar as tabelas.
 * - Migra bancos antigos (adiciona colunas novas) sem perder dados.
 * - Insere dados de exemplo (com senha real) apenas na primeira execucao.
 *
 * Camada de infraestrutura do MVC: os Models usam este modulo.
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO_BANCO = path.join(RAIZ, 'borajunto.db');
const CAMINHO_SCHEMA = path.join(RAIZ, 'banco', 'criar_banco.txt');

// VERIFICA se o banco JA EXISTE antes de abrir. O construtor do better-sqlite3
// cria o arquivo automaticamente se ele nao existir, entao checamos ANTES para
// saber se e a primeira execucao (e assim decidir criar tabelas e semear dados).
const bancoJaExistia = fs.existsSync(CAMINHO_BANCO);

// Abre (ou cria) o banco de dados local em arquivo.
const db = new Database(CAMINHO_BANCO);
// journal_mode = DELETE (padrão): cada gravação vai DIRETO para o borajunto.db.
// (Antes era WAL, que guardava as gravações num arquivo borajunto.db-wal à parte
//  até um "checkpoint" — dava a impressão de que o .db principal não salvava.)
// Ao definir DELETE, o SQLite também consolida e remove qualquer -wal/-shm de bancos
// que já rodaram em WAL. synchronous = FULL garante gravação segura em disco a cada commit.
db.pragma('journal_mode = DELETE');
db.pragma('synchronous = FULL');
db.pragma('foreign_keys = ON');

/**
 * Migração leve e SEGURA: se um banco antigo já existir sem as colunas mais
 * novas da tabela "caronas" (veículo e região/CEP), adiciona apenas as que
 * faltam com ALTER TABLE — sem apagar nenhum dado. Roda ANTES de criarTabelas
 * para os índices que usam essas colunas não falharem em bancos legados.
 */
function migrarSchema() {
  const existe = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='caronas'")
    .get();
  if (!existe) return; // banco novo: criarTabelas cria tudo do zero

  const colunas = db.prepare('PRAGMA table_info(caronas)').all().map((c) => c.name);
  const necessarias = {
    veiculo_modelo: 'TEXT', veiculo_placa: 'TEXT', veiculo_cor: 'TEXT',
    cep: 'TEXT', bairro: 'TEXT', cidade: 'TEXT', uf: 'TEXT',
    sentido: "TEXT NOT NULL DEFAULT 'volta'",
    recorrencia_id: 'INTEGER', // liga a carona gerada à rotina semanal (caronas_recorrentes)
    // Aviso de "corrida vai começar" que o motorista dispara aos passageiros.
    inicio_avisado_em: 'TEXT',    // quando o motorista avisou (NULL = ainda não avisou)
    inicio_minutos: 'INTEGER',    // "começa em até X minutos"
    ponto_encontro: 'TEXT',       // onde os passageiros se encontram
  };
  for (const [nome, tipo] of Object.entries(necessarias)) {
    if (!colunas.includes(nome)) {
      db.exec(`ALTER TABLE caronas ADD COLUMN ${nome} ${tipo}`);
      console.log(`  > Migração: coluna caronas.${nome} adicionada.`);
    }
  }

  // Tabela usuarios: fator multiplicador da reputação (1.0 = sem penalidade).
  // Cada cancelamento de corrida multiplica por 0.9 (perde 10% da nota atual).
  const temUsuarios = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'")
    .get();
  if (temUsuarios) {
    const colsUsuarios = db.prepare('PRAGMA table_info(usuarios)').all().map((c) => c.name);
    if (!colsUsuarios.includes('fator_reputacao')) {
      db.exec('ALTER TABLE usuarios ADD COLUMN fator_reputacao REAL NOT NULL DEFAULT 1.0');
      console.log('  > Migração: coluna usuarios.fator_reputacao adicionada.');
    }
    if (!colsUsuarios.includes('foto')) {
      db.exec('ALTER TABLE usuarios ADD COLUMN foto TEXT'); // foto de perfil (data URL base64)
      console.log('  > Migração: coluna usuarios.foto adicionada.');
    }
    if (!colsUsuarios.includes('papel')) {
      db.exec("ALTER TABLE usuarios ADD COLUMN papel TEXT NOT NULL DEFAULT 'usuario'"); // 'usuario' | 'admin'
      console.log('  > Migração: coluna usuarios.papel adicionada.');
    }
    if (!colsUsuarios.includes('banido')) {
      db.exec('ALTER TABLE usuarios ADD COLUMN banido INTEGER NOT NULL DEFAULT 0'); // 1 = não pode entrar
      console.log('  > Migração: coluna usuarios.banido adicionada.');
    }
  }
}

/**
 * Cria as tabelas a partir do script SQL versionado em banco/criar_banco.txt.
 * Usar o mesmo .txt garante que o site e o script entregue estejam sempre iguais.
 */
function criarTabelas() {
  const sql = fs.readFileSync(CAMINHO_SCHEMA, 'utf8');
  db.exec(sql);
}

/**
 * Popula o banco com alguns usuarios e caronas de exemplo,
 * apenas se ainda nao houver nenhum usuario cadastrado.
 * A senha de todos os usuarios demo e: 123456
 */
function popularExemplos() {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get();
  if (total > 0) return;

  const senhaHash = bcrypt.hashSync('123456', 10);

  const inserirUsuario = db.prepare(
    `INSERT INTO usuarios (nome, ra, email, senha_hash, telefone)
     VALUES (@nome, @ra, @email, @senha_hash, @telefone)`
  );
  const inserirVeiculo = db.prepare(
    `INSERT INTO veiculos (usuario_id, modelo, placa, cor, capacidade)
     VALUES (@usuario_id, @modelo, @placa, @cor, @capacidade)`
  );
  const inserirCarona = db.prepare(
    `INSERT INTO caronas
       (motorista_id, origem, destino, sentido, ponto_referencia, cep, bairro, cidade, uf,
        data_viagem, horario, veiculo_modelo, veiculo_placa, veiculo_cor,
        vagas_total, vagas_disponiveis, valor_rateio, observacoes, status)
     VALUES
       (@motorista_id, @origem, @destino, @sentido, @ponto_referencia, @cep, @bairro, @cidade, @uf,
        @data_viagem, @horario, @veiculo_modelo, @veiculo_placa, @veiculo_cor,
        @vagas_total, @vagas_disponiveis, @valor_rateio, @observacoes, 'ativa')`
  );
  const inserirReserva = db.prepare(
    `INSERT INTO reservas (carona_id, passageiro_id, status) VALUES (@carona_id, @passageiro_id, @status)`
  );
  const inserirAvaliacao = db.prepare(
    `INSERT INTO avaliacoes (carona_id, avaliador_id, avaliado_id, nota, comentario)
     VALUES (@carona_id, @avaliador_id, @avaliado_id, @nota, @comentario)`
  );
  const baixarVaga = db.prepare('UPDATE caronas SET vagas_disponiveis = vagas_disponiveis - 1 WHERE id = ?');

  const seed = db.transaction(() => {
    // --- Administrador (só administra; não pega carona) ---
    db.prepare(
      "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, 'admin')"
    ).run('Administrador', 'admin@facens.br', senhaHash);

    // --- Motorista ---
    const rafael = inserirUsuario.run({
      nome: 'Rafael Andrade', ra: '251178',
      email: 'rafael.andrade@facens.br', senha_hash: senhaHash, telefone: '15991110001',
    }).lastInsertRowid;

    // --- Passageiros (contas prontas para pegar carona) ---
    const mariana = inserirUsuario.run({
      nome: 'Mariana Lopes', ra: '251075',
      email: 'mariana.lopes@facens.br', senha_hash: senhaHash, telefone: '15992220002',
    }).lastInsertRowid;

    const bruno = inserirUsuario.run({
      nome: 'Bruno Carvalho', ra: '248310',
      email: 'bruno.carvalho@facens.br', senha_hash: senhaHash, telefone: '15993330003',
    }).lastInsertRowid;

    // Passageiro novo, SEM nenhuma carona/pedido (conta "limpa" para demonstrar o fluxo do zero).
    inserirUsuario.run({
      nome: 'Larissa Nogueira', ra: '252044',
      email: 'larissa.nogueira@facens.br', senha_hash: senhaHash, telefone: '15994440004',
    });

    inserirVeiculo.run({
      usuario_id: rafael, modelo: 'Honda Fit', placa: 'ABC1D23', cor: 'Prata', capacidade: 4,
    });

    const amanha = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const depois = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 10);

    const carona1 = inserirCarona.run({
      motorista_id: rafael, origem: 'Facens', destino: 'Centro de Sorocaba', sentido: 'volta',
      ponto_referencia: 'Terminal Sao Bento',
      cep: '18010-020', bairro: 'Centro', cidade: 'Sorocaba', uf: 'SP',
      data_viagem: amanha, horario: '22:40',
      veiculo_modelo: 'Honda Fit', veiculo_placa: 'ABC1D23', veiculo_cor: 'Prata',
      vagas_total: 3, vagas_disponiveis: 3, valor_rateio: 8, observacoes: 'Saida logo apos a ultima aula.',
    }).lastInsertRowid;

    const carona2 = inserirCarona.run({
      motorista_id: rafael, origem: 'Facens', destino: 'Zona Norte - Sorocaba', sentido: 'volta',
      ponto_referencia: 'Shopping Iguatemi',
      cep: '18040-000', bairro: 'Alem Ponte', cidade: 'Sorocaba', uf: 'SP',
      data_viagem: depois, horario: '22:50',
      veiculo_modelo: 'Honda Fit', veiculo_placa: 'ABC1D23', veiculo_cor: 'Prata',
      vagas_total: 2, vagas_disponiveis: 2, valor_rateio: 6, observacoes: 'Levo ate pontos no caminho.',
    }).lastInsertRowid;

    // Carona com apenas 1 lugar, que ja sera preenchida -> demonstra o estado LOTADA.
    const carona3 = inserirCarona.run({
      motorista_id: rafael, origem: 'Facens', destino: 'Eden - Sorocaba', sentido: 'volta',
      ponto_referencia: 'Estacao Eden',
      cep: '18110-000', bairro: 'Eden', cidade: 'Sorocaba', uf: 'SP',
      data_viagem: amanha, horario: '23:00',
      veiculo_modelo: 'Honda Fit', veiculo_placa: 'ABC1D23', veiculo_cor: 'Prata',
      vagas_total: 1, vagas_disponiveis: 1, valor_rateio: 10, observacoes: 'So 1 lugar hoje.',
    }).lastInsertRowid;

    // Carona de IDA (bairro -> Facens), antes das aulas, para demonstrar o grupo "Ida".
    inserirCarona.run({
      motorista_id: rafael, origem: 'Eden - Sorocaba', destino: 'Facens', sentido: 'ida',
      ponto_referencia: 'Estacao Eden',
      cep: '18110-000', bairro: 'Eden', cidade: 'Sorocaba', uf: 'SP',
      data_viagem: amanha, horario: '18:40',
      veiculo_modelo: 'Honda Fit', veiculo_placa: 'ABC1D23', veiculo_cor: 'Prata',
      vagas_total: 3, vagas_disponiveis: 3, valor_rateio: 8, observacoes: 'Passo no Eden antes da aula.',
    });

    // --- Pedidos de carona feitos pelos passageiros (para a demo) ---
    // Bruno ja foi aceito na carona 1 (desconta uma vaga).
    inserirReserva.run({ carona_id: carona1, passageiro_id: bruno, status: 'aceita' });
    baixarVaga.run(carona1);
    // Mariana esta com pedido pendente na carona 1.
    inserirReserva.run({ carona_id: carona1, passageiro_id: mariana, status: 'pendente' });
    // Mariana tambem pediu a carona 2 (pendente).
    inserirReserva.run({ carona_id: carona2, passageiro_id: mariana, status: 'pendente' });
    // Bruno aceito na carona 3 de 1 lugar -> ela LOTA (vagas_disponiveis = 0).
    inserirReserva.run({ carona_id: carona3, passageiro_id: bruno, status: 'aceita' });
    baixarVaga.run(carona3);

    // --- Uma avaliacao previa para dar reputacao ao motorista ---
    inserirAvaliacao.run({
      carona_id: carona1, avaliador_id: bruno, avaliado_id: rafael,
      nota: 5, comentario: 'Pontual e tranquilo, recomendo!',
    });
  });

  seed();
  console.log('  > Dados de exemplo inseridos.');
  console.log('    Admin:       admin@facens.br             / 123456');
  console.log('    Motorista:   rafael.andrade@facens.br    / 123456');
  console.log('    Passageiro1: mariana.lopes@facens.br     / 123456');
  console.log('    Passageiro2: bruno.carvalho@facens.br    / 123456');
  console.log('    Passageiro3: larissa.nogueira@facens.br  / 123456 (sem caronas)');
}

/**
 * Inicializa o banco. Chamado no boot do servidor (server.js) e pelo
 * script `npm run init-db`.
 *   1) Se o arquivo do banco NAO existir, avisa que vai criar do zero.
 *   2) migrarSchema(): adiciona colunas novas a bancos antigos (sem perder dados).
 *   3) criarTabelas(): roda o script banco/criar_banco.txt (idempotente).
 *   4) popularExemplos(): insere os dados de exemplo apenas se estiver vazio.
 */
function inicializar() {
  if (bancoJaExistia) {
    console.log('  > Banco encontrado:', CAMINHO_BANCO);
  } else {
    console.log('  > Banco NAO encontrado. Criando um novo em:', CAMINHO_BANCO);
  }
  migrarSchema();
  criarTabelas();
  popularExemplos();
  console.log('  > Banco pronto.');
}

/**
 * Fecha o banco com segurança ao encerrar o processo.
 * O `wal_checkpoint(TRUNCATE)` consolida tudo que estava no arquivo
 * borajunto.db-wal DENTRO do borajunto.db e zera o WAL — assim o arquivo
 * principal fica completo e autossuficiente (some a impressão de "não salvou").
 * É idempotente e nunca lança.
 */
function fecharBanco() {
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* ignora */ }
  try { db.close(); } catch { /* ignora */ }
}

module.exports = { db, inicializar, fecharBanco, CAMINHO_BANCO, bancoJaExistia };
