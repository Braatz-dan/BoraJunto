-- ============================================================
--  BoraJunto - Dados de exemplo (opcional)
--  Rodado automaticamente na 1a execucao se o banco estiver vazio.
--  As senhas de todos os usuarios de exemplo sao: 123456
--  (o hash abaixo e bcrypt de "123456")
-- ============================================================

INSERT INTO usuarios (nome, ra, email, senha_hash, telefone) VALUES
  ('Rafael Andrade',  '251178', 'rafael.andrade@facens.br',  '$2b$10$w1q0Zp6mQyq0iZ8n3m3G8uJp9v4Yb1nQf4t8v1s6d0a2c4e6g8i0', '15991110001'),
  ('Mariana Lopes',   '251075', 'mariana.lopes@facens.br',   '$2b$10$w1q0Zp6mQyq0iZ8n3m3G8uJp9v4Yb1nQf4t8v1s6d0a2c4e6g8i0', '15991110002'),
  ('Gabriela Almagro','120568', 'gabriela.almagro@facens.br','$2b$10$w1q0Zp6mQyq0iZ8n3m3G8uJp9v4Yb1nQf4t8v1s6d0a2c4e6g8i0', '15991110003');

INSERT INTO veiculos (usuario_id, modelo, placa, cor, capacidade) VALUES
  (1, 'Honda Fit', 'ABC1D23', 'Prata', 4);

INSERT INTO caronas (motorista_id, origem, destino, ponto_referencia, data_viagem, horario, vagas_total, vagas_disponiveis, valor_rateio, observacoes, status) VALUES
  (1, 'Facens', 'Centro de Sorocaba',   'Terminal Sao Bento', date('now', '+1 day'), '22:40', 3, 3, 8.00,  'Saida logo apos a ultima aula.', 'ativa'),
  (1, 'Facens', 'Zona Norte - Sorocaba','Shopping Iguatemi',  date('now', '+2 day'), '22:50', 2, 2, 6.00,  'Levo ate pontos no caminho.',    'ativa');
