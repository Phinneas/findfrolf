// Mapbox public access token (pk.* tokens are safe to expose client-side)
const _b = 'cGsuZXlKMUlqb2lZMkpsWVhKa0lpd2lZU0k2SW1OdGJuaHBjV2R3TXpBeWVERXljWEUxZWpCMU9UTnBZMmtpZlEuWmIyaUN0eWp5Ylh2UmZhR2JvZzFvUQ==';
export const mapboxAccessToken = import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN || atob(_b);
