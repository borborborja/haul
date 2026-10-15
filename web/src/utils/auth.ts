interface Session {
    isValid: boolean;
    record: { collectionName?: string; account_type?: string } | null;
}

// Guests have valid API tokens too, but must still see login/registration.
export const isAccountSession = (session: Session): boolean =>
    session.isValid && session.record?.collectionName === 'users' && session.record.account_type === 'account';
