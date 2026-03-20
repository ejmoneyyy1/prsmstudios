export type CaseRoute =
  | 'city-pulse'
  | 'brand-reframing'
  | 'experience-engineering'
  | 'cloud-native-scale';

export type CaseId = 'city-pulse' | 'brand-reframing' | 'experience-engineering' | 'cloud-native-scale';

export type Case = {
  id: CaseId;
  indexLabel: string; // "01".."04"
  title: string;
  route: `/${CaseRoute}`;
  hoverImage: string; // path in public/
  summary: string;
};

export const cases: Case[] = [
  {
    id: 'city-pulse',
    indexLabel: '01',
    title: 'City Pulse',
    route: '/city-pulse',
    hoverImage: '/case-images/city-pulse-hover.svg',
    summary:
      'A flagship presence concept where your product feels alive in the world it serves.',
  },
  {
    id: 'brand-reframing',
    indexLabel: '02',
    title: 'Brand Reframing',
    route: '/brand-reframing',
    hoverImage: '/case-images/brand-reframing-hover.svg',
    summary:
      'Narrative positioning + identity systems that clarify value and convert attention into trust.',
  },
  {
    id: 'experience-engineering',
    indexLabel: '03',
    title: 'Experience Engineering',
    route: '/experience-engineering',
    hoverImage: '/case-images/experience-engineering-hover.svg',
    summary:
      'Conversion-focused UI architecture and motion systems built for performance under pressure.',
  },
  {
    id: 'cloud-native-scale',
    indexLabel: '04',
    title: 'Cloud-Native Scale',
    route: '/cloud-native-scale',
    hoverImage: '/case-images/cloud-native-scale-hover.svg',
    summary:
      'AWS-backed infrastructure strategy for reliability, velocity, and long-term growth.',
  },
];

export function getCaseById(id: CaseId) {
  return cases.find((c) => c.id === id) ?? null;
}

