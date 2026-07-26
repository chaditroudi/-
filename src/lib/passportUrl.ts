/** Public buyer passport URL (HashRouter). */
export const buildLotPassportUrl = (lotIdOrCode: string, origin = typeof window !== 'undefined' ? window.location.origin : '') => {
  const code = encodeURIComponent(String(lotIdOrCode || '').trim());
  return `${origin}/#/passport/${code}`;
};
