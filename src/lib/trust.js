// What the app tells clients about where their data goes.
// Facts follow the DPA v1.0 at app.vimpl.com/dpa.html — change both together.

export const DPA_URL = 'https://app.vimpl.com/dpa.html';
export const PRIVACY_URL = 'https://app.vimpl.com/privacy.html';

export function trustFacts({ offline }) {
  if (offline) {
    return { badgeKey: 'trustBadgeOffline', items: ['trustLocalOnly'], links: [] };
  }
  return {
    badgeKey: 'trustBadgeOnline',
    items: ['trustStorage', 'trustTextAi', 'trustVoice', 'trustNoTraining', 'trustLocalOffer'],
    links: [
      { href: DPA_URL, labelKey: 'trustDpa' },
      { href: PRIVACY_URL, labelKey: 'trustPrivacy' },
    ],
  };
}
