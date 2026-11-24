import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { STORY_ART_STYLE_PROMPT, STORY_ILLUSTRATIONS } from '../src/data/storyIllustrations';

const PRIMARY_MODEL = process.env.NANO_BANANA_MODEL || 'gemini-nano-banana-2.1';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite-image';
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'illustrations');
const READY_MANIFEST_PATH = path.resolve(process.cwd(), 'src', 'data', 'readyIllustrations.ts');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeReadyManifest(outputDir: string): string[] {
  const readyIds = Object.keys(STORY_ILLUSTRATIONS).filter((id) =>
    fs.existsSync(path.join(outputDir, `${id}.jpg`)),
  );
  const formattedIds = readyIds.map((id) => `  '${id}',`).join('\n');
  const fileContent = `/**
 * Generated/maintained by \`npm run illustrations:prerender\`.
 * Only story IDs listed here render an illustration header, preventing 404 requests or layout shift.
 */
export const READY_ILLUSTRATION_IDS: ReadonlySet<string> = new Set([
${formattedIds}
]);
`;
  fs.writeFileSync(READY_MANIFEST_PATH, fileContent, 'utf-8');
  return readyIds;
}

function isRetryableImageError(message: string): boolean {
  return /429|503|UNAVAILABLE|RESOURCE_EXHAUSTED|capacity|rate|timeout|overloaded/i.test(message);
}

async function generateOneIllustration(
  client: GoogleGenAI,
  id: string,
  scenePrompt: string,
): Promise<{ buffer: Buffer; modelUsed: string }> {
  const fullPrompt = `${STORY_ART_STYLE_PROMPT} Scene: ${scenePrompt}`;
  const candidateModels =
    PRIMARY_MODEL === FALLBACK_MODEL ? [PRIMARY_MODEL] : [PRIMARY_MODEL, FALLBACK_MODEL];

  let lastError: unknown;
  for (const modelName of candidateModels) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const interaction = await client.interactions.create({
          model: modelName,
          input: fullPrompt,
          response_format: {
            type: 'image',
            aspect_ratio: '16:9',
            image_size: '1K',
            mime_type: 'image/jpeg',
            delivery: 'inline',
          },
        });

        const base64Data = interaction.output_image?.data;
        if (!base64Data) {
          throw new Error(`Modelo ${modelName} não retornou dados de imagem para "${id}".`);
        }

        return {
          buffer: Buffer.from(base64Data, 'base64'),
          modelUsed: modelName,
        };
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (!isRetryableImageError(msg)) {
          throw err;
        }
        if (attempt < 3) {
          const delayMs = 2500 * attempt;
          console.warn(
            `  [retry ${attempt}/2] ${id} (${modelName}): ${msg.slice(0, 120)} — aguardando ${delayMs}ms…`,
          );
          await sleep(delayMs);
        } else {
          console.warn(
            `  [${modelName}] indisponível para "${id}", tentando próximo modelo se houver…`,
          );
        }
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.error(
      'Erro: defina GEMINI_API_KEY no arquivo .env ou nas variáveis de ambiente antes de rodar npm run illustrations:prerender.',
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const filterIds = new Set(args.filter((arg) => !arg.startsWith('--')));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const allEntries = Object.entries(STORY_ILLUSTRATIONS);
  const targetEntries =
    filterIds.size > 0
      ? allEntries.filter(([id]) => filterIds.has(id))
      : allEntries;

  if (targetEntries.length === 0) {
    console.error('Nenhum ID de história correspondente encontrado para gerar.');
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });
  let generatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < targetEntries.length; i += 1) {
    const [id, entry] = targetEntries[i];
    const targetPath = path.join(OUTPUT_DIR, `${id}.jpg`);

    if (!force && fs.existsSync(targetPath)) {
      skippedCount += 1;
      console.log(`[${i + 1}/${targetEntries.length}] ${id}.jpg já existe — pulando.`);
      continue;
    }

    console.log(`[${i + 1}/${targetEntries.length}] Gerando ${id}.jpg com Nano Banana…`);
    const { buffer, modelUsed } = await generateOneIllustration(client, id, entry.prompt);
    fs.writeFileSync(targetPath, buffer);
    generatedCount += 1;
    writeReadyManifest(OUTPUT_DIR);
    console.log(
      `  ✓ Salvo (${Math.round(buffer.byteLength / 1024)} KB, modelo: ${modelUsed})`,
    );

    if (i < targetEntries.length - 1) {
      await sleep(2000);
    }
  }

  const readyIds = writeReadyManifest(OUTPUT_DIR);
  console.log(
    `\nConcluído: ${generatedCount} geradas, ${skippedCount} reaproveitadas. Total ativo no leitor: ${readyIds.length}/${allEntries.length}.`,
  );
}

main().catch((err) => {
  console.error('Falha na pré-renderização de ilustrações:', err);
  process.exit(1);
});
