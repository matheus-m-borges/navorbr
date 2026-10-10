 import { createFileRoute } from '@tanstack/react-router';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Search, ShieldCheck, ShieldAlert, UserCog } from 'lucide-react';
 import { useState } from 'react';

 export const Route = createFileRoute('/_authenticated/(saas)/admin/entitlements/')({
   component: EntitlementsAdminPage,
 });

 function EntitlementsAdminPage() {
   const [search, setSearch] = useState('');

   return (
     <div className="space-y-6 p-6">
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-2xl font-bold tracking-tight">Gestão de Entitlements 360°</h1>
           <p className="text-muted-foreground">
             Visualize e gerencie permissões, overrides e capacidades por assinante.
           </p>
         </div>
         <Button variant="outline" size="sm">
           <UserCog className="mr-2 h-4 w-4" />
           Auditoria de Alterações
         </Button>
       </div>

       <Card>
         <CardHeader>
           <CardTitle>Assinantes Ativos</CardTitle>
           <CardDescription>
             Busque por nome, email ou ID da conta para inspecionar entitlements efetivos.
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="flex items-center gap-2">
             <Search className="h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Buscar assinante..."
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="max-w-sm"
             />
           </div>

           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Conta</TableHead>
                 <TableHead>Produto</TableHead>
                 <TableHead>Plano</TableHead>
                 <TableHead>Status</TableHead>
                 <TableHead>Overrides</TableHead>
                 <TableHead className="text-right">Ações</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               <TableRow>
                 <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                   Conecte o banco de dados para visualizar assinantes reais.
                   <br />
                   <span className="text-xs">Nenhum dado fictício é exibido nesta interface.</span>
                 </TableCell>
               </TableRow>
             </TableBody>
           </Table>
         </CardContent>
       </Card>

       <div className="grid gap-4 md:grid-cols-3">
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Capabilities Ativas</CardTitle>
             <ShieldCheck className="h-4 w-4 text-green-600" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">--</div>
             <p className="text-xs text-muted-foreground">Total de permissões concedidas via plano</p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Overrides Aplicados</CardTitle>
             <UserCog className="h-4 w-4 text-blue-600" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">--</div>
             <p className="text-xs text-muted-foreground">Grant/Deny manuais ativos</p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Bloqueios Efetivos</CardTitle>
             <ShieldAlert className="h-4 w-4 text-red-600" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">--</div>
             <p className="text-xs text-muted-foreground">Capabilities negadas por override ou limite</p>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }
