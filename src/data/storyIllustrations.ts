import { READY_ILLUSTRATION_IDS } from './readyIllustrations';

export interface StoryIllustration {
  src: string;
  alt: string;
  prompt: string;
}

export const STORY_ART_STYLE_PROMPT =
  'Classic 19th-century European storybook illustration in warm watercolor and fine sepia ink linework, inspired by Arthur Rackham and Beatrix Potter. Warm golden-amber sunlight, soft forest greens and parchment tones, rich hand-painted paper texture, cozy timeless fairytale mood. Wide 16:9 horizontal panoramic composition, full-bleed artwork with no border, no frame, strictly no text, no letters, no words, no watermarks.';

export const STORY_ILLUSTRATIONS: Record<string, StoryIllustration> = {
  'esopo-cigarra-formiga': {
    src: '/illustrations/esopo-cigarra-formiga.jpg',
    alt: 'Ilustração em aquarela da Cigarra tocando violino no galho enquanto as formigas carregam grãos abaixo',
    prompt:
      'A cheerful cicada playing a tiny wooden violin atop a sunlit mossy oak branch in a golden summer meadow, while below on a forest path a diligent line of ants carries wheat grains toward a cozy tree-root anthill.',
  },
  'esopo-lebre-tartaruga': {
    src: '/illustrations/esopo-lebre-tartaruga.jpg',
    alt: 'Ilustração em aquarela da Tartaruga caminhando firme pela trilha rumo ao carvalho enquanto a Lebre descansa',
    prompt:
      'A gentle determined tortoise steadily walking along a winding sunlit woodland trail toward a giant ancient oak tree on a grassy hill, while further back a proud hare naps lazily beneath a flowering bush.',
  },
  'esopo-leao-ratinho': {
    src: '/illustrations/esopo-leao-ratinho.jpg',
    alt: 'Ilustração em aquarela do Leão dourado sob a figueira olhando surpreso para o pequeno Ratinho em sua pata',
    prompt:
      'A majestic golden lion resting peacefully under a spreading fig tree in a warm sunlit clearing, looking down with gentle surprise at a tiny expressive field mouse standing bravely on his paw.',
  },
  'esopo-raposa-uvas': {
    src: '/illustrations/esopo-raposa-uvas.jpg',
    alt: 'Ilustração em aquarela da Raposa saltando em direção a cachos de uvas roxas no alto da parreira',
    prompt:
      'A sleek russet red fox in a golden afternoon countryside vineyard, leaping gracefully upward toward lush clusters of ripe deep-purple grapes hanging high on a rustic wooden trellis.',
  },
  'esopo-corvo-raposa': {
    src: '/illustrations/esopo-corvo-raposa.jpg',
    alt: 'Ilustração em aquarela do Corvo no galho com um pedaço de queijo no bico observado pela Raposa',
    prompt:
      'A glossy black crow perched high on an autumn oak branch holding a wedge of golden cheese in its beak, while a clever smiling red fox looks up flatteringly from the mossy forest floor below.',
  },
  'esopo-rato-campo-cidade': {
    src: '/illustrations/esopo-rato-campo-cidade.jpg',
    alt: 'Ilustração em aquarela dos dois ratinhos espiando um banquete iluminado por velas atrás da cortina',
    prompt:
      'Two charming little mice in vintage waistcoats peeking from behind a grand velvet curtain at a lavish candlelit banquet table filled with cheeses, fruits, and pastries in a warm palace hall.',
  },
  'grimm-chapeuzinho': {
    src: '/illustrations/grimm-chapeuzinho.jpg',
    alt: 'Ilustração em aquarela de Chapeuzinho Vermelho na trilha florida do bosque observada pelo Lobo',
    prompt:
      'A little girl in a bright crimson hooded cloak carrying a wicker basket along a dappled sunlit forest path lined with wildflowers and tall pines, while a curious gray wolf watches from behind mossy trees.',
  },
  'grimm-tres-porquinhos': {
    src: '/illustrations/grimm-tres-porquinhos.jpg',
    alt: 'Ilustração em aquarela dos Três Porquinhos reunidos diante da casinha de tijolos na clareira',
    prompt:
      'Three cheerful little piglets standing together in a sunny forest clearing beside a sturdy cozy red-brick cottage with a warm smoking chimney, with a straw hut and wooden cabin visible in the meadow behind.',
  },
  'perrault-gato-de-botas': {
    src: '/illustrations/perrault-gato-de-botas.jpg',
    alt: 'Ilustração em aquarela do Gato de Botas com chapéu emplumado fazendo reverência na estrada para o castelo',
    prompt:
      'A clever orange tabby cat wearing polished tall leather boots and a feathered hat, bowing gallantly beside a sunlit country road with a distant fairytale castle perched on green hills.',
  },
  'grimm-joao-pe-feijao': {
    src: '/illustrations/grimm-joao-pe-feijao.jpg',
    alt: 'Ilustração em aquarela de João admirando o gigantesco pé de feijão subindo até o castelo nas nuvens',
    prompt:
      'A young country boy gazing upward in wonder from a small cottage garden as a colossal twisting emerald beanstalk climbs high into glowing golden clouds with a distant stone castle above.',
  },
  'grimm-musicos-bremen': {
    src: '/illustrations/grimm-musicos-bremen.jpg',
    alt: 'Ilustração em aquarela do Burro, do Cão, da Gata e do Galo empilhados espiando a janela iluminada',
    prompt:
      'A gentle donkey, a friendly hound, a tabby cat, and a proud rooster stacked playfully on top of one another peering through the glowing warm window of a cozy timber forest cottage at twilight.',
  },
  'andersen-patinho-feio': {
    src: '/illustrations/andersen-patinho-feio.jpg',
    alt: 'Ilustração em aquarela do jovem cisne branco contemplando seu reflexo no lago sereno da primavera',
    prompt:
      'A graceful snow-white young swan admiring its shimmering reflection in a tranquil spring pond surrounded by blooming reeds, willow branches, and golden morning light.',
  },
  'andersen-roupa-imperador': {
    src: '/illustrations/andersen-roupa-imperador.jpg',
    alt: 'Ilustração em aquarela da corte no pátio do palácio com o Imperador ao lado do tear vazio dos tecelões',
    prompt:
      'A grand ornate fairytale palace courtyard bathed in sunlight where a pompous emperor walks beneath a royal canopy while two sneaky weavers gesture dramatically beside an empty golden loom and townsfolk whisper in wonder.',
  },
  'andersen-soldadinho-chumbo': {
    src: '/illustrations/andersen-soldadinho-chumbo.jpg',
    alt: 'Ilustração em aquarela do Soldadinho de Chumbo navegando em um barquinho de papel rumo à janela da bailarina',
    prompt:
      'A brave little painted tin soldier standing upright inside a folded white paper boat sailing down a sparkling cobblestone stream, while in the warm sunlit window above a delicate paper ballerina watches.',
  },
  'andersen-princesa-ervilha': {
    src: '/illustrations/andersen-princesa-ervilha.jpg',
    alt: 'Ilustração em aquarela da princesa subindo a escada até a pilha alta de colchões com a ervilha escondida na base',
    prompt:
      'A cozy candlelit royal bedroom with an impossibly tall stack of colorful embroidered quilts and plush mattresses reaching toward the arched ceiling, a tired young princess climbing a wooden ladder to bed, and a single tiny green pea glowing subtly beneath the bottom mattress.',
  },
  'lf-lobo-cordeiro': {
    src: '/illustrations/lf-lobo-cordeiro.jpg',
    alt: 'Ilustração em aquarela do Cordeiro bebendo água cristalina rio abaixo enquanto o Lobo observa das pedras',
    prompt:
      'A gentle white lamb drinking calmly downstream by a crystal-clear mountain brook lined with ferns and wildflowers, while a stern gray wolf stands upstream on mossy rocks under golden woodland light.',
  },
  'lf-galinha-ovos-ouro': {
    src: '/illustrations/lf-galinha-ovos-ouro.jpg',
    alt: 'Ilustração em aquarela dos camponeses admirando a galinha no ninho de palha ao lado de um ovo dourado',
    prompt:
      'A cozy rustic farmhouse barn bathed in warm morning sunbeams, where an amazed peasant couple kneels beside a plump speckled hen nesting in golden straw next to a gleaming solid gold egg.',
  },
  'cc-festa-no-ceu': {
    src: '/illustrations/cc-festa-no-ceu.jpg',
    alt: 'Ilustração em aquarela dos pássaros celebrando entre nuvens douradas enquanto o Jabuti espia da viola',
    prompt:
      'A starry twilight sky above billowing golden-pink clouds where colorful Brazilian birds and toucans celebrate with lanterns and music, while a clever smiling tortoise peeks cheerfully out from the soundhole of a wooden guitar.',
  },
};

export function getStoryIllustration(
  chapterId?: string,
  explicitUrl?: string,
): StoryIllustration | null {
  if (explicitUrl) {
    return {
      src: explicitUrl,
      alt: 'Ilustração da história',
      prompt: '',
    };
  }
  if (!chapterId || !READY_ILLUSTRATION_IDS.has(chapterId)) return null;
  return STORY_ILLUSTRATIONS[chapterId] ?? null;
}
