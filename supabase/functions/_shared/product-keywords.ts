// Fonte ÚNICA de detecção de produto por palavra-chave (zero LLM).
// Importado por scan-services (detecção primária) e analyze-lead (fallback da IA),
// que antes mantinham cópias DIVERGENTES da lista — o analyze-lead ainda tinha o
// token solto 'sound' (falso-positivo: a loja se chama "Pro Car Sound", casava em
// ~91% das conversas) que o scan-services já havia removido. Centralizar evita isso.
//
// Nome canônico do produto -> gatilhos (substring, case-insensitive). Os nomes
// devem bater com products.product_name para o mapeamento downstream (Kommo, dashboards).
export const PRODUCT_KEYWORDS: Record<string, string[]> = {
  'Remote Start': [
    'remote start', 'remote starter', 'remote-start', 'partida remota', 'partida a distancia',
    'partida à distância', 'liga sozinho', 'controle remoto pra ligar', 'compustar', 'viper start',
  ],
  'CarPlay': [
    'carplay', 'car play', 'apple carplay', 'apple car play', 'android auto', 'sistema multimidia',
    'central multimidia', 'multimídia', 'head unit', 'head-unit', 'head unit install', 'aftermarket unit',
    'aftermarket radio', 'aftermarket screen', 'screen upgrade', 'upgrade screen', 'upgrade radio',
    'touch screen', 'multimedia screen', 'pioneer dmh', 'pioneer 3000', 'pioneer avh', 'pioneer 8600',
    'pioneer nex', 'kenwood ddx', 'kenwood dmx', 'sony xav', 'alpine ilx', 'atoto', 'double din',
    'jensen', 'infotainment',
    // Frasings reais que o catálogo antigo perdia (clientes que tinham a tela e queriam só instalar):
    'screen update', 'screen install', 'install screen', 'install a screen', 'i have a screen',
    'i have my screen', 'my screen', 'a screen', 'the screen', 'new screen', 'radio swap', 'swap radio',
    'swap the radio', 'radio replacement', 'new radio',
  ],
  'Sound System': [
    // NÃO usar o token solto 'sound': a loja se chama "Pro Car Sound", então o
    // nome/assinatura/link casava em ~91% das conversas (falso positivo). Manter
    // só termos específicos de áudio.
    'sound system', ' som ', 'som automotivo', 'caixa de som', 'subwoofer', 'amplificador',
    'speaker', 'speakers', 'alto falante', 'alto-falante', 'alto-falantes', 'auto falante',
    'audio upgrade', 'audio system', 'sound upgrade', ' sub ', ' sub.', ' sub,', 'sub and amp',
    'sub & amp', 'sub box', 'sub enclosure', ' amp ', ' amp.', ' amp,', 'amplifier', 'tweeter',
    'tweeters', 'midrange', 'midbass', 'crossover', 'enclosure', 'pillar pod', 'pillar pods',
    'a-pillar', 'sound pod', 'chuchero', 'jl audio', 'kicker', 'rockford', 'rockford fosgate',
    'hertz audio', 'hertz m', 'hertz mille', 'focal audio', 'morel', 'audison', 'memphis audio',
    'alpine type', 'alpine s-', 'alpine r-', 'pioneer ts', 'kenwood ksc', 'jbl club', 'jbl gx', 'jbl stage',
  ],
  'Window Tint': [
    'window tint', ' tint ', 'tinted', 'tinting', 'insulfilm', 'pelicula', 'película',
    'pelicula automotiva', 'suntek', 'suntek carbon', 'suntek standart', 'suntek standard',
    'sunteck', 'llumar', 'ceramic pro', 'formula one', 'xpel', ' carbon ',
    '3m tint', 'window film', 'tonalizar vidro', 'escurecer vidro', 'ceramic tint',
    'ceramic film', 'shade', 'tint shade', 'vlt', 'darken windows',
  ],
  'Backup Camera': [
    'backup cam', 'backup camera', 'reverse camera', 'reverse cam', 'camera de re', 'câmera de ré',
    'camera de ré', 'camera traseira', 'rear camera', 'rearview camera', 'rear-view camera',
    'rear view camera', 'reversing camera',
  ],
  'Dashcam': [
    'dashcam', 'dash cam', 'dash-cam', 'camera de bordo', 'câmera de bordo', 'camera veicular',
    'camera frontal', 'front cam', 'thinkware', 'blackvue', 'viofo', 'nextbase',
  ],
  'Ambient Light': [
    'ambient light', 'ambient lights', 'ambient lighting', 'luz ambiente', 'iluminação ambiente',
    'iluminacao ambiente', 'luzes internas led', 'interior led', 'interior light', 'interior lighting',
    'interior lights', 'custom lighting', 'footwell light', 'door light', 'door lights',
    'mood lighting', 'rgb interior',
  ],
  'LED Lights': [
    'led light', 'led lights', 'led headlight', 'led headlights', 'farol led', 'farois led',
    'faróis led', 'lampada led', 'lâmpada led', 'kit led', 'led bulb', 'led bulbs',
    'fog light', 'fog lights', 'underglow',
  ],
  'Key Programming': [
    'key copy', 'key programming', 'car key', 'copia de chave', 'cópia de chave',
    'programar chave', 'chave codificada', 'chave canivete', 'chave reserva',
    'spare key', 'key fob', 'fob programming', 'transponder key',
  ],
  'Labor': [
    ' labor ', 'mão de obra', 'mao de obra', 'instalação', 'instalacao', 'serviço de instalação',
    'install only', 'just install', 'installation cost', 'how much is install', 'install price',
    'price for the install', 'price for install', 'cost to install',
  ],
};

/**
 * Detecta produtos mencionados em um texto. Retorna nomes canônicos.
 * Faz padding com espaços para os gatilhos com fronteira (' som ', ' sub ') casarem nas pontas.
 */
export function detectProducts(text: string): string[] {
  if (!text) return [];
  const lower = ` ${text.toLowerCase()} `;
  const matched = new Set<string>();
  for (const [product, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.add(product);
    }
  }
  return Array.from(matched);
}
