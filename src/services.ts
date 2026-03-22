/**
 * Studio service definitions — core cards (home), mission-critical pitch list.
 */
import { PRESENCE_AUDIT_HREF } from './consts';

export type CoreServiceIcon = 'layers' | 'zap' | 'rocket';

export interface CoreService {
  icon: CoreServiceIcon;
  title: string;
  description: string;
  /** Presence Audit / consultation booking */
  inquiryHref: string;
  inquiryLabel: string;
}

export const coreServices: CoreService[] = [
  {
    icon: 'layers',
    title: 'Digital Reframing',
    description: 'Turning legacy brands into modern authorities.',
    inquiryHref: PRESENCE_AUDIT_HREF,
    inquiryLabel: 'Inquire',
  },
  {
    icon: 'zap',
    title: 'Experience Engineering',
    description:
      'Using WebGL and GSAP to create sites that users don’t just browse—they experience.',
    inquiryHref: PRESENCE_AUDIT_HREF,
    inquiryLabel: 'Inquire',
  },
  {
    icon: 'rocket',
    title: 'Venture Deployment',
    description:
      'Turning raw concepts into market-ready assets. We engineer end-to-end mobile applications, web platforms, and custom software ecosystems with aerospace-grade precision.',
    inquiryHref: PRESENCE_AUDIT_HREF,
    inquiryLabel: 'Inquire',
  },
];

/** Home “Venture Capabilities” grid — monospace SRV-## IDs, glass cards, GSAP stagger. */
export interface VentureCapability {
  srvId: string;
  title: string;
  description: string;
  href: string;
}

export const ventureCapabilities: VentureCapability[] = [
  {
    srvId: 'SRV-01',
    title: 'Digital Reframing',
    description:
      'Architecting brand authority and market positioning for high-growth ventures.',
    href: '/brand-reframing',
  },
  {
    srvId: 'SRV-02',
    title: 'Experience Engineering',
    description:
      'Cinematic, high-performance web systems and headless e-commerce engines.',
    href: '/experience-engineering',
  },
  {
    srvId: 'SRV-03',
    title: 'Venture Deployment',
    description:
      'Full-stack mobile app engineering and proprietary software development.',
    href: PRESENCE_AUDIT_HREF,
  },
  {
    srvId: 'SRV-04',
    title: 'Cloud-Native Scale',
    description:
      'Leveraging AWS infrastructure to ensure zero-downtime during peak demand.',
    href: '/cloud-native-scale',
  },
  {
    srvId: 'SRV-05',
    title: 'Performance Audits',
    description: 'Identifying technical leakage and optimizing conversion velocity.',
    href: '/audit',
  },
  {
    srvId: 'SRV-06',
    title: 'Product Strategy',
    description:
      'From MVP to global scale. We define the roadmap for your next software asset.',
    href: PRESENCE_AUDIT_HREF,
  },
];

export interface MissionService {
  id: string;
  title: string;
  copy: string;
  /** Optional feature rail (e.g. Venture Deployment) */
  features?: string;
  ctaLabel: string;
  ctaHref: string;
}

export const missionCriticalServices: MissionService[] = [
  {
    id: '01',
    title: 'Digital Reframing',
    copy: 'Turning legacy brands into modern authorities.',
    ctaLabel: 'Learn more',
    ctaHref: '#city-pulse',
  },
  {
    id: '02',
    title: 'Experience Engineering',
    copy:
      'Using WebGL and GSAP to create sites that users don’t just browse—they experience.',
    ctaLabel: 'Learn more',
    ctaHref: '#city-pulse',
  },
  {
    id: '03',
    title: 'Venture Deployment',
    copy:
      'Turning raw concepts into market-ready assets. We engineer end-to-end mobile applications, web platforms, and custom software ecosystems with aerospace-grade precision.',
    features: 'Full-Stack Architecture | Native App Development | Cloud Infrastructure.',
    ctaLabel: 'Deploy Your Vision',
    ctaHref: PRESENCE_AUDIT_HREF,
  },
];
