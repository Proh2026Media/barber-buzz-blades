-- Add icon column to services and staff_services
ALTER TABLE public.services ADD COLUMN icon TEXT;
ALTER TABLE public.staff_services ADD COLUMN icon TEXT;

-- We also need a storage bucket for service icons, if they upload one
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'barbershop-services',
    'barbershop-services',
    true,
    2097152, -- 2MB
    '{image/png,image/jpeg,image/webp,image/svg+xml}'
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for barbershop-services
CREATE POLICY "Public Service Icons" ON storage.objects
    FOR SELECT USING (bucket_id = 'barbershop-services');

CREATE POLICY "Shop Admins Manage Service Icons" ON storage.objects
    FOR ALL USING (
        bucket_id = 'barbershop-services' AND
        (storage.foldername(name))[1] IN (
            SELECT barbershop_id::text FROM shop_members
            WHERE user_id = auth.uid()
              AND active
              AND role IN ('owner', 'partner', 'associate')
        )
    );
