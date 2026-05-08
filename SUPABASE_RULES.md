# Reglas Claras de Supabase para DuoLife

## 1. Auth es la puerta de entrada

Una persona solo puede entrar si existe en:

`Authentication -> Users`

No basta con que exista en `public.user_profiles`.

## 2. user_profiles es el perfil de la app

Cada usuario de `auth.users` debe tener una fila en `public.user_profiles`.

Esto lo crea automáticamente el trigger:

`public.handle_new_user_profile`

Si ya había usuarios antes del trigger, el script hace backfill.

## 3. Registro recomendado

Para producción, usa una de estas dos opciones:

- Email confirmation activado y bien configurado con Site URL y Redirect URLs.
- Email confirmation desactivado mientras pruebas con usuarios reales.

Si Supabase bloquea emails por rate limit, crea usuarios desde:

`Authentication -> Users -> Add user`

Activa `Auto Confirm User`.

## 4. Parejas

El usuario A:

1. Entra a la app.
2. Va a Pareja.
3. Toca Crear pareja.
4. Recibe un código de 8 caracteres.

El usuario B:

1. Entra con su propia cuenta.
2. Va a Pareja.
3. Toca Unirme con código.
4. Pega el código del usuario A.

La app no consulta `couples` directamente para unirse. Usa:

`public.join_couple_by_code(code)`

Esto existe porque RLS no debe permitir que cualquier persona lea parejas por código.

## 5. RLS

Todas las tablas tienen RLS activo.

Regla general:

- Solo miembros de la pareja pueden leer datos de esa pareja.
- Solo miembros pueden insertar datos de esa pareja.
- Creador o miembro puede actualizar.
- Solo creador puede borrar.

## 6. Realtime

Realtime solo está activo para:

- `events`
- `tasks`
- `expenses`

Notas no usan realtime.

## 7. Variables de producción

En Vercel deben existir:

```env
VITE_SUPABASE_URL=https://ueghpvrqozduxjjhoqys.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_Kc1hnIBRvTl-NGgcsG6ohQ_jDZ5TFWE
```

Después de cambiar variables, siempre hacer redeploy.
