export interface LocalizedItem {
    es: string;
    ca: string;
    en: string;
    [key: string]: string;
}

export interface CategoryItem {
    icon: string;
    items: LocalizedItem[];
    color?: string;
    names?: LocalizedItem; // server-provided category label in all languages
}

export interface Categories {
    [key: string]: CategoryItem;
}

export interface ShopItem {
    id: string;
    name: string;
    checked: boolean;
    note: string;
    quantity?: string;
    catalogSourceId?: string;
    catalogSourceKind?: 'custom' | 'global' | '';
    catalogSourceCategory?: string;
    category: string;
    updatedAt?: number;
    inList?: boolean;  // true = en lista activa, false/undefined = en "utilizados anteriormente"
    serverUpdated?: number; // ms timestamp of the last server version applied locally
    dirty?: boolean;        // local edits the server hasn't accepted yet (resync pushes them)
    addedBy?: string;       // name of who added the item
    checkedBy?: string;     // name of who bought (checked) it
}

export interface ProductDraft {
    name: string;
    category: string;
    quantity?: string;
    note?: string;
    addToList?: boolean;
}

export type ProductSaveStatus = 'saved' | 'pending' | 'exists' | 'error';

export interface ProductSaveResult {
    status: ProductSaveStatus;
    itemId?: string;
    catalogId?: string;
    categoryKey?: string;
    error?: string;
}

export type AppMode = 'planning' | 'shopping';
export type ViewMode = 'list' | 'compact' | 'grid';
export type { Lang } from '../data/i18n';
export type SettingsTab = 'account' | 'catalog' | 'other' | 'about';

export interface AuthState {
    // A permanent user account; a guest API token does not count as sign-in.
    isLoggedIn: boolean;
    email: string | null;
    userId: string | null;
    username: string | null;
    avatarUrl: string | null;
    avatarColor: string | null;
}

export interface PresenceUser {
    id: string;
    username: string;
    lastActiveAt: string;
}
