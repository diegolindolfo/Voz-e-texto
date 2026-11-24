# Voz & Folha — Fábulas e Contos Infantis de Domínio Público

Biblioteca e intérprete dramatizado de **fábulas e contos infantis de domínio público** em português, com roteiros **pré-ajustados por IA**, múltiplas vozes naturais, sincronização turno a turno, destaque para a **Moral da História** e **áudios compactos em MP3** persistidos diretamente no **Cloud Firestore** (100% compatível com o plano gratuito Spark) e fallback offline via **Web Speech API**.

## Coletâneas Incluídas (Pré-Ajustadas por IA)

1. **Fábulas de Esopo**: *A Cigarra e a Formiga*, *A Lebre e a Tartaruga*, *O Leão e o Ratinho*, *A Raposa e as Uvas*, *O Lobo e o Cordeiro* e *O Corvo e a Raposa*.
2. **Contos Clássicos da Floresta (Irmãos Grimm & Charles Perrault)**: *Chapeuzinho Vermelho*, *Os Três Porquinhos*, *O Gato de Botas*, *João e Maria* e *O Pequeno Polegar*.
3. **Contos de Hans Christian Andersen**: *O Patinho Feio*, *O Soldadinho de Chumbo*, *A Roupa Nova do Imperador* e *A Princesa e a Ervilha*.
4. **Catálogo Rápido (Modo Curador)**: *Fábulas de La Fontaine* e *Contos Populares da Carochinha*.

---

## Segurança, Armazenamento e Modo Curador

- **Áudio MP3 leve (64 kbps)**: os áudios são codificados em MP3 diretamente no servidor (`@breezystack/lamejs`), reduzindo os arquivos em ~6–10x para reprodução rápida em redes móveis.
- **Alinhamento por detecção de silêncio PCM**: as fronteiras entre falas em lotes multi-turno são ajustadas automaticamente pelas pausas reais no áudio (`findSilenceMidpoints`).
- **Cloud Firestore em blocos compactos (Plano Free)**: os áudios MP3 (~400–800 KB cada) são divididos em apenas 1–2 blocos na subcoleção `prerenderedAudios/{cacheKey}/chunks`, dispensando o Firebase Storage pago (plano Blaze). Coleções importadas (`customBooks`) e roteiros dramatizados (`dramatizedScripts`) também ficam persistidos no Firestore, sobrevivendo a reinícios serverless na Vercel.
- **Endpoints `/api/*` protegidos**: rotas de geração com IA exigem token Bearer do Firebase Auth (`server/firebaseAuth.ts`) e rate limiting; rotas administrativas de fila, cache e coleções exigem o e-mail de administrador (`ADMIN_EMAILS`).
- **Modo Curador com fila client-side**: visitantes comuns veem uma interface limpa focada em leitura e reprodução. Administradores autenticados podem ativar o **Modo Curador** para executar pré-renderizações em lote direto do navegador (compatível com Vercel Serverless) e gerenciar coleções.

---

## Como publicar na Vercel

O projeto utiliza `vercel.json` com função serverless compilada em `api/index.js` a partir de `server/vercelEntry.ts`, servindo os MP3 estáticos de `public/audio-cache/`.

1. Configure as variáveis de ambiente na Vercel:
   - `GEMINI_API_KEY`: chave da API Gemini para síntese de voz e roteirização.
   - `FIREBASE_PROJECT_ID` (opcional): sobrescreve o ID definido em `firebase-applet-config.json`.
   - `ADMIN_EMAILS` (opcional): lista separada por vírgulas de e-mails autorizados como curadores.
2. Publique as regras do Firestore no seu projeto:
   - `firestore.rules`
3. Rode `npm run build` e faça o deploy na Vercel.

---

## Executando localmente

```bash
npm install
cp .env.example .env
# Preencha GEMINI_API_KEY no arquivo .env
npm run dev
```

Acesse `http://localhost:3000`.

### Testes e Verificação

```bash
npm run lint
npm test
npm run build
```
