import { useQuery } from "@tanstack/react-query";
import { crmDb } from "@/hooks/useCrm";

export interface ExpenseCategory {
  id: string;
  name: string;
  kind: string;
  group_name: string | null;
  travel_related: boolean;
  active: boolean;
}

export interface Supplier {
  id: string;
  legal_name: string;
  trade_name: string | null;
  document: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  active: boolean;
}

export interface CostCenter {
  id: string;
  name: string;
  factory_id: string | null;
  brand_id: string | null;
  notes: string | null;
  active: boolean;
}

export interface FinancialAccount {
  id: string;
  name: string;
  kind: string;
  bank_name: string | null;
  initial_balance: number;
  active: boolean;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string | null;
  usage: string | null;
  active: boolean;
}

export interface Trip {
  id: string;
  title: string;
  destination: string | null;
  start_date: string;
  end_date: string | null;
  purpose: string | null;
  client_id: string | null;
  factory_id: string | null;
  revenue_generated: number;
  notes: string | null;
  owner_name: string | null;
  created_at: string;
  clients?: { id: string; legal_name: string; trade_name: string | null } | null;
  factories?: { id: string; legal_name: string } | null;
}

export interface Expense {
  id: string;
  description: string;
  category_id: string | null;
  supplier_id: string | null;
  cost_center_id: string | null;
  account_id: string | null;
  trip_id: string | null;
  vehicle_id: string | null;
  factory_id: string | null;
  brand_id: string | null;
  client_id: string | null;
  amount: number;
  expense_date: string;
  due_date: string | null;
  payment_method: string | null;
  installments_count: number;
  recurrence: string;
  recurrence_until: string | null;
  status: string;
  paid_amount: number;
  paid_at: string | null;
  receipt_path: string | null;
  receipt_name: string | null;
  liters: number | null;
  odometer: number | null;
  notes: string | null;
  owner_name: string | null;
  created_at: string;
  expense_categories?: { id: string; name: string; kind: string } | null;
  suppliers?: { id: string; legal_name: string; trade_name: string | null } | null;
  cost_centers?: { id: string; name: string } | null;
  financial_accounts?: { id: string; name: string } | null;
  trips?: { id: string; title: string } | null;
  expense_installments?: ExpenseInstallment[];
}

export interface ExpenseInstallment {
  id: string;
  expense_id: string;
  number: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  paid_at: string | null;
  status: string;
}

export interface ExpenseBudget {
  id: string;
  category_id: string | null;
  cost_center_id: string | null;
  period_label: string | null;
  period_start: string;
  period_end: string;
  planned_amount: number;
}

export const PAYMENT_METHODS = [
  "Pix",
  "Dinheiro",
  "Débito",
  "Crédito",
  "Boleto",
  "Transferência",
  "Outro",
] as const;

export const RECURRENCES = ["Nenhuma", "Mensal", "Bimestral", "Trimestral", "Anual"] as const;

export const EXPENSE_STATUSES = ["Em aberto", "Pago parcialmente", "Pago", "Em atraso"] as const;

async function list<T>(table: string, select: string, order?: { col: string; asc?: boolean }) {
  let q = crmDb.from(table).select(select);
  if (order) q = q.order(order.col, { ascending: order.asc ?? false });
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => list<ExpenseCategory>("expense_categories", "*", { col: "name", asc: true }),
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: () => list<Supplier>("suppliers", "*", { col: "legal_name", asc: true }),
  });
}

export function useCostCenters() {
  return useQuery({
    queryKey: ["cost-centers"],
    queryFn: () => list<CostCenter>("cost_centers", "*", { col: "name", asc: true }),
  });
}

export function useFinancialAccounts() {
  return useQuery({
    queryKey: ["financial-accounts"],
    queryFn: () => list<FinancialAccount>("financial_accounts", "*", { col: "name", asc: true }),
  });
}

export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: () => list<Vehicle>("vehicles", "*", { col: "name", asc: true }),
  });
}

export function useTrips() {
  return useQuery({
    queryKey: ["trips"],
    queryFn: () =>
      list<Trip>("trips", "*, clients(id, legal_name, trade_name), factories(id, legal_name)", {
        col: "start_date",
      }),
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: () =>
      list<Expense>(
        "expenses",
        "*, expense_categories(id, name, kind), suppliers(id, legal_name, trade_name), cost_centers(id, name), financial_accounts(id, name), trips(id, title), expense_installments(*)",
        { col: "expense_date" },
      ),
  });
}

export function useExpenseBudgets() {
  return useQuery({
    queryKey: ["expense-budgets"],
    queryFn: () => list<ExpenseBudget>("expense_budgets", "*", { col: "period_start" }),
  });
}
