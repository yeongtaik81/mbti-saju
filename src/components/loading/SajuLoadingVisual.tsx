'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Handshake,
  Heart,
  HeartCrack,
  House,
  MessageCircleMore,
  SendHorizontal,
  Sparkles,
  Star,
  Users
} from 'lucide-react';
import { useTheme } from 'next-themes';
import type {
  ReadingMode,
  ScenarioLoadingIllustration,
  ScenarioLoadingIcon,
  ScenarioLoadingMotion,
  ScenarioLoadingTheme
} from '@/lib/saju/scenarios';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<ScenarioLoadingIcon, LucideIcon> = {
  sparkles: Sparkles,
  calendar: CalendarDays,
  heart: Heart,
  clock: Clock3,
  heartCrack: HeartCrack,
  message: MessageCircleMore,
  send: SendHorizontal,
  briefcase: BriefcaseBusiness,
  banknote: Banknote,
  users: Users,
  house: House,
  star: Star,
  handshake: Handshake
};

const THEME_ICON_COLOR: Record<ScenarioLoadingTheme, string> = {
  timing: 'text-stone-700',
  love: 'text-rose-700',
  career: 'text-amber-700',
  wealth: 'text-emerald-700',
  relationship: 'text-sky-700',
  friend: 'text-sky-700',
  work: 'text-amber-700',
  family: 'text-violet-700',
  idol: 'text-fuchsia-700'
};

const ORBIT_DOT_CLASS: Record<ScenarioLoadingTheme, string> = {
  timing: 'bg-stone-500',
  love: 'bg-rose-500',
  career: 'bg-amber-500',
  wealth: 'bg-emerald-500',
  relationship: 'bg-sky-500',
  friend: 'bg-sky-500',
  work: 'bg-amber-500',
  family: 'bg-violet-500',
  idol: 'bg-fuchsia-500'
};

const ACCENT_TINT_CLASS: Record<ScenarioLoadingTheme, string> = {
  timing: 'bg-stone-200 border-stone-300/80',
  love: 'bg-rose-100 border-rose-200/80',
  career: 'bg-amber-100 border-amber-200/80',
  wealth: 'bg-emerald-100 border-emerald-200/80',
  relationship: 'bg-sky-100 border-sky-200/80',
  friend: 'bg-sky-100 border-sky-200/80',
  work: 'bg-amber-100 border-amber-200/80',
  family: 'bg-violet-100 border-violet-200/80',
  idol: 'bg-fuchsia-100 border-fuchsia-200/80'
};

const DISC_MOTION_CLASS: Record<ScenarioLoadingMotion, string> = {
  gentle: 'animate-saju-breathe',
  pulse: 'animate-saju-breathe-strong',
  drift: 'animate-saju-breathe-soft',
  focus: 'animate-saju-breathe-tight',
  sparkle: 'animate-saju-breathe'
};

const ORBIT_MOTION_CLASS: Record<ScenarioLoadingMotion, string> = {
  gentle: 'animate-saju-orbit',
  pulse: 'animate-saju-orbit-fast',
  drift: 'animate-saju-orbit-slow',
  focus: 'animate-saju-orbit-tight',
  sparkle: 'animate-saju-orbit-fast'
};

const ICON_MOTION_CLASS: Record<ScenarioLoadingMotion, string> = {
  gentle: 'animate-saju-float',
  pulse: 'animate-saju-pulse',
  drift: 'animate-saju-drift',
  focus: 'animate-saju-focus',
  sparkle: 'animate-saju-twinkle'
};

type VisualVariant = 'simple' | 'folk';

type Props = {
  theme: ScenarioLoadingTheme;
  icon: ScenarioLoadingIcon;
  mode: ReadingMode;
  motion?: ScenarioLoadingMotion;
  illustration?: ScenarioLoadingIllustration;
  variant?: VisualVariant;
};

type FolkSceneKind = 'swing' | 'couple' | 'scholar' | 'family';
type UiThemeKind = 'default' | 'spring';
type RomanceIllustrationKind = ScenarioLoadingIllustration;

function getFolkSceneKind(
  theme: ScenarioLoadingTheme,
  mode: ReadingMode
): FolkSceneKind {
  if (mode === 'COMPATIBILITY') {
    if (theme === 'work') {
      return 'scholar';
    }
    if (theme === 'family') {
      return 'family';
    }
    return 'couple';
  }

  if (theme === 'career' || theme === 'wealth') {
    return 'scholar';
  }
  if (theme === 'relationship' || theme === 'family' || theme === 'friend') {
    return 'family';
  }
  return 'swing';
}

