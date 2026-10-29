-- ============================================================
--  BoraJunto - Script de criacao do banco de dados
--  Projeto de Extensao UPX - Centro Universitario Facens
--  SGBD: SQLite 3
-- ------------------------------------------------------------
--  Como usar:
--    1) O proprio site cria o banco automaticamente a partir
--       deste script na primeira execucao (npm start).
--    2) Para criar manualmente, instale o "DB Browser for SQLite"
--       ou a CLI do sqlite3 e rode:
--
--          sqlite3 borajunto.db < banco/criar_banco.txt
--
--  Observacao: em SQLite, INTEGER PRIMARY KEY AUTOINCREMENT gera
--  o id sozinho. As datas ficam como TEXT no formato ISO
--  (YYYY-MM-DD para dia e HH:MM para horario).
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- Tabela: usuarios
-- Estudantes cadastrados (podem ser motorista e/ou passageiro).
-- O cadastro e validado pelo e-mail institucional (@facens.br).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT    NOT NULL,
    ra          TEXT,
    email       TEXT    NOT NULL UNIQUE,
    senha_hash  TEXT    NOT NULL,
    telefone    TEXT,
    fator_reputacao REAL NOT NULL DEFAULT 1.0,  -- multiplicador da nota (1.0 = cheio); cada cancelamento de corrida x0.9
    foto        TEXT,                           -- foto de perfil (data URL base64); NULL = usa a inicial do nome
    papel       TEXT    NOT NULL DEFAULT 'usuario',  -- 'usuario' | 'admin' (admin so administra, nao pega carona)
    banido      INTEGER NOT NULL DEFAULT 0,     -- 1 = conta banida (nao consegue entrar)
    criado_em   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ------------------------------------------------------------
-- Tabela: veiculos
-- Carro do motorista (opcional). Um usuario pode ter varios.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  INTEGER NOT NULL,
    modelo      TEXT    NOT NULL,
    placa       TEXT,
    cor         TEXT,
    capacidade  INTEGER NOT NULL DEFAULT 4,
    criado_em   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Tabela: caronas
