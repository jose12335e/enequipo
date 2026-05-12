insert into public.release_notes (id, title, summary, highlights, published_at, is_active)
values (
  '2026-05-12-finance-dashboard-dop',
  'Finanzas en DOP y resumen mensual',
  'Finanzas ahora trabaja en peso dominicano y muestra un resumen mensual mas claro.',
  '["La moneda global cambio a peso dominicano DOP.","Finanzas ahora tiene selector de mes, balance, gastos del mes y monto abierto por liquidar.","La grafica por categoria ahora se ordena de mayor a menor y muestra un estado vacio con accion rapida."]'::jsonb,
  '2026-05-12T00:04:00Z',
  true
)
on conflict (id) do update
set title = excluded.title,
    summary = excluded.summary,
    highlights = excluded.highlights,
    published_at = excluded.published_at,
    is_active = excluded.is_active;
