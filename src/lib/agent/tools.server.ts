import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export type ToolContext = {
  userId: string;
  role: string;
  phoneNumber: string;
  sessionId: string;
};

// Base registry type
export type Tool<TInput = any> = {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  run: (ctx: ToolContext, input: TInput) => Promise<any>;
};

const withAuth = (query: any, ctx: ToolContext) => {
  // If not admin, restrict to rows owned/created by the user
  if (ctx.role !== 'admin') {
     // Most tables use user_id or created_by. We'll use an OR condition or specific based on table.
     // For safety, assuming user_id or created_by exists.
     return query.eq('user_id', ctx.userId);
  }
  return query;
};

const withCreatedByAuth = (query: any, ctx: ToolContext) => {
  if (ctx.role !== 'admin') {
     return query.eq('created_by', ctx.userId);
  }
  return query;
};

export const tools: Record<string, Tool> = {
  // --- CLIENTS ---
  buscar_clientes: {
    name: 'buscar_clientes',
    description: 'Busca clientes pelo nome ou documento para encontrar seu ID.',
    schema: z.object({ query: z.string() }),
    run: async (ctx, { query }) => {
      const { data, error } = await withCreatedByAuth(
        supabaseAdmin.from('clients').select('id, name, document, phone').ilike('name', `%${query}%`).limit(10),
        ctx
      );
      if (error) throw new Error(error.message);
      return data;
    },
  },
  criar_cliente: {
    name: 'criar_cliente',
    description: 'Prepara a criação de um novo cliente. Use isso quando o cliente não for encontrado.',
    schema: z.object({ name: z.string(), phone: z.string().optional(), email: z.string().optional() }),
    run: async (ctx, input) => {
      return { 
        _action: 'CREATE_CLIENT',
        payload: { ...input, created_by: ctx.userId }
      };
    },
  },
  
  // --- BRANDS & COLLECTIONS ---
  buscar_marcas: {
    name: 'buscar_marcas',
    description: 'Busca marcas pelo nome.',
    schema: z.object({ name: z.string() }),
    run: async (ctx, { name }) => {
      const { data, error } = await supabaseAdmin.from('brands').select('id, company_name, trade_name').ilike('company_name', `%${name}%`).limit(5);
      if (error) throw new Error(error.message);
      return data;
    }
  },
  buscar_colecoes_da_marca: {
    name: 'buscar_colecoes_da_marca',
    description: 'Busca as coleções disponíveis para uma determinada marca.',
    schema: z.object({ brand_id: z.string() }),
    run: async (ctx, { brand_id }) => {
      const { data, error } = await supabaseAdmin.from('collections').select('id, name').eq('brand_id', brand_id).limit(10);
      if (error) throw new Error(error.message);
      return data;
    }
  },

  // --- ORDERS ---
  criar_pedido: {
    name: 'criar_pedido',
    description: 'Prepara a criação de um novo pedido. Requer os IDs do cliente, marca e coleção, além de valor, peças e data.',
    schema: z.object({
      client_id: z.string(),
      brand_id: z.string(),
      collection_id: z.string(),
      order_date: z.string(),
      total_value: z.number(),
      total_pieces: z.number()
    }),
    run: async (ctx, input) => {
      // Return a pending action so the orchestrator asks for confirmation
      return {
        _action: 'CREATE_ORDER',
        payload: {
          ...input,
          user_id: ctx.userId,
          created_by: ctx.userId,
          status: 'Pedido lançado'
        }
      };
    }
  },
  atualizar_pedido: {
    name: 'atualizar_pedido',
    description: 'Prepara a alteração de peças, valor ou status de um pedido existente.',
    schema: z.object({
      order_id: z.string(),
      total_pieces: z.number().optional(),
      total_value: z.number().optional(),
      status: z.string().optional()
    }),
    run: async (ctx, input) => {
      return {
        _action: 'UPDATE_ORDER',
        payload: input
      };
    }
  },
  consultar_pedidos_cliente: {
    name: 'consultar_pedidos_cliente',
    description: 'Consulta os últimos pedidos de um cliente.',
    schema: z.object({ client_id: z.string(), limit: z.number().default(5) }),
    run: async (ctx, { client_id, limit }) => {
      const { data, error } = await withCreatedByAuth(
        supabaseAdmin.from('orders').select('id, internal_number, order_date, total_value, total_pieces, status, brands(company_name), collections(name)').eq('client_id', client_id).order('order_date', { ascending: false }).limit(limit),
        ctx
      );
      if (error) throw new Error(error.message);
      return data;
    }
  },
  consultar_resumo_mes: {
    name: 'consultar_resumo_mes',
    description: 'Consulta o resumo de pedidos do mês (quantidade de peças e valor).',
    schema: z.object({ start_date: z.string(), end_date: z.string() }),
    run: async (ctx, { start_date, end_date }) => {
      const { data, error } = await withCreatedByAuth(
        supabaseAdmin.from('orders').select('total_value, total_pieces').gte('order_date', start_date).lte('order_date', end_date),
        ctx
      );
      if (error) throw new Error(error.message);
      const rows = (data || []) as { total_value: number | null; total_pieces: number | null }[];
      const resumo = rows.reduce<{ valor: number; pecas: number; pedidos: number }>((acc, curr) => ({ 
        valor: acc.valor + (curr.total_value || 0), 
        pecas: acc.pecas + (curr.total_pieces || 0), 
        pedidos: acc.pedidos + 1 
      }), { valor: 0, pecas: 0, pedidos: 0 });
      return resumo;
    }
  },
  
  // --- LEADS ---
  criar_lead: {
    name: 'criar_lead',
    description: 'Prepara a criação de um novo lead.',
    schema: z.object({ name: z.string(), phone: z.string().optional(), status: z.string().optional() }),
    run: async (ctx, input) => {
      return { _action: 'CREATE_LEAD', payload: { ...input, user_id: ctx.userId } };
    }
  },
  registrar_interesse_lead: {
    name: 'registrar_interesse_lead',
    description: 'Adiciona notas/interesse a um lead existente.',
    schema: z.object({ lead_id: z.string(), notes: z.string() }),
    run: async (ctx, input) => {
      return { _action: 'UPDATE_LEAD', payload: input };
    }
  },
};
