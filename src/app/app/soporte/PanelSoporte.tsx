"use client";

import { useState, useTransition } from "react";
import { buscarCuentas, cambiarActivo, cambiarRol, cambiarSoporte, crearCuenta, resetearAcceso, type Cuenta } from "./acciones";

type Rol = { clave: string; label: string };

// Muestra la contraseña temporal UNA vez, con botón de copiar.
function Credencial({ correo, contrasena, onCerrar }: { correo: string; contrasena: string; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Correo: ${correo}\nContraseña temporal: ${contrasena}\nAl entrar te pedirá crear la tuya.`;
  return (
    <div className="alerta-ok space-y-2 text-tinta" role="status">
      <p className="font-semibold">Acceso listo. Compártelo por un medio privado:</p>
      <pre className="whitespace-pre-wrap rounded-control bg-superficie p-3 font-mono text-sm">{texto}</pre>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secundario"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto);
              setCopiado(true);
            } catch {
              setCopiado(false);
            }
          }}
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
        <button type="button" className="btn-secundario" onClick={onCerrar}>Listo</button>
      </div>
    </div>
  );
}

export function PanelSoporte({ inicial, roles, yo }: { inicial: Cuenta[]; roles: Rol[]; yo: string }) {
  const [cuentas, setCuentas] = useState(inicial);
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState({ correo: "", nombre: "", rol: roles[roles.length - 1]?.clave ?? "" });
  const [cred, setCred] = useState<{ correo: string; contrasena: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const refrescar = (texto = q) =>
    iniciar(async () => {
      const r = await buscarCuentas(texto);
      setCuentas(r.cuentas);
    });

  const ejecutar = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "No se pudo.");
      const l = await buscarCuentas(q);
      setCuentas(l.cuentas);
    });

  return (
    <div className="space-y-5">
      <section className="tarjeta space-y-3">
        <h2 className="titulo text-2xl">Crear cuenta</h2>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              setError(null);
              const r = await crearCuenta(nuevo);
              if (!r.ok) return setError(r.error);
              setCred({ correo: r.correo, contrasena: r.contrasena });
              setNuevo({ ...nuevo, correo: "", nombre: "" });
              const l = await buscarCuentas(q);
              setCuentas(l.cuentas);
            });
          }}
        >
          <input id="nuevo-nombre" required placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className="campo" />
          <input id="nuevo-correo" required type="email" placeholder="Correo" value={nuevo.correo} onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} className="campo" />
          <select id="nuevo-rol" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })} className="campo" aria-label="Rol">
            {roles.map((r) => <option key={r.clave} value={r.clave}>{r.label}</option>)}
          </select>
          <button type="submit" disabled={pendiente} className="btn-primario">Crear</button>
        </form>
        {cred && <Credencial {...cred} onCerrar={() => setCred(null)} />}
        {error && <p className="alerta-error" role="alert">{error}</p>}
      </section>

      <section className="tarjeta space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="titulo text-2xl">Cuentas</h2>
          <form onSubmit={(e) => { e.preventDefault(); refrescar(); }} className="flex gap-2">
            <input id="buscar-cuenta" type="search" placeholder="Buscar por nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} className="campo py-2" />
            <button className="btn-secundario" disabled={pendiente}>Buscar</button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="etiqueta">
              <tr>
                <th className="py-2 pr-3">Persona</th>
                <th className="py-2 pr-3">Rol</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {cuentas.map((c) => (
                <tr key={c.id} className={c.activo ? "" : "opacity-60"}>
                  <td className="py-3 pr-3">
                    <p className="font-semibold">{c.nombre || "Sin nombre"}{c.id === yo && " (tú)"}</p>
                    <p className="text-muted">{c.correo}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      aria-label={`Rol de ${c.nombre ?? c.correo}`}
                      value={c.rol}
                      disabled={pendiente || c.id === yo}
                      onChange={(e) => ejecutar(() => cambiarRol(c.id, e.target.value))}
                      className="campo py-1.5"
                    >
                      {roles.map((r) => <option key={r.clave} value={r.clave}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="py-3 pr-3">
                    {c.activo ? "Activa" : "Desactivada"}
                    {c.esSoporte && <span className="ml-2 rounded-full bg-primario/10 px-2 py-0.5 text-xs font-semibold text-primario">Soporte</span>}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        className="btn-secundario px-3 py-1.5"
                        disabled={pendiente}
                        onClick={() =>
                          iniciar(async () => {
                            const r = await resetearAcceso(c.id);
                            if (r.ok) setCred({ correo: r.correo, contrasena: r.contrasena });
                            else setError(r.error);
                          })
                        }
                      >
                        Resetear acceso
                      </button>
                      {c.id !== yo && (
                        <>
                          <button className="btn-secundario px-3 py-1.5" disabled={pendiente} onClick={() => ejecutar(() => cambiarActivo(c.id, !c.activo))}>
                            {c.activo ? "Desactivar" : "Reactivar"}
                          </button>
                          <button className="btn-secundario px-3 py-1.5" disabled={pendiente} onClick={() => ejecutar(() => cambiarSoporte(c.id, !c.esSoporte))}>
                            {c.esSoporte ? "Quitar soporte" : "Dar soporte"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {cuentas.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted">No hay cuentas con esa búsqueda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
