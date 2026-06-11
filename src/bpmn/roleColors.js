// Brand-inspired palette matching the Ailean identity
const PALETTE = [
  '#9D6BCF', // Cosmic Purple
  '#5AC8D2', // Prism Teal
  '#4A69E1', // Electric Cobalt
  '#89C44A', // Aurora Green (darkened for readability)
  '#D83D41', // Ember Crimson
  '#B86C3D', // Molten Bronze
  '#7E8CC1', // Slate Periwinkle
  '#C07830', // Solar Amber (Solar Gold darkened for contrast)
];

export function roleColor(roleId) {
  if (!roleId || roleId === '_general') return '#7E8CC1';
  let h = 0;
  for (let i = 0; i < roleId.length; i++) h = (h * 31 + roleId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
