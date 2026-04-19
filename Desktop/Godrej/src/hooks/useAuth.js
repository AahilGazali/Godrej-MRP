import { useQuery, useMutation } from '@tanstack/react-query';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null),
    retry: false,
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => fetch('/api/logout', { 
      method: 'POST', 
      credentials: 'include' 
    }),
  });
}
