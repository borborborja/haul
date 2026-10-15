import { createContext, useContext } from 'react';
import type { LocalizedItem, ProductDraft, ProductSaveResult, SettingsTab, ShopItem } from '../../types';
import type { EditorState } from './ProductDialog';

export type BrowseState = { screen: 'app' | 'settings'; settingsTab: SettingsTab; catalogOpen: boolean; activeBand: string; search: string; editor: EditorState | null; categoryOpen: boolean };
export type ProductFeedback = { message: string; error?: boolean; undo?: () => Promise<void>; retry?: () => Promise<void> };
export type ProductFlow = BrowseState & {
    feedback: ProductFeedback | null; dismissFeedback: () => void;
    setScreen: (screen: BrowseState['screen']) => void; setSettingsTab: (tab: SettingsTab) => void;
    setCatalogOpen: (open: boolean) => void; setActiveBand: (key: string) => void; setSearch: (search: string) => void;
    openCreate: (category?: string, name?: string, bulk?: boolean) => void; openEdit: (item: ShopItem) => void; openCategory: () => void;
    setEditor: (editor: EditorState | null) => void; closeCategory: () => void;
    addExisting: (name: string, category: string) => Promise<void>; hideProduct: (item: LocalizedItem | string) => Promise<void>;
    showProduct: (item: LocalizedItem | string) => Promise<void>; hideCategory: (key: string) => Promise<void>; showCategory: (key: string) => Promise<void>;
    removeItem: (item: ShopItem) => Promise<void>;
    report: (result: ProductSaveResult, success: string) => void; notify: (message: string) => void;
    saveProduct: (draft: ProductDraft, editId?: string, updateCatalog?: boolean) => Promise<ProductSaveResult>;
};

export const ProductFlowContext = createContext<ProductFlow | null>(null);
export function useProductFlow() {
    const flow = useContext(ProductFlowContext);
    if (!flow) throw new Error('ProductFlowProvider is required');
    return flow;
}
