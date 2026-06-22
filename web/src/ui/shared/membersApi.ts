import { pb } from '../../lib/pocketbase';

// Authenticated membership API (admins, members, guests, join-by-link).

export type MemberRole = 'owner' | 'admin' | 'guest';

export interface Member {
    userId: string;
    name: string;
    role: MemberRole;
    avatarUrl: string;
    color: string;
    lastActiveAt: string;
}

export const listMembers = (listId: string) =>
    pb.send<Member[]>(`/api/shoplist/lists/${listId}/members`, { method: 'GET' });

export const addAdmin = (listId: string, email: string) =>
    pb.send<{ ok?: boolean; noAccount?: boolean }>(`/api/shoplist/lists/${listId}/admins`, { method: 'POST', body: { email } });

export const fetchAdminLink = (listId: string) =>
    pb.send<{ token: string }>(`/api/shoplist/lists/${listId}/admin-link`, { method: 'POST' });

export const removeMember = (listId: string, userId: string) =>
    pb.send(`/api/shoplist/lists/${listId}/members/${userId}`, { method: 'DELETE' });

export const joinByToken = (token: string) =>
    pb.send<{ listId: string; name: string; role: MemberRole; mode?: string }>(`/api/shoplist/join/${encodeURIComponent(token)}`, { method: 'POST' });

// Server returns avatar URLs relative to the origin.
export const avatarSrc = (url: string | null | undefined) => (url ? `${window.location.origin}${url}` : '');
