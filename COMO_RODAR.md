# ▶️ Como rodar o BoraJunto (passo a passo)

Guia rápido para colocar o projeto no ar na sua máquina, do zero. Não precisa saber programar — é só seguir na ordem.

---

## 1. Instalar o Node.js (só na primeira vez)

O projeto roda em **Node.js**. Verifique se você já tem:

```bash
node -v
```

- Se aparecer algo como `v18...`, `v20...` ou `v24...`, está tudo certo (precisa ser **18 ou maior**).
- Se der erro ou "não reconhecido", baixe e instale o Node em **https://nodejs.org** (versão **LTS**) e reinicie o terminal.

---

## 2. Abrir o terminal na pasta do projeto

Abra o **Prompt de Comando** / **PowerShell** (Windows) ou o **Terminal** (Mac/Linux) dentro da pasta `borajunto`.

> No Windows, dá para abrir a pasta no Explorer, digitar `cmd` na barra de endereço e apertar Enter.

Confirme que você está no lugar certo (deve aparecer `package.json`, `server.js`, `banco`...):

```bash
dir        # Windows
# ls       # Mac/Linux
```

---

## 3. Instalar as dependências (só na primeira vez)

```bash
npm install
```

Isso baixa tudo que o projeto precisa (cria a pasta `node_modules`). Pode demorar 1–2 minutos.

---

## 4. (Opcional) Criar o banco de dados antes

O banco é criado **sozinho** ao iniciar o servidor. Mas, se quiser criar/conferir antes:

```bash
npm run init-db
```

Ele mostra `Banco NAO encontrado. Criando um novo...` na primeira vez e `Banco encontrado` depois. Pode rodar quantas vezes quiser (não apaga nada).

---

## 5. Iniciar o site

```bash
npm start
```

Vai aparecer algo assim no terminal:

```
  BoraJunto rodando!
  > Acesse: http://localhost:3000
```

**Abra no navegador o endereço que apareceu** (normalmente `http://localhost:3000`).

> Se a porta 3000 estiver ocupada, o próprio sistema escolhe a próxima livre (3001, 3002...) e mostra o link certo no terminal. Use sempre o link que aparecer.

Para **parar** o servidor, volte ao terminal e aperte `Ctrl + C`.

---

## 6. Entrar com uma conta de teste

O sistema já vem com contas prontas (senha de todas: **`123456`**):

| Perfil | E-mail |
| --- | --- |
| 🚗 Motorista | `rafael.andrade@facens.br` |
| 🧍 Passageira | `mariana.lopes@facens.br` |
| 🧍 Passageiro | `bruno.carvalho@facens.br` |
| 🧍 Passageira (sem caronas) | `larissa.nogueira@facens.br` |

Ou clique em **Criar conta** e cadastre-se com um e-mail terminado em **`@facens.br`**.

---

## Resumo (quem já instalou, é só isto)

```bash
npm start
```

E abrir o link mostrado no terminal.

---

## ❓ Problemas comuns

| Problema | O que fazer |
| --- | --- |
| `node` não é reconhecido | Node.js não está instalado (veja o passo 1) ou o terminal precisa ser reaberto. |
| `EADDRINUSE ... port 3000` | A porta está ocupada. O sistema já tenta a próxima sozinho; se quiser forçar outra: `set PORT=4000 && npm start` (Windows) ou `PORT=4000 npm start` (Mac/Linux). |
| `Cannot find module ...` | Faltou o `npm install` (passo 3). |
| Quero recomeçar o banco do zero | Pare o servidor (`Ctrl + C`), apague o arquivo `borajunto.db` e rode `npm start` de novo — ele recria com os dados de exemplo. |
| A busca por CEP não acha a região | O CEP usa a internet (ViaCEP). Sem internet, só o filtro por CEP para de funcionar; o resto continua normal. |

---

*Dúvidas? Veja o [README.md](README.md) para a documentação completa do projeto.*
