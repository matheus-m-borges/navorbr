import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/navor-rephub/AppShell";
import {
  Chip,
  EmptyState,
  Field,
  GhostButton,
  GlassCard,
  Modal,
  PrimaryButton,
  SectionTitle,
  SelectInput,
  TextInput,
} from "@/components/navor-rephub/ui";
import { initials } from "@/lib/crm";
import { crmDb } from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  createTeamUser,
  deleteTeamUser,
  lookupEmailUsage,
  setUserActive,
  setUserPermissions,
  updateTeamUser,
  type Permission,
} from "@/lib/usuarios.functions";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e permissões | RepHub" },
      {
        name: "description",
        content:
          "Cadastro completo da equipe da representação: administradores e vendedores, com controle de permissões por módulo do sistema.",
      },
      { property: "og:title", content: "Usuários e permissões | RepHub" },
      {
        property: "og:description",
        content: "Cadastre vendedores e administradores e defina o que cada um pode acessar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsuariosPage,
});

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  document: string | null;
  notes: string | null;
  role_title: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  permissions: string[];
  is_primary_admin: boolean;
  role: "admin" | "vendedor";
}

function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        crmDb.from("profiles").select("*").order("created_at", { ascending: true }),
        crmDb.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, string>();
      for (const r of (roles ?? []) as { user_id: string; role: string }[])
        roleMap.set(r.user_id, r.role);
      return ((profiles ?? []) as Record<string, unknown>[]).map((p) => ({
        id: String(p["id"]),
        full_name: (p["full_name"] as string | null) ?? null,
        email: (p["email"] as string | null) ?? null,
        phone: (p["phone"] as string | null) ?? null,
        document: (p["document"] as string | null) ?? null,
        notes: (p["notes"] as string | null) ?? null,
        role_title: (p["role_title"] as string | null) ?? null,
        city: (p["city"] as string | null) ?? null,
        state: (p["state"] as string | null) ?? null,
        active: (p["active"] as boolean | null) ?? true,
        permissions: (p["permissions"] as string[] | null) ?? [],
        is_primary_admin: (p["is_primary_admin"] as boolean | null) ?? false,
        role: roleMap.get(String(p["id"])) === "admin" ? "admin" : "vendedor",
      })) as TeamMember[];
    },
  });
}

const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  role: "vendedor" as "admin" | "vendedor",
  phone: "",
  document: "",
  role_title: "",
  city: "",
  state: "",
  notes: "",
};