function FolkScene({
  scene,
  icon,
  theme,
  uiTheme
}: {
  scene: FolkSceneKind;
  icon: ScenarioLoadingIcon;
  theme: ScenarioLoadingTheme;
  uiTheme: UiThemeKind;
}) {
  const Icon = ICON_MAP[icon];
  const isSpring = uiTheme === 'spring';
  const paperBg = isSpring ? '#fff1f0' : '#f6ede0';
  const paperBorder = isSpring ? '#ecc8c3' : '#d5c2a9';
  const lineMain = isSpring ? '#b88c86' : '#786050';
  const lineSoft = isSpring ? '#cfaaa2' : '#a18772';
  const badgeBg = isSpring ? '#fff8f6' : '#fff9ef';
  const badgeText = isSpring ? '#9f6d67' : '#5f4a3d';
  const peopleA = isSpring ? '#f0b6a5' : '#d9a88d';
  const peopleB = isSpring ? '#f4c5b5' : '#d8b49c';
  const clothA = isSpring ? '#d98c84' : '#9d7263';
  const clothB = isSpring ? '#edb2a2' : '#c98f73';
  const clothC = isSpring ? '#d7b3c6' : '#8e675c';
  const clothD = isSpring ? '#f1caa0' : '#b7856e';
  const blossomFill = isSpring ? '#f5c6d3' : '#d9c8bb';
  const springPetals =
    scene === 'couple'
      ? [
          {
            cls: '-left-3 top-5',
            color: '#f4c6d2',
            rotate: '-18deg',
            delay: '0s',
            size: 'h-5 w-3'
          },
          {
            cls: 'left-8 top-2',
            color: '#f8d6df',
            rotate: '24deg',
            delay: '0.6s',
            size: 'h-4 w-2.5'
          },
          {
            cls: '-right-2 top-10',
            color: '#f2c1cf',
            rotate: '16deg',
            delay: '1.1s',
            size: 'h-5 w-3'
          },
          {
            cls: 'right-12 bottom-3',
            color: '#f8d3dd',
            rotate: '-20deg',
            delay: '1.8s',
            size: 'h-4 w-2.5'
          },
          {
            cls: 'right-8 top-1',
            color: '#f7ccd8',
            rotate: '12deg',
            delay: '0.9s',
            size: 'h-3.5 w-2.5'
          },
          {
            cls: 'left-14 bottom-2',
            color: '#f6c8d6',
            rotate: '-14deg',
            delay: '1.4s',
            size: 'h-3.5 w-2.5'
          }
        ]
      : scene === 'family'
        ? [
            {
              cls: '-left-2 top-7',
              color: '#f4c8d3',
              rotate: '-15deg',
              delay: '0s',
              size: 'h-4.5 w-3'
            },
            {
              cls: 'left-10 top-1',
              color: '#f8d9e1',
              rotate: '18deg',
              delay: '0.5s',
              size: 'h-4 w-2.5'
            },
            {
              cls: '-right-2 top-12',
              color: '#f3c6d4',
              rotate: '12deg',
              delay: '1.1s',
              size: 'h-4.5 w-3'
            },
            {
              cls: 'right-10 bottom-2',
              color: '#f7d2dc',
              rotate: '-16deg',
              delay: '1.7s',
              size: 'h-4 w-2.5'
            },
            {
              cls: 'left-20 bottom-1',
              color: '#f6ccd8',
              rotate: '10deg',
              delay: '1.2s',
              size: 'h-3.5 w-2.5'
            }
          ]
        : scene === 'scholar'
          ? [
              {
                cls: '-left-2 top-9',
                color: '#f4c6d2',
                rotate: '-14deg',
                delay: '0s',
                size: 'h-4 w-2.5'
              },
              {
                cls: 'right-10 top-2',
                color: '#f7d0da',
                rotate: '16deg',
                delay: '0.8s',
                size: 'h-3.5 w-2.5'
              },
              {
                cls: 'right-14 bottom-3',
                color: '#f8d9e1',
                rotate: '-18deg',
                delay: '1.6s',
                size: 'h-3.5 w-2.5'
              }
            ]
          : [
              {
                cls: '-left-3 top-5',
                color: '#f4c6d2',
                rotate: '-18deg',
                delay: '0s',
                size: 'h-5 w-3'
              },
              {
                cls: 'left-8 top-2',
                color: '#f8d6df',
                rotate: '24deg',
                delay: '0.6s',
                size: 'h-4 w-2.5'
              },
              {
                cls: '-right-2 top-10',
                color: '#f2c1cf',
                rotate: '16deg',
                delay: '1.1s',
                size: 'h-5 w-3'
              },
              {
                cls: 'right-12 bottom-3',
                color: '#f8d3dd',
                rotate: '-20deg',
                delay: '1.8s',
                size: 'h-4 w-2.5'
              }
            ];

  return (
    <div
      className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] shadow-[0_18px_45px_rgba(69,46,31,0.10)]"
      style={{ border: `1px solid ${paperBorder}`, background: paperBg }}
    >
      {isSpring ? (
        <>
          {springPetals.map((petal, index) => (
            <span
              key={`${petal.cls}-${index}`}
              className={cn(
                'pointer-events-none absolute z-20 rounded-[999px_999px_999px_999px/70%_70%_90%_90%] opacity-80 shadow-[0_6px_18px_rgba(217,143,164,0.22)] animate-saju-drift scale-[0.88] sm:scale-100 sm:opacity-90',
                petal.cls,
                petal.size
              )}
              style={{
                backgroundColor: petal.color,
                transform: `rotate(${petal.rotate})`,
                animationDelay: petal.delay
              }}
            />
          ))}
        </>
      ) : null}

      <div
        className="absolute inset-0 opacity-85"
        style={{
          background: isSpring
            ? 'radial-gradient(circle at 18% 12%, rgba(227,159,160,0.12), transparent 20%), radial-gradient(circle at 82% 18%, rgba(241,184,171,0.12), transparent 16%), radial-gradient(circle at 72% 82%, rgba(245,202,214,0.14), transparent 16%), repeating-linear-gradient(90deg, rgba(157,116,106,0.014) 0 1px, transparent 1px 22px), repeating-linear-gradient(0deg, rgba(157,116,106,0.014) 0 1px, transparent 1px 18px)'
            : 'radial-gradient(circle_at_18%_12%,rgba(123,89,64,0.07),transparent_18%),radial-gradient(circle_at_82%_18%,rgba(123,89,64,0.06),transparent_14%),repeating-linear-gradient(90deg,rgba(104,77,56,0.018)_0_1px,transparent_1px_22px),repeating-linear-gradient(0deg,rgba(104,77,56,0.015)_0_1px,transparent_1px_18px)'
        }}
      />
      <div
        className="absolute inset-[10px] rounded-[1.4rem]"
        style={{
          border: `1px solid ${isSpring ? 'rgba(226, 178, 171, 0.32)' : 'rgba(120, 96, 80, 0.18)'}`
        }}
      />

      <div className="relative aspect-[16/10] w-full">
        <svg
          viewBox="0 0 360 220"
          className="h-full w-full"
          aria-hidden="true"
          fill="none"
        >
          <path
            d="M20 196C82 185 150 182 210 186C269 190 315 192 340 188"
            strokeWidth="2.6"
            strokeLinecap="round"
            stroke={lineMain}
            opacity="0.72"
          />

          {isSpring ? (
            <>
              <g className="animate-saju-drift">
                <path
                  d="M68 32c4-8 16-8 20 0c-4 8-16 8-20 0Z"
                  fill={blossomFill}
                  opacity="0.95"
                />
                <path
                  d="M84 22c8 4 8 16 0 20c-8-4-8-16 0-20Z"
                  fill={blossomFill}
                  opacity="0.9"
                />
                <circle cx="84" cy="32" r="3.2" fill="#e596a8" />
              </g>
              <g className="animate-saju-folk-breathe-soft">
                <path
                  d="M284 26c4-7 14-7 18 0c-4 7-14 7-18 0Z"
                  fill={blossomFill}
                  opacity="0.92"
                />
                <path
                  d="M298 18c7 4 7 14 0 18c-7-4-7-14 0-18Z"
                  fill={blossomFill}
                  opacity="0.88"
                />
                <circle cx="298" cy="26" r="3" fill="#e7a4b5" />
              </g>
              <circle
                cx="120"
                cy="44"
                r="2.4"
                fill="#f5c6d3"
                className="animate-saju-drift"
              />
              <circle
                cx="236"
                cy="52"
                r="2.2"
                fill="#f1b8c3"
                className="animate-saju-drift"
              />
            </>
          ) : null}

          {scene === 'swing' ? (
            <>
              <path
                d="M260 44C268 66 282 86 300 112"
                strokeWidth="5"
                strokeLinecap="round"
                stroke={lineMain}
                opacity="0.82"
              />
              <path
                d="M283 28C258 50 243 74 232 102"
                strokeWidth="6"
                strokeLinecap="round"
                stroke={lineMain}
                opacity="0.76"
              />
              <g className="animate-saju-folk-swing-origin">
                <path
                  d="M236 36L196 106"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  stroke={lineSoft}
                />
                <path
                  d="M266 42L222 106"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  stroke={lineSoft}
                />
                <g className="animate-saju-folk-swing">
                  <path
                    d="M192 106H228"
                    strokeWidth="3"
                    strokeLinecap="round"
                    stroke={lineMain}
                    opacity="0.84"
                  />
                  <circle cx="210" cy="94" r="10" fill={peopleA} />
                  <path d="M198 108C203 118 217 118 222 108" fill={clothA} />
                </g>
              </g>

              <g className="animate-saju-folk-breathe-soft">
                <circle cx="76" cy="132" r="10" fill={peopleA} />
                <path d="M64 144C72 160 84 160 88 144" fill={clothC} />
                <circle cx="118" cy="150" r="9" fill={peopleB} />
                <path d="M106 160C113 174 124 174 128 160" fill={clothD} />
                <circle
                  cx="152"
                  cy="136"
                  r="8"
                  fill={isSpring ? '#efbaa6' : '#d3a790'}
                />
                <path d="M143 146C149 160 159 160 163 146" fill={clothB} />
              </g>
            </>
          ) : null}

          {scene === 'couple' ? (
            <>
              <path
                d="M64 100C82 88 104 82 128 82"
                strokeWidth="2"
                strokeLinecap="round"
                stroke={lineSoft}
                opacity="0.8"
              />
              <circle
                cx="88"
                cy="48"
                r="16"
                fill={
                  isSpring
                    ? 'rgba(241, 195, 210, 0.42)'
                    : 'rgba(214, 205, 191, 0.42)'
                }
                className="animate-saju-folk-breathe-soft"
              />
              <path
                d="M50 148C68 112 88 88 112 70"
                strokeWidth="5"
                strokeLinecap="round"
                stroke={lineMain}
                opacity="0.78"
              />
              <path
                d="M44 64H92"
                strokeWidth="3"
                strokeLinecap="round"
                stroke={lineSoft}
                opacity="0.72"
              />
              <g className="animate-saju-folk-couple">
                <circle cx="218" cy="118" r="10" fill={peopleA} />
                <path
                  d="M206 132C214 154 224 154 230 132"
                  fill={isSpring ? '#d8b0c7' : '#89a4a1'}
                />
                <circle cx="252" cy="116" r="10" fill={peopleB} />
                <path
                  d="M240 130C248 153 258 153 264 130"
                  fill={isSpring ? '#f0cdb1' : '#d4c1a5'}
                />
                <path
                  d="M225 136C232 130 240 128 246 130"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  stroke={lineMain}
                  opacity="0.6"
                />
              </g>
            </>
          ) : null}

          {scene === 'scholar' ? (
            <>
              <g className="animate-saju-folk-breathe-soft">
                <circle cx="192" cy="76" r="11" fill={peopleB} />
                <path d="M178 90C187 116 201 116 206 90" fill={clothC} />
                <path
                  d="M150 102H235"
                  stroke={lineMain}
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.78"
                />
                <path
                  d="M160 102V132M224 102V132"
                  stroke={lineMain}
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.66"
                />
                <path
                  d="M172 94L198 88L210 98L184 104Z"
                  fill={isSpring ? '#f8e6dc' : '#e8dcc9'}
                />
                <circle cx="108" cy="148" r="9" fill={peopleA} />
                <path d="M96 160C104 176 115 176 119 160" fill={clothA} />
                <circle cx="274" cy="146" r="9" fill={peopleB} />
                <path d="M262 158C270 174 282 174 286 158" fill={clothD} />
              </g>
            </>
          ) : null}

          {scene === 'family' ? (
            <>
              <path
                d="M266 56C250 74 238 96 232 122"
                strokeWidth="5"
                strokeLinecap="round"
                stroke={lineMain}
                opacity="0.76"
              />
              <path
                d="M296 44C282 72 272 94 266 116"
                strokeWidth="4"
                strokeLinecap="round"
                stroke={lineMain}
                opacity="0.64"
              />
              <g className="animate-saju-folk-breathe-soft">
                <circle cx="112" cy="146" r="10" fill={peopleA} />
                <path d="M99 160C108 178 120 178 124 160" fill={clothA} />
                <circle cx="148" cy="132" r="10" fill={peopleB} />
                <path d="M136 146C144 166 154 166 160 146" fill={clothB} />
                <circle cx="188" cy="152" r="9" fill={peopleB} />
                <path d="M178 164C184 178 194 178 198 164" fill={clothC} />
                <circle
                  cx="226"
                  cy="140"
                  r="8"
                  fill={isSpring ? '#ebb9a3' : '#d8ad93'}
                />
                <path d="M217 150C223 164 231 164 235 150" fill={clothD} />
              </g>
            </>
          ) : null}
        </svg>

        <div
          className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full px-3 py-1 shadow-sm backdrop-blur-sm"
          style={{
            border: `1px solid ${isSpring ? 'rgba(236, 200, 195, 0.9)' : 'rgba(213, 194, 169, 0.9)'}`,
            background: badgeBg,
            color: badgeText
          }}
        >
          <Icon className={cn('size-4', THEME_ICON_COLOR[theme])} />
          <span className="text-xs font-medium">운을 읽는 중</span>
        </div>
      </div>
    </div>
  );
}

