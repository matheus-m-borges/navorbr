 import { createFileRoute, useParams } from '@tanstack/react-router';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { ArrowLeft, ShieldCheck, ShieldAlert, Plus, Trash2 } from 'lucide-react';
 import { Link } from '@tanstack/react-router';

 export const Route = createFileRoute('/_authenticated/(saas)/admin/entitlements/$accountId')({
   component: SubscriberEntitlementDetail,
 });

 function SubscriberEntitlementDetail() {
   const { accountId } = useParams({ from: '/_authenticated/(saas)/admin/entitlements/$accountId' });

   return (
     <div className="space-y-6 p-6">
       <div className="flex items-center gap-4">
         <Button variant="ghost" size="icon" asChild>
           <Link to="/admin/entitlements">
             <ArrowLeft className="h-4 w-4" />
           </Link>
         </Button>
         <div>
           <h1 className="text-2xl font-bold tracking-tight">Detalhes do Assinante</h1>
           <p className="text-sm text-muted-foreground font-mono">{accountId}</p>
         </div>
       </div>

       <div className="grid gap-6 md:grid-cols-2">
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <ShieldCheck className="h-5 w-5 text-green-600" />
               Capabilities Efetivas
             </CardTitle>
             <CardDescription>Permissões ativas via plano ou override</CardDescription>
           </CardHeader>
           <CardContent>
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Capability</TableHead>
                   <TableHead>Fonte</TableHead>
                   <TableHead className="text-right">Status</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 <TableRow>
                   <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                     Carregue os dados reais conectando ao banco.
                   </TableCell>
                 </TableRow>
               </TableBody>
             </Table>
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <CardTitle className="flex items-center justify-between">
               <span className="flex items-center gap-2">
                 <ShieldAlert className="h-5 w-5 text-blue-600" />
                 Overrides Manuais
               </span>
               <Button size="sm" variant="outline">
                 <Plus className="mr-2 h-3 w-3" /> Novo Override
               </Button>
             </CardTitle>
             <CardDescription>Grant/Deny individual com motivo obrigatório</CardDescription>
           </CardHeader>
           <CardContent>
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Capability</TableHead>
                   <TableHead>Ação</TableHead>
                   <TableHead>Motivo</TableHead>
                   <TableHead className="text-right">Remover</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 <TableRow>
                   <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                     Nenhum override registrado.
                   </TableCell>
                 </TableRow>
               </TableBody>
             </Table>
           </CardContent>
         </Card>
       </div>

       <Card>
         <CardHeader>
           <CardTitle>Audit Log de Entitlements</CardTitle>
           <CardDescription>Histórico imutável de alterações de permissão</CardDescription>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Data</TableHead>
                 <TableHead>Operador</TableHead>
                 <TableHead>Tipo</TableHead>
                 <TableHead>Entidade</TableHead>
                 <TableHead>Motivo</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               <TableRow>
                 <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                   Sem registros de auditoria para esta conta.
                 </TableCell>
               </TableRow>
             </TableBody>
           </Table>
         </CardContent>
       </Card>
     </div>
   );
 }
