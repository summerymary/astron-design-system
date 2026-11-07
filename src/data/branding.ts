export interface ClubBrand {
  name: string;
  initials: string;
  logoSrc?: string;
  markSrc?: string;
  logoTone: 'light' | 'dark' | 'color';
  logoBackground?: string;
  logoFrameless?: boolean;
  fallbackColor?: string;
}

export const astronBrand: ClubBrand = {
  name: 'Астрон',
  initials: 'А',
  logoSrc: './brand/astron-burgundy.svg',
  logoTone: 'color',
  logoFrameless: true,
  fallbackColor: '#B32D3D',
};

export const astronWhiteBrand: ClubBrand = {
  ...astronBrand,
  logoSrc: './brand/astron-white.svg',
  logoTone: 'light',
  logoFrameless: false,
  fallbackColor: '#FFFFFF',
};
