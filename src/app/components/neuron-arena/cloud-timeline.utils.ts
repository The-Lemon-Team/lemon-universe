import { ArenaAccentColor, CloudDayNote, CloudItemType } from '../../core/models/flow.models';

export type CloudDayVibeId = 'CHRONO_DAYFLOW' | 'COZY_CHILL' | 'SYNTHWAVE' | 'NATURE_ZEN' | 'PIXELART_URBAN';

export interface CloudDayVibe {
  id: CloudDayVibeId;
  name: string;
  icon: string;
  badge: string;
  description: string;
  skyGradient: string;
  stageBorderClass: string;
  atmosphereEmoji: string[];
}

export interface TimelineCluster {
  id: string;
  timeMinutes: number;
  time: string;
  timeSpanLabel?: string;
  notes: CloudDayNote[];
  isCluster: boolean;
}

export const CLOUD_CLUSTER_GAP_MINUTES = 30;

export const CLOUD_HOUR_MILESTONES = [
  { label: '08:00', icon: '🌅', minutes: 480 },
  { label: '10:00', icon: '☕', minutes: 600 },
  { label: '12:00', icon: '☀️', minutes: 720 },
  { label: '14:00', icon: '🍕', minutes: 840 },
  { label: '16:00', icon: '💡', minutes: 960 },
  { label: '18:00', icon: '🌆', minutes: 1080 },
  { label: '20:00', icon: '🎮', minutes: 1200 },
  { label: '22:00', icon: '🌙', minutes: 1320 },
  { label: '24:00', icon: '💤', minutes: 1440 },
];

export const CLOUD_DAY_VIBES: CloudDayVibe[] = [
  {
    id: 'CHRONO_DAYFLOW',
    name: 'Хроно-День (Рассвет → Ночь)',
    icon: '🌅',
    badge: 'Живой Градиент',
    description:
      'Плавный суточный переход от утренней зари через полуденное солнце к закату и ночному небу с пунктирными меридианами.',
    skyGradient:
      'bg-gradient-to-r from-amber-100/60 via-sky-100/40 via-purple-100/45 to-indigo-900/25 dark:from-amber-950/30 dark:via-sky-950/20 dark:via-purple-950/35 dark:to-slate-950/80',
    stageBorderClass: 'border-amber-300/60 dark:border-amber-400/30',
    atmosphereEmoji: ['🌅', '☀️', '🌆', '🌙'],
  },
  {
    id: 'COZY_CHILL',
    name: 'Пятничный Чилл & Уют',
    icon: '🛋️',
    badge: 'Тёплый вечер',
    description: 'Пастельные кофейные и персиковые тона, атмосфера пледа, горячего чая и дружеских посиделок.',
    skyGradient:
      'bg-gradient-to-r from-orange-100/70 via-rose-100/50 via-amber-100/60 to-purple-200/40 dark:from-amber-950/40 dark:via-rose-950/30 dark:to-purple-950/40',
    stageBorderClass: 'border-rose-300/60 dark:border-rose-400/30',
    atmosphereEmoji: ['☕', '🕯️', '🍕', '🛋️'],
  },
  {
    id: 'SYNTHWAVE',
    name: 'Неоновый Космос & Синтвейв',
    icon: '🌌',
    badge: 'Cyber Party',
    description: 'Глубокий неоновый космос, фиолетовые закатные градиенты и синтвейв-вайб под треки DJ Pixel.',
    skyGradient:
      'bg-gradient-to-r from-indigo-200/50 via-purple-200/60 via-pink-200/40 to-slate-900/60 dark:from-[#0f1123] dark:via-[#1c1236] dark:via-[#2b1040] dark:to-[#0a0c1a]',
    stageBorderClass: 'border-purple-400/60 dark:border-purple-500/40',
    atmosphereEmoji: ['🕹️', '✨', '🎧', '🪐'],
  },
  {
    id: 'NATURE_ZEN',
    name: 'Горный Дзен & Свежесть',
    icon: '🌲',
    badge: 'Эко-Баланс',
    description: 'Свежие бирюзовые и изумрудные тона утреннего леса, чистый воздух и кристальная ясность мыслей.',
    skyGradient:
      'bg-gradient-to-r from-emerald-100/60 via-teal-100/50 via-cyan-100/45 to-sky-200/50 dark:from-emerald-950/35 dark:via-teal-950/25 dark:to-cyan-950/40',
    stageBorderClass: 'border-emerald-300/60 dark:border-emerald-400/30',
    atmosphereEmoji: ['🍃', '☀️', '🌲', '✨'],
  },
  {
    id: 'PIXELART_URBAN',
    name: 'Городской пиксельарт (Pixel Urban)',
    icon: '🌆',
    badge: '16-bit Retro',
    description:
      'Ретро-палитра 16-bit города: неоновые закатные сумерки, индиго и золотистые пиксельные отблески мегаполиса.',
    skyGradient:
      'bg-gradient-to-r from-amber-200/55 via-fuchsia-200/40 via-indigo-300/45 to-slate-900/65 dark:from-[#1b122c] dark:via-[#261545] dark:via-[#192248] dark:to-[#0a0d1c]',
    stageBorderClass: 'border-fuchsia-400/60 dark:border-fuchsia-500/40',
    atmosphereEmoji: ['👾', '🏙️', '🌇', '🌃'],
  },
];

export type CloudLandscapeId =
  | 'URBAN_MINIMAL'
  | 'MOUNTAIN_PEAKS'
  | 'COASTAL_HARBOR'
  | 'CYBER_METROPOLIS'
  | 'COZY_VALLEY'
  | 'PIXELART_URBAN'
  | 'NONE';

export interface CloudLandscapeLightSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  tone?: 'warm' | 'cyan' | 'rose';
}

