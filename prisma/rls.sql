-- Supabase нь public schema-ийн хүснэгт бүрийг Data API (publishable/anon key)-аар нээдэг.
-- Бид Data API ашиглахгүй тул бүх хүснэгт дээр RLS асааж, policy үүсгэхгүй: тэр замаар юу ч уншиж/бичиж болохгүй.
-- Prisma нь хүснэгтийн эзэн (postgres) хэрэглэгчээр холбогддог тул RLS түүнд нөлөөлөхгүй.
-- `npm run db:push` бүрийн дараа автоматаар ажиллана (шинэ хүснэгт нэмэгдсэн ч хамгаалагдана).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
