const CSRF_COOKIE_NAME = 'csrftoken';

export const getCsrfToken = (): string | null => {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value ?? '');
    }
  }
  return null;
};
