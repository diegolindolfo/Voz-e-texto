# Voz & Folha — Fábulas e Contos Infantis de Domínio Público

Biblioteca e intérprete dramatizado de **fábulas e contos infantis de domínio público** em português, com roteiros **pré-ajustados por IA**, múltiplas vozes naturais, sincronização turno a turno, destaque para a **Moral da História** e **áudios pré-renderizados em WAV**.

## Coletâneas Incluídas (Pré-Ajustadas por IA)

1. **Fábulas de Esopo**: *A Cigarra e a Formiga*, *A Lebre e a Tartaruga*, *O Leão e o Ratinho*, *A Raposa e as Uvas*, *O Lobo e o Cordeiro* e *O Corvo e a Raposa*.
2. **Contos Clássicos da Floresta (Irmãos Grimm & Charles Perrault)**: *Chapeuzinho Vermelho*, *Os Três Porquinhos*, *O Gato de Botas*, *João e Maria* e *O Pequeno Polegar*.
3. **Contos de Hans Christian Andersen**: *O Patinho Feio*, *O Soldadinho de Chumbo*, *A Roupa Nova do Imperador* e *A Princesa e a Ervilha*.
4. **Catálogo Rápido (1 Clique)**: *Fábulas de La Fontaine* e *Contos Populares da Carochinha*.

---

## Como publicar no GitHub e na Vercel

O projeto já está configurado com `vercel.json` e função serverless em `api/index.ts`, empacotando automaticamente os arquivos pré-renderizados de `data/audio-cache/`.

### 1. Subir para o GitHub

```bash
git init
git add .
git commit -m "feat: biblioteca de fábulas e contos infantis pré-renderizados e pré-ajustados por IA"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### 2. Importar na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new) e importe o repositório do GitHub.
2. As configurações de build são detectadas automaticamente via `vercel.json`:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Em **Environment Variables** no painel da Vercel, adicione:
   - `GEMINI_API_KEY`: sua chave da API Gemini (usada para pré-renderizar novos contos em WAV ou importar novas fábulas com IA; os contos já pré-renderizados em `data/audio-cache/` tocam imediatamente sem consumir cota).
4. Clique em **Deploy**.

---

## Executando localmente

```bash
npm install
cp .env.example .env
# Preencha GEMINI_API_KEY no arquivo .env
npm run dev
```

Acesse `http://localhost:3000`.
