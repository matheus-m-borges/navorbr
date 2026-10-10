 import { createFileRoute, useParams } from '@tanstack/react-router';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Badge } from '@/components/ui/badge';
 import { ArrowLeft, Plus, Trash2, DollarSign, Gauge } from 'lucide-react';
 import { Link } from '@tanstack/react-router';

 export const Route = createFileRoute('/_authenticated/(saas)/admin/plans/$planId/addons')({
   component: PlanAddonsPage,
 });

 function PlanAddonsPage() {
   const { planId } = useParams({ from: '/_authenticated/(saas)/admin/plans/$planId/addons' });

   return (
     <div className="space-y-6 p-6">
       <div className="flex items-center gap-4">
         <Button variant="ghost" size="icon" asChild>
           <Link to="/admin/plans">
             <ArrowLeft className="h-4 w-4" />
           </Link>
         </Button>
         <div>
           <h1 className="text-2xl font-bold tracking-tight">Gestão de Add-ons e Limites</h1>
           <p className="text-sm text-muted-foreground font-mono">Plano: {planId}</p>
         </div>
       </div>

       <div className="grid gap-6 md:grid-cols-2">
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center justify-between">
               <span className="flex items-center gap-2">
                 <DollarSign className="h-5 w-5 text-green-600" />
                 Add-ons Disponíveis
               </span>
               <Button size="sm" variant="outline">
                 <Plus className="mr-2 h-3 w-3" /> Novo Add-on
               </Button>
             </CardTitle>
             <CardDescription>Recursos extras que podem ser adquiridos separadamente</CardDescription>
           </CardHeader>
           <CardContent>
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Add-on</TableHead>
                   <TableHead>Preço</TableHead>
                   <TableHead>Ciclo</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 <TableRow>
                   <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                     Nenhum add-on configurado para este plano.
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
                 <Gauge className="h-5 w-5 text-blue-600" />
                 Limites de Uso
               </span>
               <Button size="sm" variant="outline">
                 <Plus className="mr-2 h-3 w-3" /> Novo Limite
               </Button>
             </CardTitle>
             <CardDescription>Quotas e rate limits aplicados ao plano</CardDescription>
           </CardHeader>
           <CardContent>
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Chave</TableHead>
                   <TableHead>Valor</TableHead>
                   <TableHead>Unidade</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 <TableRow>
                   <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                     Nenhum limite configurado.
                   </TableCell>
                 </TableRow>
               </TableBody>
             </Table>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }
