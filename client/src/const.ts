export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * URL de login da aplicacao.
 *
 * Por omissao devolve a pagina de login local (`/login`), que usa contas
 * guardadas na tabela `local_users` e nao depende de servicos externos.
 *
 * O login OAuth externo continua disponivel, mas so quando as variaveis
 * VITE_OAUTH_PORTAL_URL e VITE_APP_ID estao definidas no build. Em deployment
 * autonomo a funcao nunca falha: devolve `/login`.
 */
export const getLoginUrl = (): string => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  if (!oauthPortalUrl || !appId) {
    return "/login";
  }

  try {
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch {
    return "/login";
  }
};

/** Indica se o login OAuth externo esta configurado neste build. */
export const isExternalOAuthEnabled = (): boolean =>
  Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID);