function UsuariosPage() {
  const qc = useQueryClient();
  const { data: team = [], isLoading } = useTeam();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const me = team.find((t) => t.id === user?.id);
  const isPrimary = me?.is_primary_admin ?? false;

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [perms, setPerms] = useState<string[]>([]);
  const [permsFor, setPermsFor] = useState<TeamMember | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const create = useServerFn(createTeamUser);
  const savePerms = useServerFn(setUserPermissions);
  const toggleActive = useServerFn(setUserActive);
  const updateUser = useServerFn(updateTeamUser);
  const removeUser = useServerFn(deleteTeamUser);
  const checkEmail = useServerFn(lookupEmailUsage);

  async function verifyEmail(email: string) {
    setEmailWarning(null);
    const value = email.trim();
    if (!value || !value.includes("@")) return;
    try {
      const res = await checkEmail({ data: { email: value } });
      if (res.inUse) setEmailWarning(res.message);
    } catch {
      // consulta opcional; não bloqueia o formulário
    }
  }

  function openEdit(p: TeamMember) {
    setEditing(p);
    setEditForm({
      ...emptyForm,
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      document: p.document ?? "",
      role_title: p.role_title ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
      notes: p.notes ?? "",
      role: p.role,
    });
  }

  async function submitEdit() {
    if (!editing) return;
    if (!editForm.full_name.trim() || !editForm.email.trim()) {
      toast.error("Informe nome e e-mail.");
      return;
    }
    if (editForm.password && editForm.password.length < 8) {
      toast.error("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await updateUser({
        data: {
          userId: editing.id,
          full_name: editForm.full_name,
          email: editForm.email,
          password: editForm.password || "",
          phone: editForm.phone,
          document: editForm.document,
          role_title: editForm.role_title,
          city: editForm.city,
          state: editForm.state,
          notes: editForm.notes,
        },
      });
      setEditing(null);
      refresh();
      toast.success("Usuário atualizado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submitDelete() {
    if (!removing) return;
    setSaving(true);
    try {
      const res = await removeUser({ data: { userId: removing.id } });
      setRemoving(null);
      setConfirmName("");
      refresh();
      toast.success(
        res.notice
          ? res.notice
          : res.unlinked > 0
            ? `Usuário excluído. ${res.unlinked} registro(s) ficaram sem responsável.`
            : "Usuário excluído.",
      );

    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const refresh = () => void qc.invalidateQueries({ queryKey: ["team"] });

  async function setRole(userId: string, role: "admin" | "vendedor") {
    if (!isAdmin) {
      toast.error("Apenas administradores podem alterar perfis.");
      return;
    }
    await crmDb.from("user_roles").delete().eq("user_id", userId);
    const { error } = await crmDb.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    toast.success("Perfil atualizado.");
  }

  async function submit() {
    if (!form.full_name.trim() || !form.email.trim() || form.password.length < 8) {
      toast.error("Informe nome, e-mail e uma senha com pelo menos 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await create({ data: { ...form, permissions: perms } });
      setOpen(false);
      setForm(emptyForm);
      setPerms([]);
      refresh();
      toast.success("Usuário cadastrado. Ele já pode entrar com o e-mail e a senha definidos.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function PermissionPicker({
    value,
    onChange,
    disabled,
  }: {
    value: string[];
    onChange: (next: string[]) => void;
    disabled?: boolean;
  }) {
    return (
      <div className="flex flex-wrap gap-2">
        {PERMISSIONS.map((p: Permission) => {
          const active = value.includes(p);
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange(active ? value.filter((x) => x !== p) : [...value, p])
              }
              className={`rounded-lg border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
                active
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-border text-muted-foreground hover:bg-accent/60"
              }`}
            >
              {PERMISSION_LABELS[p]}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <AppShell
      title="Usuários"
      subtitle={
        isPrimary
          ? "Você é o administrador principal: só você concede ou retira permissões"
          : isAdmin
            ? "Cadastre a equipe; as permissões são definidas pelo administrador principal"
            : "Somente administradores gerenciam a equipe"
      }
      actions={
        isAdmin ? (
          <PrimaryButton onClick={() => setOpen(true)}>+ Incluir usuário</PrimaryButton>
        ) : null
      }
    >
      <GlassCard className="p-5">
        <SectionTitle
          title="Equipe"
          hint="Administrador vê tudo; vendedor trabalha os próprios leads e clientes"
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando usuários...</p>
        ) : team.length === 0 ? (
          <EmptyState title="Nenhum usuário" hint="Inclua o primeiro vendedor da equipe." />
        ) : (
          <div className="space-y-2">
            {team.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-ink-2/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-full bg-violet/20 font-display text-xs font-semibold text-violet">
                    {initials(p.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-card-foreground">
                      {p.full_name ?? "Sem nome"}
                      {p.role_title ? (
                        <span className="text-muted-foreground"> · {p.role_title}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.email ?? "—"}
                      {p.city ? ` · ${p.city}${p.state ? `/${p.state}` : ""}` : ""}
                    </p>
                    {p.permissions.length > 0 ? (
                      <p className="mt-0.5 text-[11px] text-gold">
                        {p.permissions
                          .map((x) => PERMISSION_LABELS[x as Permission] ?? x)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {p.is_primary_admin ? <Chip tone="amber">Admin principal</Chip> : null}
                  {!p.active ? <Chip tone="rose">Inativo</Chip> : null}
                  <Chip tone={p.role === "admin" ? "brand" : "cyan"}>
                    {p.role === "admin" ? "Administrador" : "Vendedor"}
                  </Chip>
                  {isPrimary ? (
                    <GhostButton
                      onClick={() => {
                        setPermsFor(p);
                        setEditPerms(p.permissions);
                      }}
                    >
                      Permissões
                    </GhostButton>
                  ) : null}
                  {isAdmin && (!p.is_primary_admin || p.id === user?.id) ? (
                    <GhostButton onClick={() => openEdit(p)}>Editar</GhostButton>
                  ) : null}
                  {isAdmin && !p.is_primary_admin ? (
                    <>
                      <GhostButton
                        onClick={() => void setRole(p.id, p.role === "admin" ? "vendedor" : "admin")}
                      >
                        {p.role === "admin" ? "Tornar vendedor" : "Tornar administrador"}
                      </GhostButton>
                      <GhostButton
                        onClick={async () => {
                          try {
                            await toggleActive({ data: { userId: p.id, active: !p.active } });
                            refresh();
                            toast.success(p.active ? "Usuário desativado." : "Usuário reativado.");
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        {p.active ? "Desativar" : "Reativar"}
                      </GhostButton>
                      {p.id !== user?.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRemoving(p);
                            setConfirmName("");
                          }}
                          className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-400 transition hover:bg-rose-500/10"
                        >
                          Excluir
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Incluir usuário"
        subtitle="Vendedor ou administrador com acesso próprio ao sistema"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo *" className="sm:col-span-2">
            <TextInput
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="E-mail de acesso *">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
                setEmailWarning(null);
              }}
              onBlur={(e) => void verifyEmail(e.target.value)}
            />
            {emailWarning ? (
              <p className="mt-1 text-[11px] text-rose-400">{emailWarning}</p>
            ) : null}
          </Field>
          <Field label="Senha inicial * (mín. 8 caracteres)">
            <TextInput
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Field label="Perfil">
            <SelectInput
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as "admin" | "vendedor" })
              }
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </SelectInput>
          </Field>
          <Field label="Cargo / função">
            <TextInput
              value={form.role_title}
              onChange={(e) => setForm({ ...form, role_title: e.target.value })}
              maxLength={80}
            />
          </Field>
          <Field label="CPF">
            <TextInput
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
              maxLength={20}
            />
          </Field>
          <Field label="Telefone / WhatsApp">
            <TextInput
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              maxLength={30}
            />
          </Field>
          <Field label="Cidade">
            <TextInput
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              maxLength={80}
            />
          </Field>
          <Field label="Estado">
            <TextInput
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
              maxLength={2}
            />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextInput
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              maxLength={240}
            />
          </Field>
          <Field label="Permissões dentro do sistema" className="sm:col-span-2">
            <PermissionPicker value={perms} onChange={setPerms} disabled={!isPrimary} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isPrimary
                ? "Selecione o que este usuário poderá acessar."
                : "Somente o administrador principal define permissões."}
            </p>
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setOpen(false)}>Cancelar</GhostButton>
          <PrimaryButton disabled={saving} onClick={() => void submit()}>
            {saving ? "Salvando..." : "Cadastrar usuário"}
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={permsFor !== null}
        onClose={() => setPermsFor(null)}
        title={`Permissões de ${permsFor?.full_name ?? ""}`}
        subtitle="Somente o administrador principal pode alterar"
        wide
      >
        <PermissionPicker value={editPerms} onChange={setEditPerms} />
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setPermsFor(null)}>Cancelar</GhostButton>
          <PrimaryButton
            onClick={async () => {
              if (!permsFor) return;
              try {
                await savePerms({ data: { userId: permsFor.id, permissions: editPerms } });
                setPermsFor(null);
                refresh();
                toast.success("Permissões atualizadas.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Salvar permissões
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Editar ${editing?.full_name ?? "usuário"}`}
        subtitle="Altere os dados de cadastro e, se quiser, defina uma nova senha"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo *" className="sm:col-span-2">
            <TextInput
              value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="E-mail de acesso *">
            <TextInput
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </Field>
          <Field label="Nova senha (opcional, mín. 8)">
            <TextInput
              type="password"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            />
          </Field>
          <Field label="Cargo / função">
            <TextInput
              value={editForm.role_title}
              onChange={(e) => setEditForm({ ...editForm, role_title: e.target.value })}
              maxLength={80}
            />
          </Field>
          <Field label="CPF">
            <TextInput
              value={editForm.document}
              onChange={(e) => setEditForm({ ...editForm, document: e.target.value })}
              maxLength={20}
            />
          </Field>
          <Field label="Telefone / WhatsApp">
            <TextInput
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              maxLength={30}
            />
          </Field>
          <Field label="Cidade">
            <TextInput
              value={editForm.city}
              onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              maxLength={80}
            />
          </Field>
          <Field label="Estado">
            <TextInput
              value={editForm.state}
              onChange={(e) => setEditForm({ ...editForm, state: e.target.value.toUpperCase() })}
              maxLength={2}
            />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextInput
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              maxLength={240}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setEditing(null)}>Cancelar</GhostButton>
          <PrimaryButton disabled={saving} onClick={() => void submitEdit()}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Excluir usuário"
        subtitle="Esta ação remove o acesso definitivamente"
      >
        <p className="text-sm text-muted-foreground">
          Para confirmar, digite o nome do usuário:{" "}
          <span className="text-card-foreground">{removing?.full_name ?? removing?.email}</span>
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Leads, clientes e demais registros continuam salvos, apenas ficam sem responsável.
        </p>
        <div className="mt-3">
          <TextInput value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setRemoving(null)}>Cancelar</GhostButton>
          <button
            type="button"
            disabled={
              saving ||
              confirmName.trim().toLowerCase() !==
                (removing?.full_name ?? removing?.email ?? "").trim().toLowerCase()
            }
            onClick={() => void submitDelete()}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            {saving ? "Excluindo..." : "Excluir definitivamente"}
          </button>
        </div>
      </Modal>
    </AppShell>
  );
}
