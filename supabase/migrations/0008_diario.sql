-- 0008 · Tareas diarias (ej. el carrusel de Rompiendo Tabúes, todos los días a las 8:30 pm)
alter table public.tasks drop constraint if exists tasks_repeat_check;
alter table public.tasks add constraint tasks_repeat_check check (repeat in ('none','daily','weekly'));
