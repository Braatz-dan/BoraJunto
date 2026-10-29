/**
 * Definicao central das rotas web (camada de roteamento do MVC).
 * Cada rota aponta para um metodo de controller.
 */
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const caronaController = require('../controllers/caronaController');
const avaliacaoController = require('../controllers/avaliacaoController');
const contaController = require('../controllers/contaController');
const mensagemController = require('../controllers/mensagemController');
const veiculoController = require('../controllers/veiculoController');
const localizacaoController = require('../controllers/localizacaoController');
const adminController = require('../controllers/adminController');
const { exigirLogin, exigirAdmin, bloquearAdmin } = require('../middlewares/auth');

// ----- Pagina inicial -----
router.get('/', (req, res) => {
  if (req.session.usuarioId) return res.redirect('/caronas/buscar');
  res.render('home', { titulo: 'BoraJunto - Caronas Facens' });
});

// ----- Autenticacao / Cadastro validado (requisito 1) -----
router.get('/cadastro', authController.telaCadastro);
router.post('/cadastro', authController.cadastrar);
router.get('/login', authController.telaLogin);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// ----- Caronas -----
router.get('/caronas/buscar', exigirLogin, caronaController.telaBuscar);           // req. 3 e 4
router.get('/caronas/oferecer', exigirLogin, bloquearAdmin, caronaController.telaOferecer);  // req. 2
router.post('/caronas/oferecer', exigirLogin, bloquearAdmin, caronaController.oferecer);     // req. 2
router.get('/caronas/minhas', exigirLogin, caronaController.minhas);
router.post('/rotinas/:id/pausar', exigirLogin, caronaController.pausarRotina);     // pausa a rotina semanal
router.post('/rotinas/:id/retomar', exigirLogin, caronaController.retomarRotina);   // retoma a rotina semanal
router.get('/caronas/:id', exigirLogin, caronaController.detalhes);
router.post('/caronas/:id/reservar', exigirLogin, bloquearAdmin, caronaController.reservar);
router.post('/caronas/:id/iniciar', exigirLogin, caronaController.iniciar);     // motorista avisa que a corrida vai começar
router.post('/caronas/:id/finalizar', exigirLogin, caronaController.finalizar); // finaliza (só depois de iniciada) + libera avaliação
router.post('/caronas/:id/cancelar', exigirLogin, caronaController.cancelar);   // cancela (só antes de iniciar) + penalidade de 10%
router.post('/caronas/:id/encerrar', exigirLogin, caronaController.encerrar);
router.post('/reservas/:reservaId/responder', exigirLogin, caronaController.responderReserva);
router.post('/reservas/:reservaId/cancelar', exigirLogin, caronaController.cancelarReserva);

// ----- Localização ao vivo da corrida (motorista e passageiros aceitos) -----
router.get('/caronas/:id/mapa', exigirLogin, localizacaoController.mapa);
router.get('/caronas/:id/localizacao', exigirLogin, localizacaoController.listar);
router.post('/caronas/:id/localizacao', exigirLogin, localizacaoController.enviar);

// ----- Painel do administrador (só papel 'admin'; não pega carona) -----
router.get('/admin', exigirLogin, exigirAdmin, adminController.painel);
router.get('/admin/usuarios', exigirLogin, exigirAdmin, adminController.usuarios);
router.post('/admin/usuarios/banir', exigirLogin, exigirAdmin, adminController.banirPorEmail);
router.post('/admin/usuarios/:id/banir', exigirLogin, exigirAdmin, adminController.banir);
router.post('/admin/usuarios/:id/desbanir', exigirLogin, exigirAdmin, adminController.desbanir);
router.get('/admin/caronas', exigirLogin, exigirAdmin, adminController.caronas);
router.post('/admin/caronas/:id/remover', exigirLogin, exigirAdmin, adminController.removerCarona);

// ----- Avaliacoes (requisito 5) -----
router.get('/caronas/:caronaId/avaliar', exigirLogin, avaliacaoController.tela);
router.post('/caronas/:caronaId/avaliar', exigirLogin, avaliacaoController.registrar);
router.get('/usuarios/:id', exigirLogin, avaliacaoController.perfil);

// ----- Minha conta (alterar dados/e-mail e senha) -----
router.post('/conta/dados', exigirLogin, contaController.atualizarDados);
router.post('/conta/senha', exigirLogin, contaController.atualizarSenha);
router.post('/conta/foto', exigirLogin, contaController.atualizarFoto);

// ----- Carros salvos do motorista -----
router.post('/veiculos', exigirLogin, veiculoController.adicionar);
router.post('/veiculos/:id/remover', exigirLogin, veiculoController.remover);

// ----- Chat (mensagens ancoradas na reserva) — API JSON do balão flutuante -----
router.get('/mensagens/nao-lidas', exigirLogin, mensagemController.naoLidas);
router.get('/mensagens/conversas', exigirLogin, mensagemController.conversas);
router.get('/mensagens/conversas/:reservaId', exigirLogin, mensagemController.thread);
router.post('/mensagens/conversas/:reservaId', exigirLogin, mensagemController.enviar);

module.exports = router;
