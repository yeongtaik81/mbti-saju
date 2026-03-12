export type ClientSessionUser = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
};

export type ClientSessionPayload = {
  authenticated: boolean;
  user: ClientSessionUser | null;
};

export async function fetchClientSession(): Promise<ClientSessionPayload> {
  const response = await fetch('/api/v1/auth/session', {
    cache: 'no-store'
  });

  if (!response.ok) {
    return {
      authenticated: false,
      user: null
    };
  }

  return (await response.json()) as ClientSessionPayload;
}

export async function signOutClient(): Promise<boolean> {
  const response = await fetch('/api/v1/auth/sign-out', {
    method: 'POST'
  });

  return response.ok;
}