export interface CloudLandscapeOption {
  id: CloudLandscapeId;
  name: string;
  shortName: string;
  icon: string;
  badge: string;
  description: string;
  /** Distant horizon silhouette SVG path in viewBox 0 0 1200 140 */
  backLayerPath: string;
  /** Optional mid-ground silhouette SVG path in viewBox 0 0 1200 140 */
  midLayerPath?: string;
  /** Foreground main architectural/natural silhouette SVG path in viewBox 0 0 1200 140 */
  frontLayerPath: string;
  /** Optional stroke accent path (bridge cables, spires, snow ridges, sails, monorail) */
  accentStrokePath?: string;
  /** Optional filled accent path (snow caps, sailboat sails, roofs) */
  accentFillPath?: string;
  /** Minimalist glowing windows / beacons in viewBox 0 0 1200 140 */
  lights: CloudLandscapeLightSpec[];
}

export const DEFAULT_CLOUD_LANDSCAPE_ID: CloudLandscapeId = 'URBAN_MINIMAL';

export const CLOUD_LANDSCAPES: CloudLandscapeOption[] = [
  {
    id: 'URBAN_MINIMAL',
    name: 'Городской минимализм',
    shortName: 'Город',
    icon: '🏙️',
    badge: 'Силуэт города',
    description:
      'Чистый геометрический силуэт современного города на горизонте: минималистичные башни, телебашня, арочный мост и мягкие огни окон.',
    backLayerPath:
      'M 0 140 L 0 98 L 42 98 L 42 74 L 88 74 L 88 92 L 135 92 L 135 58 L 190 58 L 190 86 L 245 86 L 245 64 L 295 64 L 295 96 L 360 96 L 360 70 L 420 70 L 420 48 L 475 48 L 475 88 L 535 88 L 535 106 L 665 106 L 665 76 L 720 76 L 720 52 L 780 52 L 780 84 L 840 84 L 840 62 L 905 62 L 905 90 L 960 90 L 960 44 L 1020 44 L 1020 80 L 1085 80 L 1085 66 L 1145 66 L 1145 94 L 1200 94 L 1200 140 Z',
    midLayerPath:
      'M 0 140 L 0 104 L 55 104 L 55 82 L 118 82 L 118 102 L 175 102 L 175 74 L 225 74 L 225 104 L 340 104 L 340 68 L 390 68 L 390 104 L 450 104 L 450 62 L 495 62 L 495 104 L 620 104 L 620 70 L 675 70 L 675 104 L 810 104 L 810 74 L 870 74 L 870 104 L 940 104 L 940 58 L 995 58 L 995 104 L 1050 104 L 1050 72 L 1110 72 L 1110 104 L 1200 104 L 1200 140 Z',
    frontLayerPath:
      'M 0 140 L 0 114 L 28 114 L 28 88 L 74 88 L 74 110 L 105 110 L 105 68 L 158 68 L 158 106 L 182 106 L 182 78 L 232 78 L 232 114 L 268 114 L 268 54 L 284 42 L 300 54 L 300 112 L 318 112 L 318 62 L 325 62 L 325 22 L 329 22 L 329 62 L 336 62 L 336 112 L 374 112 L 374 76 L 434 76 L 434 108 L 462 108 L 462 84 L 504 84 L 504 116 L 520 116 L 520 88 L 528 88 L 528 116 Q 590 92 652 116 L 652 88 L 660 88 L 660 116 L 685 116 L 685 72 L 742 72 L 742 108 L 768 108 L 768 58 L 822 58 L 822 108 L 854 108 L 854 64 L 912 46 L 912 110 L 944 110 L 944 74 L 998 74 L 998 106 L 1028 106 L 1028 56 L 1082 56 L 1082 112 L 1114 112 L 1114 82 L 1164 82 L 1164 110 L 1200 110 L 1200 140 Z',
    accentStrokePath:
      'M 524 90 Q 590 122 656 90 M 528 116 Q 590 78 652 116 M 558 103 V 115 M 590 97 V 115 M 622 103 V 115 M 319 52 H 335 M 795 36 V 58 M 1055 38 V 56',
    lights: [
      { id: 'u-1', x: 116, y: 78, width: 6, height: 10, rx: 1, tone: 'warm' },
      { id: 'u-2', x: 128, y: 78, width: 6, height: 10, rx: 1, tone: 'warm' },
      { id: 'u-3', x: 140, y: 92, width: 6, height: 10, rx: 1, tone: 'warm' },
      { id: 'u-4', x: 278, y: 62, width: 12, height: 4, rx: 1, tone: 'cyan' },
      { id: 'u-5', x: 278, y: 72, width: 12, height: 4, rx: 1, tone: 'warm' },
      { id: 'u-6', x: 324, y: 18, width: 6, height: 6, rx: 3, tone: 'rose' },
      { id: 'u-7', x: 388, y: 86, width: 8, height: 12, rx: 1, tone: 'warm' },
      { id: 'u-8', x: 404, y: 86, width: 8, height: 12, rx: 1, tone: 'warm' },
      { id: 'u-9', x: 700, y: 82, width: 7, height: 12, rx: 1, tone: 'warm' },
      { id: 'u-10', x: 716, y: 82, width: 7, height: 12, rx: 1, tone: 'cyan' },
      { id: 'u-11', x: 780, y: 68, width: 8, height: 14, rx: 1, tone: 'warm' },
      { id: 'u-12', x: 796, y: 68, width: 8, height: 14, rx: 1, tone: 'warm' },
      { id: 'u-13', x: 780, y: 88, width: 8, height: 12, rx: 1, tone: 'cyan' },
      { id: 'u-14', x: 870, y: 68, width: 18, height: 4, rx: 1, tone: 'warm' },
      { id: 'u-15', x: 870, y: 78, width: 18, height: 4, rx: 1, tone: 'warm' },
      { id: 'u-16', x: 870, y: 88, width: 18, height: 4, rx: 1, tone: 'cyan' },
      { id: 'u-17', x: 958, y: 84, width: 7, height: 12, rx: 1, tone: 'warm' },
      { id: 'u-18', x: 974, y: 84, width: 7, height: 12, rx: 1, tone: 'warm' },
      { id: 'u-19', x: 1042, y: 68, width: 8, height: 14, rx: 1, tone: 'warm' },
      { id: 'u-20', x: 1058, y: 68, width: 8, height: 14, rx: 1, tone: 'warm' },
      { id: 'u-21', x: 1042, y: 88, width: 8, height: 12, rx: 1, tone: 'cyan' },
      { id: 'u-22', x: 1130, y: 92, width: 10, height: 10, rx: 1, tone: 'warm' },
    ],
  },
  {
    id: 'MOUNTAIN_PEAKS',
    name: 'Горная гряда & Сосны',
    shortName: 'Горы',
    icon: '🏔️',
    badge: 'Nordic Zen',
    description:
      'Многослойные минималистичные вершины горного хребта на горизонте, геометрические снежные пики и силуэты хвойного леса.',
    backLayerPath:
      'M 0 140 L 0 96 L 95 52 L 185 88 L 310 34 L 430 84 L 545 46 L 670 92 L 790 38 L 915 82 L 1040 42 L 1140 78 L 1200 64 L 1200 140 Z',
    midLayerPath:
      'M 0 140 L 0 106 L 130 68 L 250 102 L 385 56 L 510 100 L 625 66 L 745 104 L 875 58 L 995 98 L 1110 64 L 1200 94 L 1200 140 Z',
    frontLayerPath:
      'M 0 140 L 0 112 L 65 74 L 140 108 L 235 58 L 345 112 L 455 62 L 560 110 L 645 78 L 740 112 L 855 54 L 965 108 L 1075 68 L 1160 106 L 1200 92 L 1200 140 Z',
    accentFillPath:
      'M 310 34 L 342 56 L 314 50 L 296 58 L 282 52 Z M 790 38 L 820 58 L 794 52 L 776 60 L 762 54 Z M 235 58 L 262 76 L 238 70 L 214 78 Z M 855 54 L 884 74 L 858 68 L 832 76 Z',
    accentStrokePath:
      'M 310 34 L 328 84 M 790 38 L 808 86 M 235 58 L 248 96 M 855 54 L 870 94',
    lights: [
      { id: 'm-1', x: 152, y: 108, width: 8, height: 6, rx: 1, tone: 'warm' },
      { id: 'm-2', x: 568, y: 108, width: 10, height: 6, rx: 1, tone: 'warm' },
      { id: 'm-3', x: 748, y: 110, width: 8, height: 6, rx: 1, tone: 'warm' },
      { id: 'm-4', x: 974, y: 106, width: 10, height: 6, rx: 1, tone: 'warm' },
    ],
  },
  {
    id: 'COASTAL_HARBOR',
    name: 'Морской берег & Маяк',
    shortName: 'Маяк',
    icon: '🌊',
    badge: 'Sea Horizon',
    description:
      'Спокойная береговая линия с маяком на мысе, минималистичными парусами на воде и плавными морскими волнами.',
    backLayerPath:
      'M 0 140 L 0 88 Q 110 66 230 94 Q 330 112 450 110 Q 760 106 1200 110 L 1200 140 Z',
    midLayerPath:
      'M 0 140 L 0 98 Q 95 82 210 104 Q 390 118 590 112 Q 820 106 1020 114 Q 1120 118 1200 112 L 1200 140 Z',
    frontLayerPath:
      'M 0 140 L 0 104 Q 70 86 135 92 L 146 92 L 150 42 L 162 42 L 166 92 L 185 95 Q 240 104 290 118 Q 410 112 530 118 Q 650 124 770 118 Q 890 112 1010 118 Q 1110 122 1200 116 L 1200 140 Z',
    accentFillPath:
      'M 148 42 H 164 L 156 30 Z M 480 112 L 480 80 L 502 108 Z M 476 112 L 476 86 L 460 108 Z M 760 112 L 760 74 L 786 106 Z M 756 112 L 756 82 L 738 106 Z M 1010 112 L 1010 84 L 1030 108 Z',
    accentStrokePath:
      'M 164 38 L 310 18 M 164 38 L 310 54 M 340 124 Q 400 118 460 124 M 620 126 Q 685 120 750 126 M 900 124 Q 960 118 1020 124',
    lights: [
      { id: 'c-1', x: 152, y: 34, width: 8, height: 8, rx: 4, tone: 'warm' },
      { id: 'c-2', x: 153, y: 56, width: 6, height: 8, rx: 1, tone: 'warm' },
      { id: 'c-3', x: 153, y: 72, width: 6, height: 8, rx: 1, tone: 'warm' },
      { id: 'c-4', x: 86, y: 96, width: 10, height: 6, rx: 1, tone: 'warm' },
      { id: 'c-5', x: 104, y: 98, width: 8, height: 6, rx: 1, tone: 'warm' },
    ],
  },
  {
    id: 'CYBER_METROPOLIS',
    name: 'Неоновый мегаполис',
    shortName: 'Кибер-Сити',
    icon: '🌃',
    badge: 'Cyber Horizon',
    description:
      'Футуристичный силуэт смарт-сити с куполами технопарков, линией монорельса, скошенными небоскрёбами и неоновыми маяками.',
    backLayerPath:
      'M 0 140 L 0 92 L 60 92 L 85 54 L 145 54 L 145 88 L 210 88 A 55 55 0 0 1 320 88 L 380 88 L 380 42 L 450 28 L 450 86 L 540 86 L 565 50 L 635 50 L 660 86 L 730 86 A 48 48 0 0 1 826 86 L 890 86 L 890 36 L 960 52 L 960 88 L 1040 88 L 1065 48 L 1135 48 L 1135 92 L 1200 92 L 1200 140 Z',
    midLayerPath:
      'M 0 140 L 0 104 L 110 104 L 110 68 L 175 68 L 175 102 L 310 102 L 310 62 L 365 62 L 365 102 L 510 102 L 510 64 L 580 64 L 580 104 L 780 104 L 780 58 L 845 58 L 845 104 L 1060 104 L 1060 66 L 1125 66 L 1125 104 L 1200 104 L 1200 140 Z',
    frontLayerPath:
      'M 0 140 L 0 108 L 45 108 L 45 72 L 95 58 L 95 108 L 160 108 L 160 64 L 215 64 L 215 110 L 340 110 L 340 52 L 395 36 L 395 110 L 480 110 L 480 68 L 545 68 L 545 110 L 675 110 L 675 44 L 710 28 L 745 44 L 745 110 L 840 110 L 840 62 L 905 62 L 905 110 L 985 110 L 985 54 L 1045 40 L 1045 110 L 1120 110 L 1120 74 L 1175 74 L 1175 110 L 1200 110 L 1200 140 Z',
    accentStrokePath:
      'M 0 98 H 1200 M 115 28 V 54 M 368 16 V 40 M 710 10 V 28 M 1015 18 V 42',
    lights: [
      { id: 'cy-1', x: 64, y: 70, width: 4, height: 28, rx: 1, tone: 'cyan' },
      { id: 'cy-2', x: 176, y: 74, width: 22, height: 4, rx: 1, tone: 'rose' },
      { id: 'cy-3', x: 176, y: 84, width: 22, height: 4, rx: 1, tone: 'cyan' },
      { id: 'cy-4', x: 362, y: 52, width: 4, height: 42, rx: 1, tone: 'cyan' },
      { id: 'cy-5', x: 374, y: 58, width: 4, height: 36, rx: 1, tone: 'rose' },
      { id: 'cy-6', x: 500, y: 78, width: 24, height: 4, rx: 1, tone: 'cyan' },
      { id: 'cy-7', x: 706, y: 42, width: 8, height: 52, rx: 2, tone: 'rose' },
      { id: 'cy-8', x: 860, y: 74, width: 24, height: 4, rx: 1, tone: 'cyan' },
      { id: 'cy-9', x: 860, y: 84, width: 24, height: 4, rx: 1, tone: 'warm' },
      { id: 'cy-10', x: 1008, y: 56, width: 4, height: 40, rx: 1, tone: 'cyan' },
      { id: 'cy-11', x: 1020, y: 62, width: 4, height: 34, rx: 1, tone: 'rose' },
      { id: 'cy-12', x: 580, y: 95, width: 44, height: 3, rx: 1.5, tone: 'warm' },
    ],
  },
  {
    id: 'COZY_VALLEY',
    name: 'Уютная долина & Холмы',
    shortName: 'Долина',
    icon: '🏡',
    badge: 'Pastoral',
    description:
      'Плавные минималистичные холмы, силуэты маленьких домиков с тёплыми окнами, ветряная мельница и кипарисы.',
    backLayerPath:
      'M 0 140 L 0 96 Q 150 58 320 88 Q 490 116 660 78 Q 830 42 1010 82 Q 1115 104 1200 86 L 1200 140 Z',
    midLayerPath:
      'M 0 140 L 0 106 Q 210 82 410 102 Q 610 120 810 92 Q 1010 66 1200 98 L 1200 140 Z',
    frontLayerPath:
      'M 0 140 L 0 112 Q 90 94 175 104 L 175 86 L 198 70 L 221 86 L 221 106 Q 360 118 510 102 L 510 84 L 535 66 L 560 84 L 560 100 Q 635 94 700 96 L 706 58 L 722 58 L 728 96 Q 805 100 885 106 L 885 88 L 908 72 L 931 88 L 931 106 Q 1065 114 1200 100 L 1200 140 Z',
    accentStrokePath:
      'M 690 36 L 738 84 M 738 36 L 690 84',
    lights: [
      { id: 'v-1', x: 190, y: 88, width: 7, height: 7, rx: 1, tone: 'warm' },
      { id: 'v-2', x: 201, y: 88, width: 7, height: 7, rx: 1, tone: 'warm' },
      { id: 'v-3', x: 526, y: 86, width: 8, height: 8, rx: 1, tone: 'warm' },
      { id: 'v-4', x: 538, y: 86, width: 8, height: 8, rx: 1, tone: 'warm' },
      { id: 'v-5', x: 711, y: 68, width: 6, height: 8, rx: 1, tone: 'warm' },
      { id: 'v-6', x: 900, y: 90, width: 7, height: 7, rx: 1, tone: 'warm' },
      { id: 'v-7', x: 911, y: 90, width: 7, height: 7, rx: 1, tone: 'warm' },
    ],
  },
  {
    id: 'PIXELART_URBAN',
    name: 'Городской пиксельарт',
    shortName: 'Пиксель-Сити',
    icon: '🏙️',
    badge: 'Pixelart Urban',
    description:
      'Ретро-город в пиксельном оформлении: ступенчатые блочные небоскрёбы, ретро-антенны, монорельс, светящиеся пиксельные окна и неоновые вывески.',
    backLayerPath:
      'M 0 140 L 0 94 H 48 V 78 H 72 V 62 H 96 V 82 H 116 V 68 H 124 V 46 H 132 V 46 H 140 V 68 H 160 V 86 H 180 V 74 H 204 V 58 H 220 V 88 H 240 V 70 H 252 V 54 H 260 V 38 H 270 V 38 H 278 V 54 H 290 V 70 H 310 V 90 H 336 V 76 H 356 V 64 H 380 V 84 H 400 V 58 H 416 V 46 H 424 V 58 H 440 V 46 H 448 V 58 H 460 V 88 H 484 V 74 H 512 V 58 H 524 V 48 H 540 V 92 H 568 V 70 H 576 V 42 H 584 V 70 H 624 V 70 H 632 V 42 H 640 V 70 H 660 V 90 H 680 V 66 H 692 V 48 H 704 V 34 H 712 V 34 H 724 V 48 H 736 V 66 H 750 V 86 H 772 V 72 H 788 V 54 H 796 V 40 H 804 V 54 H 820 V 72 H 830 V 88 H 850 V 68 H 868 V 50 H 888 V 50 H 898 V 68 H 910 V 86 H 930 V 70 H 942 V 52 H 950 V 36 H 956 V 36 H 964 V 52 H 976 V 70 H 990 V 88 H 1014 V 72 H 1038 V 56 H 1060 V 72 H 1080 V 84 H 1104 V 68 H 1124 V 50 H 1136 V 50 H 1150 V 78 H 1176 V 86 H 1200 V 86 L 1200 140 Z',
    midLayerPath:
      'M 0 140 L 0 102 H 32 V 86 H 60 V 102 H 84 V 80 H 92 V 70 H 104 V 70 H 108 V 80 H 116 V 80 H 130 V 104 H 150 V 88 H 164 V 74 H 190 V 74 H 198 V 88 H 210 V 102 H 230 V 84 H 244 V 66 H 272 V 66 H 280 V 84 H 290 V 104 H 312 V 88 H 324 V 76 H 350 V 76 H 360 V 88 H 370 V 102 H 390 V 82 H 406 V 68 H 430 V 68 H 442 V 82 H 450 V 104 H 474 V 90 H 482 V 82 H 494 V 82 H 500 V 90 H 514 V 90 H 530 V 106 H 554 V 94 H 570 V 80 H 596 V 80 H 608 V 94 H 620 V 106 H 640 V 86 H 654 V 70 H 682 V 70 H 696 V 86 H 710 V 102 H 730 V 80 H 746 V 64 H 770 V 64 H 782 V 80 H 790 V 104 H 810 V 84 H 826 V 68 H 852 V 68 H 862 V 84 H 870 V 102 H 892 V 88 H 902 V 78 H 914 V 78 H 920 V 88 H 934 V 88 H 950 V 104 H 970 V 82 H 986 V 66 H 1010 V 66 H 1022 V 82 H 1030 V 102 H 1050 V 86 H 1066 V 72 H 1092 V 72 H 1102 V 86 H 1110 V 104 H 1134 V 90 H 1160 V 78 H 1184 V 90 H 1200 V 90 L 1200 140 Z',
    frontLayerPath:
      'M 0 140 L 0 114 H 28 V 98 H 52 V 98 H 70 V 114 H 90 V 104 H 96 V 92 H 118 V 92 H 124 V 104 H 140 V 114 H 160 V 100 H 172 V 84 H 180 V 78 H 192 V 78 H 198 V 84 H 208 V 100 H 220 V 116 H 240 V 102 H 250 V 88 H 280 V 88 H 290 V 102 H 310 V 114 H 330 V 104 H 340 V 92 H 368 V 92 H 378 V 104 H 390 V 114 H 410 V 98 H 422 V 82 H 430 V 72 H 436 V 72 H 442 V 82 H 454 V 98 H 470 V 116 H 490 V 106 H 500 V 96 H 530 V 96 H 540 V 106 H 550 V 114 H 568 V 100 H 574 V 86 H 582 V 86 H 588 V 100 H 620 V 100 H 626 V 86 H 634 V 86 H 640 V 100 H 650 V 114 H 670 V 102 H 682 V 88 H 710 V 88 H 720 V 102 H 730 V 114 H 750 V 100 H 760 V 84 H 788 V 84 H 798 V 100 H 810 V 116 H 830 V 104 H 842 V 90 H 870 V 90 H 880 V 104 H 890 V 114 H 910 V 102 H 920 V 86 H 948 V 86 H 958 V 102 H 970 V 114 H 990 V 98 H 1002 V 82 H 1028 V 82 H 1038 V 98 H 1050 V 116 H 1070 V 104 H 1080 V 92 H 1110 V 92 H 1120 V 104 H 1130 V 114 H 1150 V 100 H 1170 V 88 H 1190 V 100 H 1200 V 114 L 1200 140 Z',
    accentStrokePath:
      'M 0 106 H 1200 M 0 109 H 1200 M 128 46 V 26 M 124 34 H 132 M 126 30 H 130 M 265 38 V 16 M 260 26 H 270 M 262 22 H 268 M 433 72 V 54 M 429 62 H 437 M 580 42 L 568 70 M 580 42 L 604 70 M 632 42 L 608 70 M 632 42 L 644 70 M 708 34 V 14 M 702 24 H 714 M 704 20 H 712 M 758 64 V 42 M 758 46 H 796 M 758 42 L 788 46 M 758 46 H 742 M 742 46 V 52 M 953 36 V 18 M 948 28 H 958 M 950 24 H 956',
    accentFillPath:
      'M 1084 16 H 1096 V 18 H 1100 V 22 H 1104 V 30 H 1100 V 34 H 1096 V 36 H 1084 V 34 H 1080 V 30 H 1076 V 22 H 1080 V 18 H 1084 V 16 Z M 1090 18 H 1086 V 20 H 1082 V 28 H 1086 V 32 H 1090 V 34 H 1094 V 30 H 1092 V 22 H 1094 V 20 H 1090 V 18 Z M 248 54 H 252 V 56 H 254 V 58 H 256 V 60 H 254 V 62 H 250 V 64 H 248 V 62 H 244 V 60 H 246 V 58 H 248 V 56 Z M 838 52 H 846 V 54 H 848 V 60 H 846 V 62 H 838 V 60 H 836 V 54 H 838 V 52 Z M 841 50 H 843 V 52 H 841 Z',
    lights: [
      { id: 'px-b1', x: 126, y: 24, width: 4, height: 4, rx: 0, tone: 'rose' },
      { id: 'px-b2', x: 263, y: 14, width: 4, height: 4, rx: 0, tone: 'rose' },
      { id: 'px-b3', x: 431, y: 52, width: 4, height: 4, rx: 0, tone: 'cyan' },
      { id: 'px-b4', x: 574, y: 40, width: 4, height: 4, rx: 0, tone: 'rose' },
      { id: 'px-b5', x: 630, y: 40, width: 4, height: 4, rx: 0, tone: 'rose' },
      { id: 'px-b6', x: 706, y: 12, width: 4, height: 4, rx: 0, tone: 'rose' },
      { id: 'px-b7', x: 792, y: 44, width: 4, height: 4, rx: 0, tone: 'cyan' },
      { id: 'px-b8', x: 951, y: 16, width: 4, height: 4, rx: 0, tone: 'rose' },
      { id: 'px-w1', x: 102, y: 94, width: 5, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w2', x: 110, y: 94, width: 5, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w3', x: 102, y: 102, width: 5, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w4', x: 110, y: 102, width: 5, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w5', x: 128, y: 72, width: 5, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w6', x: 136, y: 72, width: 5, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w7', x: 128, y: 80, width: 5, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w8', x: 136, y: 80, width: 5, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w9', x: 176, y: 88, width: 6, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w10', x: 186, y: 88, width: 6, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w11', x: 176, y: 96, width: 6, height: 5, rx: 0, tone: 'rose' },
      { id: 'px-w12', x: 186, y: 96, width: 6, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w13', x: 262, y: 58, width: 6, height: 6, rx: 0, tone: 'cyan' },
      { id: 'px-w14', x: 270, y: 58, width: 6, height: 6, rx: 0, tone: 'cyan' },
      { id: 'px-w15', x: 254, y: 74, width: 6, height: 6, rx: 0, tone: 'warm' },
      { id: 'px-w16', x: 264, y: 74, width: 6, height: 6, rx: 0, tone: 'warm' },
      { id: 'px-w17', x: 274, y: 74, width: 6, height: 6, rx: 0, tone: 'rose' },
      { id: 'px-w18', x: 254, y: 92, width: 6, height: 6, rx: 0, tone: 'warm' },
      { id: 'px-w19', x: 264, y: 92, width: 6, height: 6, rx: 0, tone: 'cyan' },
      { id: 'px-w20', x: 274, y: 92, width: 6, height: 6, rx: 0, tone: 'warm' },
      { id: 'px-w21', x: 344, y: 80, width: 6, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w22', x: 354, y: 80, width: 6, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w23', x: 344, y: 96, width: 6, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w24', x: 354, y: 96, width: 6, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w25', x: 406, y: 64, width: 5, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w26', x: 406, y: 72, width: 5, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w27', x: 442, y: 64, width: 5, height: 5, rx: 0, tone: 'rose' },
      { id: 'px-w28', x: 442, y: 72, width: 5, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w29', x: 506, y: 100, width: 8, height: 4, rx: 0, tone: 'cyan' },
      { id: 'px-w30', x: 518, y: 100, width: 8, height: 4, rx: 0, tone: 'warm' },
      { id: 'px-w31', x: 574, y: 90, width: 5, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w32', x: 626, y: 90, width: 5, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w33', x: 686, y: 74, width: 6, height: 6, rx: 0, tone: 'rose' },
      { id: 'px-w34', x: 696, y: 74, width: 6, height: 6, rx: 0, tone: 'warm' },
      { id: 'px-w35', x: 706, y: 52, width: 6, height: 6, rx: 0, tone: 'cyan' },
      { id: 'px-w36', x: 716, y: 52, width: 6, height: 6, rx: 0, tone: 'rose' },
      { id: 'px-w37', x: 686, y: 92, width: 6, height: 6, rx: 0, tone: 'warm' },
      { id: 'px-w38', x: 706, y: 92, width: 6, height: 6, rx: 0, tone: 'cyan' },
      { id: 'px-w39', x: 764, y: 88, width: 6, height: 5, rx: 0, tone: 'rose' },
      { id: 'px-w40', x: 774, y: 88, width: 6, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w41', x: 784, y: 88, width: 6, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w42', x: 854, y: 72, width: 6, height: 6, rx: 0, tone: 'warm' },
      { id: 'px-w43', x: 864, y: 72, width: 6, height: 6, rx: 0, tone: 'warm' },
      { id: 'px-w44', x: 854, y: 94, width: 6, height: 6, rx: 0, tone: 'cyan' },
      { id: 'px-w45', x: 864, y: 94, width: 6, height: 6, rx: 0, tone: 'warm' },
      { id: 'px-w46', x: 946, y: 58, width: 5, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w47', x: 956, y: 58, width: 5, height: 5, rx: 0, tone: 'rose' },
      { id: 'px-w48', x: 946, y: 76, width: 5, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w49', x: 956, y: 76, width: 5, height: 5, rx: 0, tone: 'cyan' },
      { id: 'px-w50', x: 1014, y: 86, width: 6, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w51', x: 1024, y: 86, width: 6, height: 5, rx: 0, tone: 'rose' },
      { id: 'px-w52', x: 1058, y: 76, width: 6, height: 6, rx: 0, tone: 'warm' },
      { id: 'px-w53', x: 1068, y: 76, width: 6, height: 6, rx: 0, tone: 'cyan' },
      { id: 'px-w54', x: 1084, y: 96, width: 6, height: 5, rx: 0, tone: 'warm' },
      { id: 'px-w55', x: 1094, y: 96, width: 6, height: 5, rx: 0, tone: 'warm' },
    ],
  },
  {
    id: 'NONE',
    name: 'Чистое небо (Без ландшафта)',
    shortName: 'Чистое небо',
    icon: '☁️',
    badge: 'Минимал',
    description:
      'Открытый воздушный горизонт без силуэтов — только суточный градиент неба и погодная атмосфера.',
    backLayerPath: '',
    frontLayerPath: '',
    lights: [],
  },
];

export function getCloudLandscape(id: CloudLandscapeId | string | null | undefined): CloudLandscapeOption {
  return CLOUD_LANDSCAPES.find((item) => item.id === id) ?? CLOUD_LANDSCAPES[0];
}

/** Builds a 30-minute timeline cluster from a non-empty ascending list of notes. */
export function buildTimelineCluster(notes: CloudDayNote[]): TimelineCluster {
  const isCluster = notes.length > 1;
  const first = notes[0];
  const last = notes[notes.length - 1];

  const avgMinutes = Math.round(notes.reduce((acc, n) => acc + n.timeMinutes, 0) / notes.length);

  const timeLabel = !isCluster || first.time === last.time ? first.time : `${first.time}–${last.time}`;

  const timeSpanLabel = isCluster
    ? first.time === last.time
      ? `${first.time} (${notes.length} мыслей в стопке)`
      : `${first.time}–${last.time} (${notes.length} мыслей в стопке)`
    : undefined;

  const id = isCluster
    ? `cluster-${first.id}-${notes.length}-${first.timeMinutes}`
    : first.id;

  return {
    id,
    timeMinutes: avgMinutes,
    time: timeLabel,
    timeSpanLabel,
    notes,
    isCluster,
  };
}

/** Groups notes sorted by timeMinutes ascending into 30-minute clusters. */
export function groupNotesIntoClusters(
  notes: CloudDayNote[],
  gapMinutes: number = CLOUD_CLUSTER_GAP_MINUTES,
): TimelineCluster[] {
  if (notes.length === 0) return [];
  const sorted = [...notes].sort((a, b) => a.timeMinutes - b.timeMinutes);
  const clusters: TimelineCluster[] = [];
  let currentGroup: CloudDayNote[] = [];

  for (const note of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(note);
    } else {
      const clusterStart = currentGroup[0].timeMinutes;
      if (note.timeMinutes - clusterStart <= gapMinutes) {
        currentGroup.push(note);
      } else {
        clusters.push(buildTimelineCluster(currentGroup));
        currentGroup = [note];
      }
    }
  }

  if (currentGroup.length > 0) {
    clusters.push(buildTimelineCluster(currentGroup));
  }

  return clusters;
}

/** Converts minutes (08:00=480 to 24:00=1440) to percentage (6% to 94%). */
export function getTimelinePercent(timeMinutes: number): number {
  const startMins = 480;
  const endMins = 1440;
  const clamped = Math.max(startMins, Math.min(endMins, timeMinutes));
  const pct = ((clamped - startMins) / (endMins - startMins)) * 88 + 6;
  return Math.round(pct * 10) / 10;
}

/** Parses an `HH:MM` string into total minutes from midnight. */
export function parseTimeToMinutes(time: string | null | undefined, fallbackMinutes = 720): number {
  if (!time) return fallbackMinutes;
  const [hh, mm] = time.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return fallbackMinutes;
  return Math.max(0, Math.min(1440, hh * 60 + mm));
}

/**
 * Resolves a click X coordinate inside the 08:00–24:00 timeline span (6%..94% width)
 * into a 15-minute-snapped `HH:MM` timestamp and minute offset.
 */
export function resolveTimelineClickTime(
  clientX: number,
  rect: { left: number; width: number },
): { time: string; timeMinutes: number } | null {
  if (!rect.width || rect.width <= 0) return null;
  const clickX = clientX - rect.left;
  const rawRatio = Math.max(0, Math.min(1, clickX / rect.width));
  const normalized = Math.max(0, Math.min(1, (rawRatio - 0.06) / 0.88));
  const rawMinutes = 480 + normalized * (1440 - 480);
  const snapped = Math.round(rawMinutes / 15) * 15;
  const clamped = Math.max(480, Math.min(23 * 60 + 45, snapped));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return {
    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    timeMinutes: clamped,
  };
}

/** Staggered candlestick stem height across 3 tiers. */
export function getNoteStemHeight(index: number): number {
  return (index % 3) * 105 + 85;
}

export function getAccentStemClasses(accent: ArenaAccentColor): string {
  switch (accent) {
    case 'amber':
      return 'bg-gradient-to-t from-amber-500 via-amber-400 to-amber-300 shadow-amber-500/20';
    case 'emerald':
      return 'bg-gradient-to-t from-emerald-500 via-emerald-400 to-emerald-300 shadow-emerald-500/20';
    case 'indigo':
      return 'bg-gradient-to-t from-indigo-500 via-indigo-400 to-indigo-300 shadow-indigo-500/20';
    case 'rose':
      return 'bg-gradient-to-t from-rose-500 via-rose-400 to-rose-300 shadow-rose-500/20';
    case 'cyan':
      return 'bg-gradient-to-t from-cyan-500 via-cyan-400 to-cyan-300 shadow-cyan-500/20';
    case 'violet':
      return 'bg-gradient-to-t from-violet-500 via-violet-400 to-violet-300 shadow-violet-500/20';
    default:
      return 'bg-amber-400';
  }
}

export function getAccentGlowClasses(accent: ArenaAccentColor): string {
  switch (accent) {
    case 'amber':
      return 'bg-amber-500 ring-amber-400/50';
    case 'emerald':
      return 'bg-emerald-500 ring-emerald-400/50';
    case 'indigo':
      return 'bg-indigo-500 ring-indigo-400/50';
    case 'rose':
      return 'bg-rose-500 ring-rose-400/50';
    case 'cyan':
      return 'bg-cyan-500 ring-cyan-400/50';
    case 'violet':
      return 'bg-violet-500 ring-violet-400/50';
    default:
      return 'bg-amber-500 ring-amber-400/50';
  }
}

export function getClusterPinClasses(isCluster: boolean, accent: ArenaAccentColor): string {
  const base = isCluster
    ? 'w-4 h-4 rounded-full border-2 border-surface ring-4 transition-transform group-hover:scale-125 cursor-pointer pointer-events-auto'
    : 'w-3 h-3 rounded-full border-2 border-surface ring-2 transition-transform group-hover:scale-125 cursor-pointer pointer-events-auto';
  return `${base} ${getAccentGlowClasses(accent)}`;
}

export function getNoteBorderClass(accent: ArenaAccentColor): string {
  switch (accent) {
    case 'amber':
      return 'border-amber-400';
    case 'emerald':
      return 'border-emerald-500';
    case 'indigo':
      return 'border-indigo-400';
    case 'rose':
      return 'border-rose-400';
    case 'cyan':
      return 'border-cyan-400';
    case 'violet':
      return 'border-violet-400';
    default:
      return 'border-amber-300';
  }
}

export function getCloudTypeLabel(type: CloudItemType): string {
  if (type === 'thought') return 'Мысль';
  if (type === 'proposal') return 'Идея';
  return 'Экшен';
}

export function getCloudTypeEmoji(type: CloudItemType): string {
  if (type === 'thought') return '💭';
  if (type === 'proposal') return '💡';
  return '⚡';
}

export type CloudNowIndicatorMode = 'beam' | 'orb';

export interface CelestialOrbState {
  /** 0 (08:00) .. 1 (24:00) */
  progress: number;
  /** Timeline horizontal position in % (6..94) */
  leftPercent: number;
  /** Parabolic sky height in % above road bar (aligned with stretched sky arc) */
  bottomPercent: number;
  /** Exact SVG quadratic Bezier path from off-canvas left edge up to the orb center */
  traveledArcPath: string;
  /** 0 = full sun, 1 = thin crescent moon */
  moonFactor: number;
  sunRaysOpacity: number;
  starsOpacity: number;
  /** SVG mask circle coordinates inside 64x64 viewBox */
  maskCx: number;
  maskCy: number;
  coreColor: string;
  edgeColor: string;
  glowColor: string;
  badgeClasses: string;
  phaseLabel: string;
  phaseEmoji: string;
}

const ORB_ARC_P0 = { x: -50, y: 296 };
const ORB_ARC_P1 = { x: 500, y: -184 };
const ORB_ARC_P2 = { x: 1050, y: 296 };

export const CELESTIAL_ORB_FULL_ARC_PATH = `M ${ORB_ARC_P0.x} ${ORB_ARC_P0.y} Q ${ORB_ARC_P1.x} ${ORB_ARC_P1.y} ${ORB_ARC_P2.x} ${ORB_ARC_P2.y}`;

/**
 * Computes position, Moon↔Sun morphing state, and palette for the Celestial Orb indicator
 * across the 08:00 (480m) — 24:00 (1440m) cloud timeline.
 */
export function getCelestialOrbState(timeMinutes: number): CelestialOrbState {
  const startMins = 480;
  const endMins = 1440;
  const clamped = Math.max(startMins, Math.min(endMins, timeMinutes));
  const progress = (clamped - startMins) / (endMins - startMins);
  const leftPercent = getTimelinePercent(clamped);

  // Map 6%..94% timeline span onto stretched arc u in [0.1..0.9] so ends extend past canvas edges
  const u = (leftPercent * 10 - ORB_ARC_P0.x) / (ORB_ARC_P2.x - ORB_ARC_P0.x);
  const oneMinusU = 1 - u;
  const q0x = oneMinusU * ORB_ARC_P0.x + u * ORB_ARC_P1.x;
  const q0y = oneMinusU * ORB_ARC_P0.y + u * ORB_ARC_P1.y;
  const orbX = Math.round(leftPercent * 10 * 10) / 10;
  const orbY = Math.round((oneMinusU * oneMinusU * ORB_ARC_P0.y + 2 * oneMinusU * u * ORB_ARC_P1.y + u * u * ORB_ARC_P2.y) * 10) / 10;
  const bottomPercent = Math.round(((400 - orbY) / 400) * 100 * 10) / 10;
  const traveledArcPath = `M ${ORB_ARC_P0.x} ${ORB_ARC_P0.y} Q ${Math.round(q0x * 10) / 10} ${Math.round(q0y * 10) / 10} ${orbX} ${orbY}`;

  let moonFactor = 0;
  if (clamped < 570) {
    // 08:00 — 09:30: dawn crescent moon melts into full morning sun
    moonFactor = 0.85 * (1 - (clamped - 480) / 90);
  } else if (clamped >= 1050 && clamped < 1260) {
    // 17:30 — 21:00: sunset sun gradually turns into dusk crescent
    moonFactor = 0.65 * ((clamped - 1050) / 210);
  } else if (clamped >= 1260) {
    // 21:00 — 24:00: night crescent moon
    moonFactor = 0.65 + 0.27 * ((clamped - 1260) / 180);
  }
  moonFactor = Math.round(Math.max(0, Math.min(1, moonFactor)) * 100) / 100;

  const sunRaysOpacity =
    clamped < 540
      ? 0
      : clamped < 720
        ? Math.round(((clamped - 540) / 180) * 100) / 100
        : clamped <= 1020
          ? 1
          : clamped < 1140
            ? Math.round((1 - (clamped - 1020) / 120) * 100) / 100
            : 0;

  const starsOpacity =
    clamped < 1200 ? 0 : Math.round(Math.min(1, (clamped - 1200) / 150) * 100) / 100;

  const shadowSign = clamped < 720 ? 1 : -1;
  const maskDist = 37 - moonFactor * 25;
  const maskCx = Math.round((32 + shadowSign * maskDist * 0.78) * 10) / 10;
  const maskCy = Math.round((32 - maskDist * 0.625) * 10) / 10;

  const base = {
    progress,
    leftPercent,
    bottomPercent,
    traveledArcPath,
    moonFactor,
    sunRaysOpacity,
    starsOpacity,
    maskCx,
    maskCy,
  };

  if (clamped < 570) {
    return {
      ...base,
      coreColor: '#fef3c7',
      edgeColor: '#fdba74',
      glowColor: 'rgba(251, 191, 36, 0.5)',
      badgeClasses: 'bg-amber-200 dark:bg-amber-700 text-amber-950 dark:text-amber-100',
      phaseLabel: 'Рассвет',
      phaseEmoji: '🌅',
    };
  }
  if (clamped < 720) {
    return {
      ...base,
      coreColor: '#fef08a',
      edgeColor: '#f59e0b',
      glowColor: 'rgba(245, 158, 11, 0.55)',
      badgeClasses: 'bg-amber-300 dark:bg-amber-600 text-amber-950 dark:text-amber-100',
      phaseLabel: 'Утреннее солнце',
      phaseEmoji: '🌤️',
    };
  }
  if (clamped < 1020) {
    return {
      ...base,
      coreColor: '#fef9c3',
      edgeColor: '#f97316',
      glowColor: 'rgba(245, 158, 11, 0.65)',
      badgeClasses: 'bg-amber-300 dark:bg-amber-600 text-amber-900 dark:text-amber-100',
      phaseLabel: 'Солнце в зените',
      phaseEmoji: '☀️',
    };
  }
  if (clamped < 1260) {
    return {
      ...base,
      coreColor: '#fed7aa',
      edgeColor: '#e11d48',
      glowColor: 'rgba(244, 63, 94, 0.5)',
      badgeClasses: 'bg-rose-200 dark:bg-rose-800 text-rose-950 dark:text-rose-100',
      phaseLabel: 'Закат',
      phaseEmoji: '🌆',
    };
  }
  return {
    ...base,
    coreColor: '#f8fafc',
    edgeColor: '#818cf8',
    glowColor: 'rgba(129, 140, 248, 0.6)',
    badgeClasses: 'bg-indigo-200 dark:bg-indigo-800 text-indigo-950 dark:text-indigo-100',
    phaseLabel: 'Ночная луна',
    phaseEmoji: '🌙',
  };
}

export function getLikesWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'лайк';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'лайка';
  return 'лайков';
}

