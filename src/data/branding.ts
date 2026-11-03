export interface ClubBrand {
  name: string;
  initials: string;
  logoSrc?: string;
  markSrc?: string;
  logoTone: 'light' | 'dark' | 'color';
  logoBackground?: string;
  logoFrameless?: boolean;
}

export const astronBrand: ClubBrand = {
  name: 'Астрон',
  initials: 'А',
  logoSrc: './brand/astron-black.svg',
  logoTone: 'dark',
  logoFrameless: true,
};

export const astronWhiteBrand: ClubBrand = {
  ...astronBrand,
  logoSrc: './brand/astron-white.svg',
  logoTone: 'light',
  logoFrameless: false,
};
