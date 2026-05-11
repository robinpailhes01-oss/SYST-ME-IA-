-- Dashboard access: authenticated users can read everything in the consulting
-- pipeline and update message approval status. Single-operator setup so we
-- allow all authenticated users; tighten this per-user later if needed.

do $$ begin
    create policy "authenticated_read_leads"
        on public.consulting_leads
        for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
    create policy "authenticated_read_diagnostics"
        on public.consulting_diagnostics
        for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
    create policy "authenticated_read_schemas"
        on public.consulting_schemas
        for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
    create policy "authenticated_read_messages"
        on public.consulting_messages
        for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
    create policy "authenticated_update_messages"
        on public.consulting_messages
        for update to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
    create policy "authenticated_read_logs"
        on public.consulting_pipeline_logs
        for select to authenticated using (true);
exception when duplicate_object then null; end $$;
