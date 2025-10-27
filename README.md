# Gaia Collector

## 🧭 Índice

* ⚙️ [Visão Geral](#visao-geral)
* 🚀 [Principais Recursos](#principais-recursos)
* 🛠️ [Principais Tecnologias](#principais-tecnologias)
* 🧩 [Arquitetura em Alto Nível](#arquitetura-em-alto-nível)
* 🧱 [Requisitos](#requisitos)
* 🧾 [Configuração do Ambiente](#configuração-do-ambiente)
* 💻 [Execução Local](#execução-local)
* 🗄️ [Banco de Dados e Seeds](#banco-de-dados-e-seeds)
* 🧪 [Testes e Qualidade](#testes-e-qualidade)
* 🤖 [Pipelines CI/Deployment](#pipelines-cideployment)
* 📘 [Documentação da API](#documentação-da-api)
* 🗂️ [Estrutura de Pastas](#estrutura-de-pastas-resumo)

---

## ⚙️ Visão Geral

Gaia Collector é um serviço Bun responsável por consumir mensagens de estações meteorológicas via MQTT seguro, normalizar os payloads recebidos em JSON e persistir os dados no MongoDB. Além do pipeline de ingestão, o projeto expõe um serviço HTTP leve para health-check e oferece um utilitário opcional para simular estações de telemetria durante o desenvolvimento.

## 🚀 Principais Recursos

* **Ingestão MQTT**: conexão segura com broker (`mqtts`) e inscrição automática no tópico configurado.
* **Normalização e persistência**: transformação do payload em documento enriquecido com `receivedAt` e `topic`, armazenado na coleção `readings`.
* **Validação de ambiente**: schema Zod bloqueia o bootstrap quando variáveis obrigatórias estão ausentes ou inválidas.
* **Serviço HTTP embutido**: endpoint `GET /health` expondo estado do coletor.
* **Logs explicativos**: mensagens com ícones destacam conexões, inserções e erros de parsing.
* **Simulador de telemetria**: utilitário WebSocket/HTTP publica payloads fictícios no broker para testes.

## 🛠️ Principais Tecnologias

* **Bun 1.x** como runtime JavaScript/TypeScript e servidor HTTP nativo.
* **TypeScript** para tipagem estática do projeto.
* **mqtt** (versão 5) como client MQTT com suporte TLS.
* **MongoDB Node Driver** para conexão e operações na base.
* **Zod** para validação de variáveis de ambiente.
* **dotenv** para carregar configurações do arquivo `.env`.
* **Docker + docker compose** utilizados no provisionamento local do MongoDB.

## 🧩 Arquitetura em Alto Nível

* `src/index.ts` inicializa o processo: valida ambiente, ativa ingestão via MQTT e sobe o servidor HTTP de health-check.
* `src/providers/broker` gerencia um cliente MQTT singleton, incluindo reconexão e desligamento gracioso.
* `src/modules/receive-and-process-data` concentra a lógica de assinatura do tópico e persistência dos payloads no MongoDB.
* `src/database` fornece a conexão única com o banco e controla o ciclo de vida do cliente MongoDB.
* `test-generator/` expõe HTTP/WebSocket em `localhost:4445` para controlar a simulação e enviar mensagens de teste ao broker.

## 🧱 Requisitos

* Bun 1.1+ (inclui `bun`, `bunx` e `bun install`).
* Node.js opcional (apenas se quiser executar ferramentas externas não compatíveis com Bun).
* Docker e Docker Compose (opcional, recomendados para subir o MongoDB local).
* MongoDB 6+ (local ou remoto) acessível via URI.
* Broker MQTT com suporte a TLS (`mqtts`).

## 🧾 Configuração do Ambiente

1. Instale as dependências do projeto:

   ```bash
   bun install
   ```
2. Crie um arquivo `.env` na raiz (ou duplique o `.env.example`) e preencha as variáveis listadas abaixo.
3. Utilize o certificado `global-bundle.pem` (já incluso no repositório) quando precisar autenticar o client MQTT via CA.

| Variável          | Descrição                                                                 | Exemplo                                                         |
| ----------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `MQTT_BROKER_URL` | Hostname ou IP do broker MQTT.                                            | `mqtt.example.com`                                              |
| `MQTT_USERNAME`   | Usuário para autenticação no broker.                                      | `your-mqtt-username`                                            |
| `MQTT_PASSWORD`   | Senha do usuário MQTT.                                                    | `your-mqtt-password`                                            |
| `MQTT_TOPIC`      | Tópico de ingestão das mensagens.                                         | `sensors_data`                                                  |
| `MQTT_PORT`       | Porta segura do broker MQTT.                                              | `8883`                                                          |
| `MONGODB_URI`     | String de conexão com o MongoDB (inclui usuário/senha quando necessário). | `mongodb://myuser:mypassword@localhost:27017/gaia?authSource=admin` |
| `PORT`            | Porta HTTP exposta pelo health-check do coletor.                          | `4444`                                                          |
| `CA_CERT_PATH`    | Caminho para o certificado da CA usado na conexão TLS com o broker.       | `./global-bundle.pem`                                           |

> 💡 **Observação:** o schema oficial das variáveis está em `src/schemas/env-schema.ts`. Qualquer mudança de obrigatoriedade ou default deve ser aplicada lá antes de atualizar o `.env`.

## 💻 Execução Local

### Subindo dependências com Docker Compose

```bash
docker compose up mongo
```

O serviço expõe o MongoDB na porta `27017` com usuário e senha definidos no `docker-compose.yml` (`myuser` / `mypassword`). Atualize a `MONGODB_URI` para refletir essas credenciais.

### Rodando o coletor em desenvolvimento

```bash
bun run dev
```

O processo inicializa o pipeline MQTT e disponibiliza o health-check em `http://localhost:4444/health`. Você também pode executar diretamente o entrypoint:

```bash
bun run src/index.ts
```

### Utilizando o simulador de telemetria (opcional)

```bash
bun run test-generator/index.ts
```

O utilitário serve a interface Web em `http://localhost:4445`. A partir dela é possível escolher estações fictícias e publicar mensagens de exemplo no broker configurado.

## 🗄️ Banco de Dados e Seeds

* A coleção padrão é `readings`; os documentos recebem o payload original mais metadados (`receivedAt`, `topic`).
* Não há scripts automáticos de seed. Utilize o simulador ou publique mensagens reais no broker para popular a base.
* Para manutenção local, explore `mongosh` ou ferramentas gráficas apontando para a `MONGODB_URI` utilizada.

## 🧪 Testes e Qualidade

* Ainda não existe suíte de testes automatizados. O script `bun run test` inicia o simulador para facilitar cenários manuais.
* Recomenda-se validar mensagens e fluxos usando o simulador ou clientes MQTT (MQTTX, mosquitto_pub) antes de promover alterações.
* Configure linting e type-check adicionais conforme necessário (ex.: Biome, `bunx tsc --noEmit`).

## 🤖 Pipelines CI/Deployment

* **Continuous Integration (`.github/workflows/ci.yml`)** — executa em pushes/PRs para `main` e `production`, validando regras de merge entre as branches principais.
* **Deployment reutilizável (`deployment.yaml`)** — workflow chamado por outros pipelines, responsável por buildar a imagem Docker, publicar no ECR e atualizar a task do ECS.
* **Staging Deployment (`staging-deployment.yaml`)** — dispara em pull requests para `main`, reutilizando `deployment.yaml` com `environment=dev` e herdando secrets para deploy no ECS.

## 📘 Documentação da API

* `GET /health` — retorna `{ "status": "ok" }` quando o coletor está ativo.
* Demais requisições respondem com mensagem simples confirmando que o serviço está em execução.

## 🗂️ Estrutura de Pastas (resumo)

```
src/
  constants/              # Variáveis e constantes derivadas de configuração
  database/               # Conexão MongoDB (singleton e teardown)
  modules/                # Casos de uso de ingestão e persistência
    receive-and-process-data/
  providers/              # Integrações externas (MQTT broker, etc.)
  schemas/                # Schemas Zod para validar ambiente

test-generator/           # Servidor de simulação MQTT + assets estáticos
Dockerfile                # Build da imagem Bun para produção
```
---
