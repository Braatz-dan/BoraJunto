# 🚗 BoraJunto

Plataforma web de **caronas para estudantes do Centro Universitário Facens**, com foco no período noturno. Projeto de Extensão da **UPX — Usina de Projetos Experimentais**.

O acesso é validado por e-mail institucional e o sistema permite **oferecer** caronas (com carro e lugares), **buscar** caronas por região/CEP, dia da semana e horário, **parear** trajetos compatíveis, separar caronas de **ida e volta** da faculdade e **avaliar** os participantes após a viagem.

> Alinhado às ODS **4 (Educação de Qualidade)** e **11 (Cidades e Comunidades Sustentáveis)**.

---

## 📑 Sumário

- [Arquitetura (MVC)](#-arquitetura-mvc)
- [Banco de dados](#️-banco-de-dados)
- [Como rodar](#️-como-rodar)
- [Contas de demonstração](#contas-de-demonstração)
- [Funcionalidades](#-funcionalidades-requisitos-do-projeto)
- [Rotas](#-rotas-da-aplicação)
- [Tecnologias](#️-tecnologias)

---

## 🧱 Arquitetura (MVC)

Padrão **Model–View–Controller** com Node.js + Express + EJS + SQLite:

```
borajunto/
├── server.js                   # ponto de entrada (Express, sessão, rotas, porta automática)
├── package.json
├── .env.example                # variáveis de ambiente (copie para .env)
│
├── banco/
│   ├── criar_banco.txt         # >>> SCRIPT SQL que cria o banco de dados <<<
│   ├── schema.sql              # mesmo script, com extensão .sql
│   └── seed.sql                # dados de exemplo (referência)
│
├── scripts/
│   └── init-db.js              # cria/atualiza o banco SEM subir o servidor (npm run init-db)
│
├── borajunto.db                # banco SQLite (gerado automaticamente; ignorado no git)
│
├── public/                     # arquivos estáticos
│   ├── css/style.css
│   └── js/cep.js               # autopreenchimento de CEP → bairro (ViaCEP)
│
└── src/
    ├── config/
    │   └── db.js               # conexão, verificação/criação do banco e migração
    ├── lib/
    │   └── cep.js              # consulta de CEP no ViaCEP (servidor)
    ├── models/                 # MODEL — acesso aos dados
    │   ├── Usuario.js
    │   ├── Carona.js
    │   ├── Reserva.js
    │   └── Avaliacao.js
    ├── controllers/            # CONTROLLER — regras de aplicação
    │   ├── authController.js
    │   ├── caronaController.js
    │   └── avaliacaoController.js
    ├── middlewares/
    │   └── auth.js             # exige login + contexto global das views
    ├── routes/
    │   └── web.js              # mapeia URLs -> controllers
    └── views/                  # VIEW — templates EJS (HTML)
        ├── partials/           # head, header, footer, flash, carona-card
        ├── caronas/            # buscar, oferecer, detalhes, minhas
        └── avaliacoes/         # nova
```

---

## 🗄️ Banco de dados

O banco é **local e simples**: um único arquivo `borajunto.db` (SQLite), **sem servidor**.

### Verificação e criação automática

Ao subir o servidor (`npm start`) **ou** rodar `npm run init-db`, o sistema:

1. **Verifica se o arquivo `borajunto.db` existe.**
2. Se **não existir**, cria o banco do zero a partir de **`banco/criar_banco.txt`** e insere os dados de exemplo.
3. Se **já existir**, aplica migrações pendentes (adiciona colunas novas **sem apagar dados**).

O código dessa verificação está em [`src/config/db.js`](src/config/db.js):

```js
// Verifica ANTES de abrir, pois o better-sqlite3 cria o arquivo sozinho.
const bancoJaExistia = fs.existsSync(CAMINHO_BANCO);
const db = new Database(CAMINHO_BANCO);
// ...
function inicializar() {
  if (bancoJaExistia) console.log('Banco encontrado');
  else                console.log('Banco NAO encontrado. Criando um novo...');
  migrarSchema();   // adiciona colunas novas em bancos antigos
  criarTabelas();   // roda banco/criar_banco.txt (idempotente)
  popularExemplos();// dados de exemplo só se estiver vazio
}
```

### Criar o banco manualmente

```bash
# opção A — comando do projeto (recomendado)
npm run init-db

# opção B — pela CLI oficial do SQLite, direto do script
sqlite3 borajunto.db < banco/criar_banco.txt
```

### Tabelas

| Tabela | Função | Colunas principais |
| --- | --- | --- |
| `usuarios` | Estudantes cadastrados (validados por e-mail institucional). | `nome, ra, email, senha_hash, telefone` |
| `veiculos` | Carro do motorista (opcional / perfil). | `usuario_id, modelo, placa, cor, capacidade` |
| `caronas` | Caronas oferecidas. | `origem, destino, **sentido** (ida/volta), cep, bairro, cidade, uf, data_viagem, horario, veiculo_modelo/placa/cor, **vagas_total/vagas_disponiveis** (lugares), valor_rateio (preço), status` |
| `reservas` | Pedidos de carona feitos por passageiros. | `carona_id, passageiro_id, status (pendente/aceita/recusada/cancelada)` |
| `avaliacoes` | Avaliação mútua (nota 1–5) após a viagem. | `carona_id, avaliador_id, avaliado_id, nota, comentario` |

> Quando `vagas_disponiveis` chega a **0**, a carona fica **lotada** e some das buscas.

---

## ▶️ Como rodar

Pré-requisito: **Node.js 18+** (testado no Node 24).

```bash
# 1) instalar dependências
npm install

# 2) (opcional) configurar variáveis de ambiente
copy .env.example .env      # Windows
# cp .env.example .env      # Linux/Mac

# 3) (opcional) criar o banco antes — o start também cria sozinho
npm run init-db

# 4) iniciar o servidor
npm start
```

Acesse o endereço mostrado no terminal (por padrão **http://localhost:3000**).
Se a porta 3000 estiver ocupada, o servidor **usa a próxima livre automaticamente** (3001, 3002…). Para forçar uma porta: `set PORT=4000 && npm start` (Windows) ou `PORT=4000 npm start` (Linux/Mac).

### Contas de demonstração
Criadas automaticamente (senha de todas: **`123456`**):

| Perfil | E-mail | Observação |
| --- | --- | --- |
| 🚗 Motorista | `rafael.andrade@facens.br` | Carro + caronas de ida e volta (uma **lotada**) |
| 🧍 Passageira | `mariana.lopes@facens.br` | Com 2 pedidos de carona pendentes |
| 🧍 Passageiro | `bruno.carvalho@facens.br` | Já aceito em 2 caronas |
| 🧍 Passageira | `larissa.nogueira@facens.br` | **Sem nenhuma carona** (conta limpa) |

(Ou crie sua própria conta com um e-mail `@facens.br`.)

---

## ✅ Funcionalidades (requisitos do projeto)

| ID | Requisito | Onde está |
| --- | --- | --- |
| 1 | **Cadastro validado** por e-mail institucional | `authController` + `/cadastro` |
| 2 | **Oferecer carona** (carro, lugares, preço, sentido ida/volta) | `caronaController.oferecer` + `/caronas/oferecer` |
| 3 | **Buscar carona** por região (texto ou **CEP**), **dia da semana** e horário | `caronaController.telaBuscar` + `/caronas/buscar` |
| 4 | **Pareamento de trajetos** compatíveis | `Carona.buscar()` (região/bairro/cidade + dia + horário) |
| 5 | **Avaliação mútua** após a viagem | `avaliacaoController` + `/caronas/:id/avaliar` |

### Destaques

- **Ida x Volta:** cada carona tem um **sentido** — 🎓 *Ida* (para a Facens) ou 🏠 *Volta* (da Facens). A busca separa os resultados nesses dois grupos.
- **Carro e lugares:** o motorista cadastra o carro e o número de **lugares**; a cada passageiro aceito um lugar é ocupado, até a carona ficar **lotada**.
- **Preço por pessoa:** cada carona informa o **preço** por passageiro.
- **CEP → bairro/região:** ao digitar o CEP, o **bairro** é preenchido automaticamente (ViaCEP). Na busca, o CEP filtra caronas por região. Requer internet; **offline** apenas o filtro por CEP deixa de funcionar (o resto continua).
- **Dia da semana:** filtro por dia (ou "Dias úteis, seg–sex"), derivado da data da carona.
- **Reserva por data e horário:** cada carona tem data + horário próprios; ao pedir carona você reserva exatamente aquele dia/horário.

---

## 🧭 Fluxo de uso

1. **Cadastro/login** com e-mail `@facens.br`.
2. **Motorista** publica uma carona em *Oferecer* (sentido, carro, lugares, CEP/bairro, preço).
3. **Passageiro** procura em *Buscar* (por região/CEP, dia da semana, horário), abre a carona e clica em **Pedir carona**.
4. O **motorista** aceita/recusa em *Minhas caronas* (um lugar é descontado ao aceitar; ao esgotar, a carona **lota**).
5. Após a viagem, os dois se **avaliam** — a nota aparece no perfil.

---

## 🌐 Rotas da aplicação

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/` | Página inicial |
| GET/POST | `/cadastro` | Cadastro validado por e-mail institucional |
| GET/POST | `/login` | Login |
| POST | `/logout` | Sair |
| GET | `/caronas/buscar` | Buscar/parear caronas (filtros de região/CEP, dia, horário) |
| GET/POST | `/caronas/oferecer` | Oferecer carona |
| GET | `/caronas/minhas` | Minhas caronas (oferecidas e pedidas) |
| GET | `/caronas/:id` | Detalhes de uma carona |
| POST | `/caronas/:id/reservar` | Pedir carona |
| POST | `/caronas/:id/encerrar` | Encerrar carona (motorista) |
| POST | `/reservas/:id/responder` | Aceitar/recusar pedido (motorista) |
| POST | `/reservas/:id/cancelar` | Cancelar pedido (passageiro) |
| GET/POST | `/caronas/:id/avaliar` | Avaliar participantes |
| GET | `/usuarios/:id` | Perfil público com reputação |

---

## 🛠️ Tecnologias

- **Node.js + Express** — servidor e rotas
- **EJS** — templates das views
- **SQLite** (`better-sqlite3`) — banco de dados local em arquivo
- **bcryptjs** — hash de senha
- **express-session** — sessão de login
- **ViaCEP** — consulta de CEP → bairro/cidade (opcional, requer internet)

---

## 👥 Grupo BoraJunto

André Willian de Souza · Daniel Vitor Rodrigues Braatz · Gabriela Pereira Almagro · Luis Marcio Guitti

*Centro Universitário Facens — UPX (Usina de Projetos Experimentais).*
