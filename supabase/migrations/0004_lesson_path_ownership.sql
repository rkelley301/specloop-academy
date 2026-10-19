-- Tighten lesson writes: a learner may only place lessons in a learning path
-- they own. Without this, foreign-key checks (which ignore RLS) let a user add
-- their own lesson rows to someone else's path or to the shared seed path,
-- occupying (path_id, position) slots and blocking the owner's publishes.

drop policy if exists write_own_lessons on public.lessons;

create policy write_own_lessons on public.lessons for all
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.learning_paths p
      where p.id = path_id and p.owner_id = (select auth.uid())
    )
  );
