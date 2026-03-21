export type CaseRoute =
  | 'city-pulse'
  | 'brand-reframing'
  | 'experience-engineering'
  | 'audit';

export type CaseId =
  | 'city-pulse'
  | 'brand-reframing'
  | 'experience-engineering'
  | 'venture-consultation';

export type Case = {
  id: CaseId;
  indexLabel: string; // "01".."04"
  title: string;
  route: `/${CaseRoute}`;
  hoverImage: string; // path in public/
  summary: string;
  /** Right-rail label; default "View" */
  actionLabel?: string;
  /** Shorter label for small viewports when actionLabel is long */
  actionLabelShort?: string;
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
    id: 'venture-consultation',
    indexLabel: '04',
    title: 'The Venture Track',
    route: '/audit',
    hoverImage: '/case-images/cloud-native-scale-hover.svg',
    summary:
      'High-stakes ideas deserve end-to-end execution—consultation through deployment, with City Pulse as our engineering benchmark.',
    actionLabel: 'Start a Venture Consultation',
    actionLabelShort: 'Consult',
  },
];

export function getCaseById(id: CaseId) {
  return cases.find((c) => c.id === id) ?? null;
}