function RomanceScene({
  illustration,
  uiTheme
}: {
  illustration: RomanceIllustrationKind;
  uiTheme: UiThemeKind;
}) {
  const isSpring = uiTheme === 'spring';
  const panelBg = '#f4edf2';
  const panelBorder = '#d8c6cf';
  const skyTop = '#55648d';
  const skyBottom = '#806f8c';
  const moon = '#f5d465';
  const star = '#f7dfc0';
  const branch = '#5a484a';
  const blossomA = '#ecc2cb';
  const blossomB = '#f4d7de';
  const path = '#d0c1c2';
  const lamp = '#f4cca1';
  const glow = 'rgba(244, 204, 161, 0.28)';
  const shirt = '#ece8e1';
  const jeans = '#6d7d9f';
  const skirt = '#d6ba77';
  const hair = '#2f2832';
  const skinA = '#e5b7a1';
  const skinB = '#ebc3af';
  const petalCount =
    illustration === 'romance-ghosted'
      ? 28
      : illustration === 'romance-left-on-read'
        ? 34
        : 42;

  const petals = Array.from({ length: petalCount }, (_, index) => {
    const x = 28 + ((index * 29) % 304);
    const y = 18 + ((index * 17) % 168);
    const rotate = ((index * 23) % 40) - 20;
    const size = 3 + (index % 3);
    return { x, y, rotate, size, fill: index % 2 === 0 ? blossomA : blossomB };
  });

  return (
    <div
      className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] shadow-[0_20px_48px_rgba(43,33,52,0.16)]"
      style={{ border: `1px solid ${panelBorder}`, background: panelBg }}
    >
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(101,72,84,0.09) 0 1px, transparent 1px 16px), repeating-linear-gradient(90deg, rgba(101,72,84,0.08) 0 1px, transparent 1px 22px)'
        }}
      />
      <div className="relative aspect-[5/7] w-full">
        {isSpring ? <SpringRomanceOverlay illustration={illustration} /> : null}
        <svg
          viewBox="0 0 360 500"
          className="h-full w-full"
          aria-hidden="true"
          fill="none"
        >
          <defs>
            <linearGradient
              id="romance-sky"
              x1="180"
              y1="20"
              x2="180"
              y2="500"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor={skyTop} />
              <stop offset="1" stopColor={skyBottom} />
            </linearGradient>
            <radialGradient
              id="moon-glow"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(264 112) rotate(90) scale(54)"
            >
              <stop stopColor={moon} stopOpacity="0.95" />
              <stop offset="1" stopColor={moon} stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="360" height="500" fill="url(#romance-sky)" />
          <rect
            x="0"
            y="0"
            width="360"
            height="500"
            fill="rgba(255,255,255,0.06)"
          />
          <rect x="0" y="0" width="360" height="500" fill="url(#moon-glow)" />

          <circle cx="266" cy="120" r="30" fill={moon} opacity="0.95" />
          <g opacity="0.88">
            <circle cx="96" cy="78" r="3.2" fill={star} />
            <circle cx="138" cy="56" r="2.4" fill={star} />
            <circle cx="214" cy="72" r="2.8" fill={star} />
            <circle cx="290" cy="58" r="2.4" fill={star} />
            <path d="M70 122l6 6-6 6-6-6 6-6Z" fill={star} />
            <path d="M232 94l5 5-5 5-5-5 5-5Z" fill={star} />
            <path d="M178 132l4 4-4 4-4-4 4-4Z" fill={star} />
            <path
              d="M238 42l18 9"
              stroke={star}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M208 168l14 7"
              stroke={star}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>

          <path
            d="M0 344C66 316 118 318 180 332C241 346 291 374 360 402V500H0V344Z"
            fill={path}
          />
          <path
            d="M48 384C96 360 140 358 188 372C238 386 286 414 332 452"
            stroke="rgba(247,236,228,0.48)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {[0, 1, 2, 3].map((lampIndex) => {
            const lx = 300 + lampIndex * 18;
            const ly = 286 + lampIndex * 28;
            return (
              <g key={lampIndex} opacity={0.82 - lampIndex * 0.1}>
                <path
                  d={`M${lx} ${ly}V${ly + 56}`}
                  stroke="#5d4e53"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx={lx} cy={ly} r="6" fill={lamp} />
                <circle cx={lx} cy={ly} r="14" fill={glow} />
              </g>
            );
          })}

          <path
            d="M0 124C42 130 76 162 118 228"
            stroke={branch}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M0 168C48 170 92 204 136 276"
            stroke={branch}
            strokeWidth="5.5"
            strokeLinecap="round"
            opacity="0.86"
          />
          <path
            d="M360 138C316 146 280 180 238 248"
            stroke={branch}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M360 196C320 200 284 232 248 290"
            stroke={branch}
            strokeWidth="5.5"
            strokeLinecap="round"
            opacity="0.84"
          />

          {petals.map((petal, index) => (
            <g key={`${petal.x}-${petal.y}-${index}`} opacity={0.88}>
              <ellipse
                cx={petal.x}
                cy={petal.y}
                rx={petal.size}
                ry={petal.size * 0.75}
                transform={`rotate(${petal.rotate} ${petal.x} ${petal.y})`}
                fill={petal.fill}
              />
            </g>
          ))}

          <g className="animate-saju-folk-breathe-soft">
            {illustration === 'romance-flirting' ? (
              <>
                <circle cx="168" cy="356" r="14" fill={skinA} />
                <path
                  d="M154 372C158 420 160 456 164 474"
                  stroke={shirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M176 372C178 414 184 448 188 472"
                  stroke={shirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M162 436C164 458 166 480 168 492"
                  stroke={jeans}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M182 436C184 458 186 480 188 492"
                  stroke={jeans}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M156 350C160 338 174 338 180 350"
                  stroke={hair}
                  strokeWidth="12"
                  strokeLinecap="round"
                />

                <circle cx="212" cy="360" r="13" fill={skinB} />
                <path
                  d="M198 374C200 418 202 452 204 474"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M218 374C220 420 222 454 224 474"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M206 430C210 454 214 476 216 492"
                  stroke={skirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M218 430C222 454 226 476 228 492"
                  stroke={skirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M202 350C210 334 222 336 226 350"
                  stroke={hair}
                  strokeWidth="11"
                  strokeLinecap="round"
                />
                <path
                  d="M178 392C186 388 194 388 202 392"
                  stroke="rgba(255,240,232,0.6)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </>
            ) : null}

            {illustration === 'romance-ex' ? (
              <>
                <circle cx="146" cy="360" r="14" fill={skinA} />
                <path
                  d="M132 374C134 420 138 452 142 474"
                  stroke={shirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M154 374C156 416 160 450 164 474"
                  stroke={shirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M140 436C142 458 144 480 146 492"
                  stroke={jeans}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M160 436C162 458 164 480 166 492"
                  stroke={jeans}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M136 350C140 338 154 338 160 350"
                  stroke={hair}
                  strokeWidth="12"
                  strokeLinecap="round"
                />

                <circle cx="236" cy="360" r="13" fill={skinB} />
                <path
                  d="M222 374C224 418 226 452 228 474"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M242 374C244 420 246 454 248 474"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M230 430C234 454 238 476 240 492"
                  stroke={skirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M242 430C246 454 250 476 252 492"
                  stroke={skirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M226 350C234 334 246 336 250 350"
                  stroke={hair}
                  strokeWidth="11"
                  strokeLinecap="round"
                />
                <path
                  d="M180 388C190 374 202 370 214 374"
                  stroke="rgba(255,210,216,0.62)"
                  strokeWidth="2.4"
                  strokeDasharray="4 8"
                  strokeLinecap="round"
                />
              </>
            ) : null}

            {illustration === 'romance-crush' ? (
              <>
                <circle cx="132" cy="386" r="13" fill={skinB} />
                <path
                  d="M120 400C124 438 126 466 128 488"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M140 400C144 438 146 466 148 488"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M126 448C130 468 132 486 134 496"
                  stroke={skirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M138 448C142 468 144 486 146 496"
                  stroke={skirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M122 378C128 364 140 364 144 378"
                  stroke={hair}
                  strokeWidth="10"
                  strokeLinecap="round"
                />

                <circle cx="228" cy="338" r="11" fill={skinA} opacity="0.88" />
                <path
                  d="M216 350C220 392 222 424 224 446"
                  stroke={shirt}
                  strokeWidth="15"
                  strokeLinecap="round"
                  opacity="0.88"
                />
                <path
                  d="M234 350C238 390 242 422 246 446"
                  stroke={shirt}
                  strokeWidth="15"
                  strokeLinecap="round"
                  opacity="0.88"
                />
                <path
                  d="M222 398C224 420 226 438 228 454"
                  stroke={jeans}
                  strokeWidth="16"
                  strokeLinecap="round"
                  opacity="0.88"
                />
                <path
                  d="M240 398C242 420 244 438 246 454"
                  stroke={jeans}
                  strokeWidth="16"
                  strokeLinecap="round"
                  opacity="0.88"
                />
                <path
                  d="M220 330C224 320 236 320 240 330"
                  stroke={hair}
                  strokeWidth="10"
                  strokeLinecap="round"
                  opacity="0.88"
                />
              </>
            ) : null}

            {illustration === 'romance-blind-date' ? (
              <>
                <ellipse
                  cx="182"
                  cy="404"
                  rx="48"
                  ry="18"
                  fill="rgba(214, 205, 191, 0.42)"
                />
                <ellipse
                  cx="182"
                  cy="346"
                  rx="42"
                  ry="12"
                  fill="rgba(255,244,232,0.92)"
                />
                <path
                  d="M182 346V392"
                  stroke="#6f5e66"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle cx="148" cy="330" r="12" fill={skinA} />
                <path
                  d="M136 344C138 370 140 394 142 414"
                  stroke={shirt}
                  strokeWidth="15"
                  strokeLinecap="round"
                />
                <path
                  d="M156 344C158 372 160 396 162 414"
                  stroke={shirt}
                  strokeWidth="15"
                  strokeLinecap="round"
                />
                <path
                  d="M142 392C144 410 146 426 148 438"
                  stroke={jeans}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M160 392C162 410 164 426 166 438"
                  stroke={jeans}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M140 322C146 310 158 310 162 322"
                  stroke={hair}
                  strokeWidth="10"
                  strokeLinecap="round"
                />

                <circle cx="216" cy="332" r="12" fill={skinB} />
                <path
                  d="M204 346C206 372 208 396 210 416"
                  stroke={shirt}
                  strokeWidth="15"
                  strokeLinecap="round"
                />
                <path
                  d="M224 346C226 374 228 398 230 416"
                  stroke={shirt}
                  strokeWidth="15"
                  strokeLinecap="round"
                />
                <path
                  d="M210 394C214 414 216 430 218 440"
                  stroke={skirt}
                  strokeWidth="17"
                  strokeLinecap="round"
                />
                <path
                  d="M222 394C226 414 228 430 230 440"
                  stroke={skirt}
                  strokeWidth="17"
                  strokeLinecap="round"
                />
                <path
                  d="M206 324C214 310 226 312 230 324"
                  stroke={hair}
                  strokeWidth="10"
                  strokeLinecap="round"
                />
              </>
            ) : null}

            {illustration === 'romance-friends-to-lovers' ? (
              <>
                <path
                  d="M124 402C154 394 206 394 238 402"
                  stroke="rgba(255,243,231,0.74)"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <circle cx="170" cy="354" r="13" fill={skinA} />
                <path
                  d="M156 368C160 410 164 448 166 474"
                  stroke={shirt}
                  strokeWidth="17"
                  strokeLinecap="round"
                />
                <path
                  d="M176 368C180 408 184 446 186 474"
                  stroke={shirt}
                  strokeWidth="17"
                  strokeLinecap="round"
                />
                <path
                  d="M166 420C168 444 170 470 172 492"
                  stroke={jeans}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M184 420C186 444 188 470 190 492"
                  stroke={jeans}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M160 344C166 332 178 332 182 344"
                  stroke={hair}
                  strokeWidth="11"
                  strokeLinecap="round"
                />

                <circle cx="208" cy="356" r="13" fill={skinB} />
                <path
                  d="M194 370C198 410 200 446 202 474"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M214 370C218 410 220 446 222 474"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M202 420C206 444 210 470 212 492"
                  stroke={skirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M214 420C218 444 222 470 224 492"
                  stroke={skirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M198 346C204 332 216 334 220 346"
                  stroke={hair}
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <path
                  d="M187 388C192 384 198 384 204 388"
                  stroke="rgba(255,240,232,0.62)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </>
            ) : null}

            {illustration === 'romance-ghosted' ? (
              <>
                <circle cx="212" cy="364" r="13" fill={skinB} />
                <path
                  d="M198 378C200 420 202 452 204 476"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M218 378C220 420 222 452 224 476"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M206 430C210 456 214 478 216 492"
                  stroke={skirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M218 430C222 456 226 478 228 492"
                  stroke={skirt}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M202 354C208 340 220 340 224 354"
                  stroke={hair}
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <rect
                  x="224"
                  y="394"
                  width="12"
                  height="18"
                  rx="3"
                  fill="rgba(255,242,236,0.95)"
                />

                <circle cx="126" cy="356" r="11" fill={skinA} opacity="0.32" />
                <path
                  d="M114 370C118 408 120 434 122 454"
                  stroke={shirt}
                  strokeWidth="14"
                  strokeLinecap="round"
                  opacity="0.28"
                />
                <path
                  d="M132 370C136 408 140 434 142 454"
                  stroke={shirt}
                  strokeWidth="14"
                  strokeLinecap="round"
                  opacity="0.28"
                />
                <path
                  d="M120 414C122 432 124 446 126 456"
                  stroke={jeans}
                  strokeWidth="15"
                  strokeLinecap="round"
                  opacity="0.28"
                />
                <path
                  d="M138 414C140 432 142 446 144 456"
                  stroke={jeans}
                  strokeWidth="15"
                  strokeLinecap="round"
                  opacity="0.28"
                />
              </>
            ) : null}

            {illustration === 'romance-left-on-read' ? (
              <>
                <circle cx="198" cy="362" r="13" fill={skinA} />
                <path
                  d="M184 376C188 420 190 454 192 476"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M204 376C208 420 210 454 212 476"
                  stroke={shirt}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M192 430C194 456 198 478 200 492"
                  stroke={jeans}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M204 430C206 456 210 478 212 492"
                  stroke={jeans}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M188 350C194 338 206 338 210 350"
                  stroke={hair}
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <rect
                  x="214"
                  y="392"
                  width="14"
                  height="20"
                  rx="3"
                  fill="rgba(255,242,236,0.96)"
                />
                <path
                  d="M246 334C260 330 272 330 284 338"
                  stroke="rgba(255,233,227,0.62)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M250 356H282"
                  stroke="rgba(255,233,227,0.54)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </>
            ) : null}
          </g>
        </svg>

        <div className="absolute left-4 top-4 rounded-full border border-white/25 bg-black/10 px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-white/90 backdrop-blur-sm">
          연애 궁합을 읽는 중
        </div>
      </div>
    </div>
  );
}

function SpringRomanceOverlay({
  illustration
}: {
  illustration: RomanceIllustrationKind;
}) {
  const petalCount =
    illustration === 'romance-left-on-read'
      ? 16
      : illustration === 'romance-ghosted'
        ? 14
        : illustration === 'romance-ex'
          ? 18
          : 22;

  const petals = Array.from({ length: petalCount }, (_, index) => {
    const x = 12 + ((index * 31) % 332);
    const y = 14 + ((index * 27) % 448);
    const size = 4 + (index % 3);
    const rotate = ((index * 29) % 52) - 26;
    const delay = `${(index % 7) * 0.28}s`;
    const opacity = 0.32 + (index % 4) * 0.09;
    return { x, y, size, rotate, delay, opacity };
  });

  return (
    <>
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255, 203, 220, 0.14) 0%, rgba(255, 229, 234, 0.06) 45%, rgba(255, 244, 247, 0.02) 100%)'
        }}
      />
      <div
        className="absolute left-0 top-0 z-[1] h-48 w-44 opacity-85"
        style={{
          background:
            'radial-gradient(circle at 18% 18%, rgba(255, 222, 231, 0.9) 0 16%, rgba(248, 192, 212, 0.58) 16% 30%, transparent 31%), radial-gradient(circle at 42% 14%, rgba(255, 214, 225, 0.85) 0 12%, rgba(247, 184, 205, 0.52) 12% 24%, transparent 25%), radial-gradient(circle at 30% 34%, rgba(255, 221, 229, 0.9) 0 14%, rgba(247, 190, 208, 0.54) 14% 28%, transparent 29%)'
        }}
      />
      <div
        className="absolute bottom-0 right-0 z-[1] h-44 w-40 opacity-80"
        style={{
          background:
            'radial-gradient(circle at 72% 70%, rgba(255, 220, 228, 0.88) 0 15%, rgba(247, 190, 210, 0.5) 15% 29%, transparent 30%), radial-gradient(circle at 48% 82%, rgba(255, 226, 233, 0.88) 0 13%, rgba(248, 196, 214, 0.48) 13% 26%, transparent 27%)'
        }}
      />
      <div
        className="absolute right-12 top-12 z-[1] h-24 w-24 rounded-full blur-2xl"
        style={{ background: 'rgba(255, 226, 189, 0.16)' }}
      />
      <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
        {petals.map((petal, index) => (
          <span
            key={`${petal.x}-${petal.y}-${index}`}
            className="absolute animate-saju-drift rounded-full"
            style={{
              left: `${petal.x}px`,
              top: `${petal.y}px`,
              width: `${petal.size * 1.45}px`,
              height: `${petal.size}px`,
              transform: `rotate(${petal.rotate}deg)`,
              background:
                index % 2 === 0
                  ? 'linear-gradient(135deg, rgba(255, 226, 234, 0.95), rgba(244, 187, 208, 0.86))'
                  : 'linear-gradient(135deg, rgba(255, 237, 242, 0.92), rgba(249, 201, 218, 0.82))',
              opacity: petal.opacity,
              animationDelay: petal.delay
            }}
          />
        ))}
      </div>
    </>
  );
}

function SimpleLoadingVisual({ theme, icon, mode, motion = 'gentle' }: Props) {
  const Icon = ICON_MAP[icon];
  const accentTint = ACCENT_TINT_CLASS[theme];
  const accentDot = ORBIT_DOT_CLASS[theme];

  return (
    <div className="relative flex size-40 items-center justify-center sm:size-44">
      {mode === 'COMPATIBILITY' ? (
        <div
          className={cn(
            'absolute inset-5 translate-x-2 rounded-full opacity-20 blur-[1px]',
            DISC_MOTION_CLASS[motion]
          )}
          style={{
            background:
              'conic-gradient(from 0deg, #22c55e, #ef4444, #f59e0b, #9ca3af, #3b82f6, #22c55e)'
          }}
        />
      ) : null}

      <div className="absolute inset-1 rounded-full border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm" />

      <div className={cn('absolute inset-0', ORBIT_MOTION_CLASS[motion])}>
        <span
          className={cn(
            'absolute left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full shadow-sm',
            accentDot
          )}
        />
        <span
          className={cn(
            'absolute right-1/2 top-1 h-2 w-2 translate-x-1/2 rounded-full opacity-80 shadow-sm',
            accentDot
          )}
        />
        <span
          className={cn(
            'absolute bottom-6 right-2 h-2.5 w-2.5 rounded-full opacity-90 shadow-sm',
            accentDot
          )}
        />
        <span
          className={cn(
            'absolute bottom-2 left-7 h-2 w-2 rounded-full opacity-80 shadow-sm',
            accentDot
          )}
        />
      </div>

      <div
        className={cn(
          'absolute inset-4 rounded-full shadow-inner',
          DISC_MOTION_CLASS[motion]
        )}
        style={{
          background:
            'conic-gradient(from 0deg, #22c55e 0 20%, #ef4444 20% 40%, #f59e0b 40% 60%, #9ca3af 60% 80%, #3b82f6 80% 100%)'
        }}
      />

      <div className="absolute inset-9 rounded-full border border-border/60 bg-card/90 shadow-sm" />

      {icon === 'clock' ? (
        <>
          <span
            className={cn(
              'absolute right-6 top-7 h-6 w-6 rounded-full border shadow-sm',
              accentTint,
              'animate-saju-drift'
            )}
          />
          <span
            className={cn(
              'absolute bottom-8 left-7 h-2.5 w-2.5 rounded-full',
              accentDot,
              'animate-saju-pulse'
            )}
          />
        </>
      ) : null}

      {icon === 'send' ? (
        <>
          <span
            className={cn(
              'absolute right-6 top-10 h-2 w-10 rounded-full',
              accentDot,
              'animate-saju-drift'
            )}
          />
          <span
            className={cn(
              'absolute right-14 top-8 h-2.5 w-2.5 rounded-full',
              accentDot,
              'animate-saju-pulse'
            )}
          />
        </>
      ) : null}

      {icon === 'heart' || icon === 'heartCrack' ? (
        <>
          <span
            className={cn(
              'absolute left-8 top-8 h-4 w-4 rotate-12 rounded-md border shadow-sm',
              accentTint,
              'animate-saju-pulse'
            )}
          />
          <span
            className={cn(
              'absolute bottom-10 right-8 h-3 w-3 rounded-full',
              accentDot,
              'animate-saju-drift'
            )}
          />
        </>
      ) : null}

      {icon === 'briefcase' || icon === 'handshake' ? (
        <>
          <span
            className={cn(
              'absolute left-6 top-8 h-7 w-10 rounded-lg border shadow-sm',
              accentTint,
              'animate-saju-focus'
            )}
          />
          <span
            className={cn(
              'absolute bottom-8 right-8 h-2.5 w-8 rounded-full',
              accentDot,
              'animate-saju-breathe-soft'
            )}
          />
        </>
      ) : null}

      {icon === 'banknote' ? (
        <>
          <span
            className={cn(
              'absolute left-7 top-8 h-6 w-11 rounded-md border shadow-sm',
              accentTint,
              'animate-saju-breathe-soft'
            )}
          />
          <span
            className={cn(
              'absolute bottom-9 right-7 h-6 w-11 rounded-md border shadow-sm',
              accentTint,
              'animate-saju-drift'
            )}
          />
        </>
      ) : null}

      {icon === 'calendar' ? (
        <>
          <span
            className={cn(
              'absolute right-7 top-7 h-7 w-8 rounded-md border shadow-sm',
              accentTint,
              'animate-saju-drift'
            )}
          />
          <span
            className={cn(
              'absolute bottom-8 left-8 h-2.5 w-2.5 rounded-full',
              accentDot,
              'animate-saju-pulse'
            )}
          />
        </>
      ) : null}

      {icon === 'star' || icon === 'sparkles' ? (
        <>
          <span
            className={cn(
              'absolute left-8 top-8 h-2.5 w-2.5 rounded-full',
              accentDot,
              'animate-saju-twinkle'
            )}
          />
          <span
            className={cn(
              'absolute bottom-9 right-8 h-3.5 w-3.5 rounded-full',
              accentDot,
              'animate-saju-twinkle'
            )}
          />
        </>
      ) : null}

      <div
        className={cn(
          'relative z-10 flex size-16 items-center justify-center rounded-full border border-border/60 bg-card shadow-sm',
          ICON_MOTION_CLASS[motion]
        )}
      >
        <Icon className={cn('size-7', THEME_ICON_COLOR[theme])} />
      </div>
    </div>
  );
}

export function SajuLoadingVisual({
  theme,
  icon,
  mode,
  motion = 'gentle',
  illustration,
  variant = 'simple'
}: Props) {
  const { resolvedTheme } = useTheme();
  const uiTheme: UiThemeKind =
    resolvedTheme === 'spring' ? 'spring' : 'default';

  if (variant === 'folk') {
    if (illustration?.startsWith('romance-')) {
      return <RomanceScene illustration={illustration} uiTheme={uiTheme} />;
    }

    return (
      <FolkScene
        scene={getFolkSceneKind(theme, mode)}
        icon={icon}
        theme={theme}
        uiTheme={uiTheme}
      />
    );
  }

  return (
    <SimpleLoadingVisual
      theme={theme}
      icon={icon}
      mode={mode}
      motion={motion}
      variant={variant}
    />
  );
}
