-- Enum values must commit before use in the same migration chain.
alter type public.app_role add value if not exists 'account_manager';
alter type public.shop_change_status add value if not exists 'expired';
