export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center">
      <form method="post" action="/api/auth/admin-login" className="w-80 rounded bg-white p-8 shadow">
        <h1 className="mb-4 text-lg font-semibold">Panel de administración</h1>
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <input id="password" name="password" type="password" className="input" autoFocus required />
        {error && <p className="mt-2 text-xs text-red-700">Contraseña incorrecta</p>}
        <button className="btn-primary mt-4 w-full">Entrar</button>
      </form>
    </div>
  );
}