-- Carona OFERECIDA por um motorista (carro, rota, horario e lugares).
-- Requisito 2 (Oferecer carona).
--
-- O CARRO fica gravado na propria carona (modelo/placa/cor) e o numero
-- de LUGARES oferecidos e "vagas_total". "vagas_disponiveis" cai a cada
-- passageiro aceito; quando chega a 0 a carona esta LOTADA.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS caronas (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    motorista_id      INTEGER NOT NULL,
    origem            TEXT    NOT NULL,
    destino           TEXT    NOT NULL,
    sentido           TEXT    NOT NULL DEFAULT 'volta',  -- 'ida' (para a faculdade) | 'volta' (da faculdade)
    ponto_referencia  TEXT,
    cep               TEXT,               -- CEP do bairro do aluno (so digitos)
    bairro            TEXT,               -- regiao resolvida pelo CEP (ViaCEP)
    cidade            TEXT,
    uf                TEXT,
    data_viagem       TEXT    NOT NULL,   -- YYYY-MM-DD (o dia da semana e derivado com strftime('%w', data_viagem))
    horario           TEXT    NOT NULL,   -- HH:MM
    veiculo_modelo    TEXT,               -- carro usado na carona (ex.: Honda Fit)
    veiculo_placa     TEXT,
    veiculo_cor       TEXT,
    vagas_total       INTEGER NOT NULL DEFAULT 1,   -- lugares oferecidos no carro
    vagas_disponiveis INTEGER NOT NULL DEFAULT 1,   -- lugares ainda livres (0 = LOTADA)
    valor_rateio      REAL    NOT NULL DEFAULT 0,
    observacoes       TEXT,
    status            TEXT    NOT NULL DEFAULT 'ativa',  -- ativa | encerrada | cancelada
    inicio_avisado_em TEXT,                              -- quando o motorista avisou "corrida vai começar" (NULL = ainda não)
    inicio_minutos    INTEGER,                           -- "começa em até X minutos" avisado aos passageiros
    ponto_encontro    TEXT,                              -- ponto de encontro combinado no aviso de início
    recorrencia_id    INTEGER,                           -- se veio de uma rotina semanal (caronas_recorrentes.id); NULL = carona avulsa
    criado_em         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (motorista_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Tabela: reservas
-- Pedido de carona feito por um passageiro em uma carona.
-- Requisitos 3 e 4 (Buscar carona / Pareamento de trajetos).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    carona_id     INTEGER NOT NULL,
    passageiro_id INTEGER NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'pendente', -- pendente | aceita | recusada | cancelada
    criado_em     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (carona_id)     REFERENCES caronas  (id) ON DELETE CASCADE,
    FOREIGN KEY (passageiro_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    UNIQUE (carona_id, passageiro_id)
);

-- ------------------------------------------------------------
-- Tabela: avaliacoes
-- Avaliacao mutua entre usuarios apos a viagem.
-- Requisito 5 (Avaliacao).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avaliacoes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    carona_id    INTEGER NOT NULL,
    avaliador_id INTEGER NOT NULL,
    avaliado_id  INTEGER NOT NULL,
    nota         INTEGER NOT NULL,   -- 1 a 5
    comentario   TEXT,
    criado_em    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (carona_id)    REFERENCES caronas  (id) ON DELETE CASCADE,
    FOREIGN KEY (avaliador_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    FOREIGN KEY (avaliado_id)  REFERENCES usuarios (id) ON DELETE CASCADE,
    UNIQUE (carona_id, avaliador_id, avaliado_id)
);

-- ------------------------------------------------------------
-- Indices para acelerar as buscas de carona e o pareamento.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_caronas_busca   ON caronas (status, data_viagem, horario);
CREATE INDEX IF NOT EXISTS idx_caronas_destino ON caronas (destino);
CREATE INDEX IF NOT EXISTS idx_caronas_regiao  ON caronas (cidade, bairro);
CREATE INDEX IF NOT EXISTS idx_reservas_carona ON reservas (carona_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_alvo ON avaliacoes (avaliado_id);

-- ------------------------------------------------------------
-- Tabela: mensagens
-- Chat entre passageiro e motorista, ANCORADO na reserva.
-- Cada reserva e uma conversa (os dois participantes sao o
-- passageiro da reserva e o motorista da carona). So existe
-- conversa onde existe reserva (seguranca: nao ha mensagem
-- livre entre desconhecidos).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensagens (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    reserva_id   INTEGER NOT NULL,
    remetente_id INTEGER NOT NULL,
    texto        TEXT    NOT NULL,
    lida         INTEGER NOT NULL DEFAULT 0,   -- 0 = nao lida, 1 = lida
    criado_em    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (reserva_id)   REFERENCES reservas (id) ON DELETE CASCADE,
    FOREIGN KEY (remetente_id) REFERENCES usuarios (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mensagens_reserva ON mensagens (reserva_id, id);

-- ------------------------------------------------------------
-- Tabela: caronas_recorrentes
-- Rotina semanal do motorista (ex.: seg a sex, 22:40, Facens -> Eden).
-- NAO e uma carona: e o MOLDE. O sistema gera caronas normais
-- (com data_viagem concreta) a partir dela, para os proximos dias,
-- e as reservas/chat/avaliacao acontecem nessas caronas geradas.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS caronas_recorrentes (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    motorista_id      INTEGER NOT NULL,
    origem            TEXT    NOT NULL,
    destino           TEXT    NOT NULL,
    sentido           TEXT    NOT NULL DEFAULT 'volta',
    ponto_referencia  TEXT,
    cep               TEXT,
    bairro            TEXT,
    cidade            TEXT,
    uf                TEXT,
    dias_semana       TEXT    NOT NULL,   -- dias em que repete, CSV de 0..6 (0=Dom ... 6=Sab). Ex.: '1,2,3,4,5'
    horario           TEXT    NOT NULL,   -- HH:MM
    veiculo_modelo    TEXT,
    veiculo_placa     TEXT,
    veiculo_cor       TEXT,
    vagas_total       INTEGER NOT NULL DEFAULT 1,
    valor_rateio      REAL    NOT NULL DEFAULT 0,
    observacoes       TEXT,
    ativa             INTEGER NOT NULL DEFAULT 1,   -- 1 = gera novas datas; 0 = pausada
    validade          TEXT,                         -- YYYY-MM-DD opcional (ate quando repetir); NULL = sem fim
    criado_em         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (motorista_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

-- Impede gerar a MESMA data duas vezes para a mesma rotina (INSERT OR IGNORE).
-- Parcial: so vale para caronas que vieram de rotina (recorrencia_id preenchido).
CREATE UNIQUE INDEX IF NOT EXISTS idx_caronas_recorrencia
    ON caronas (recorrencia_id, data_viagem)
    WHERE recorrencia_id IS NOT NULL;

-- ------------------------------------------------------------
-- Tabela: localizacoes
-- Posição ao vivo de cada participante de uma corrida EM ANDAMENTO
-- (motorista + passageiros aceitos). Uma linha por (carona, usuário),
-- atualizada a cada envio. Usada só enquanto a corrida está iniciada;
-- o mapa mostra quem atualizou nos últimos segundos.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS localizacoes (
    carona_id     INTEGER NOT NULL,
    usuario_id    INTEGER NOT NULL,
    lat           REAL    NOT NULL,
    lng           REAL    NOT NULL,
    atualizado_em TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    PRIMARY KEY (carona_id, usuario_id),
    FOREIGN KEY (carona_id)  REFERENCES caronas  (id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);
