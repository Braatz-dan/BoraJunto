/**
 * BoraJunto - ponto de entrada da aplicacao web.
 * Plataforma de caronas para estudantes da Facens (Projeto de Extensao UPX).
 *
 * Arquitetura MVC:
 *   - Models      -> src/models      (acesso ao banco SQLite)
 *   - Views       -> src/views       (templates EJS)
 *   - Controllers -> src/controllers (regras de aplicacao)
 *   - Rotas       -> src/routes/web.js
 *   - Banco       -> src/config/db.js + banco/criar_banco.txt
 */
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const { inicializar, fecharBanco } = require('./src/config/db');
const Usuario = require('./src/models/Usuario');
const { contextoGlobal } = require('./src/middlewares/auth');
const rotasWeb = require('./src/routes/web');

const PORT = process.env.PORT || 3000;

// 1) Prepara o banco de dados local (cria tabelas a partir do .txt + exemplos).
inicializar();

const app = express();

// 2) View engine (EJS) e diretorio de views.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// 3) Middlewares base.
app.use(express.urlencoded({ extended: true, limit: '2mb' }));  // le formularios HTML (foto de perfil vai como data URL)
app.use(express.json({ limit: '2mb' }));                         // le corpo JSON (chat / widget)
app.use(express.static(path.join(__dirname, 'public'))); // css/js/imagens
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'borajunto-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 horas
  })
);

// 4) Contexto disponivel em todas as views (usuario logado + flash).
app.use(contextoGlobal(Usuario));

// 5) Rotas da aplicacao.
app.use('/', rotasWeb);

// 6) Pagina 404 simples.
app.use((req, res) => {
  res.status(404).render('erro', {
    titulo: 'Pagina nao encontrada',
    mensagem: 'A pagina que voce procurou nao existe.',
  });
});

// 7) Sobe o servidor. Se a porta estiver ocupada (ex.: outra app no 3000),
//    tenta as proximas portas automaticamente, em vez de quebrar.
function subir(porta, tentativasRestantes) {
  const server = app.listen(porta, () => {
    console.log('\n  BoraJunto rodando!');
    console.log(`  > Acesse: http://localhost:${porta}\n`);
    if (porta !== Number(PORT)) {
      console.log(`  (a porta ${PORT} estava ocupada; usei a ${porta})\n`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && tentativasRestantes > 0) {
      console.warn(`  Porta ${porta} ocupada, tentando ${porta + 1}...`);
      subir(porta + 1, tentativasRestantes - 1);
    } else if (err.code === 'EADDRINUSE') {
      console.error(`\n  Nao foi possivel subir: as portas ${PORT}..${porta} estao todas ocupadas.`);
      console.error('  Feche o outro processo ou rode com outra porta, ex.:  set PORT=4000 && npm start\n');
      process.exit(1);
    } else {
      throw err;
    }
  });
}

subir(Number(PORT), 10);

// 8) Encerramento gracioso: ao parar o servidor (Ctrl+C, kill, `npm stop`,
//    reinício do --watch), consolida o WAL no borajunto.db e fecha o banco.
//    Sem isso o arquivo principal podia parecer desatualizado até o próximo
//    checkpoint. Só encerra uma vez (guard) e sai.
let encerrando = false;
function encerrar(sinal) {
  if (encerrando) return;
  encerrando = true;
  console.log(`\n  Encerrando (${sinal})... salvando o banco.`);
  fecharBanco();
  process.exit(0);
}
process.on('SIGINT', () => encerrar('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => encerrar('SIGTERM')); // kill / stop / docker
process.once('SIGUSR2', () => {                    // reinício do node --watch/nodemon
  fecharBanco();
  process.kill(process.pid, 'SIGUSR2');
});
