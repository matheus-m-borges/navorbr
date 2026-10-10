 import { createFileRoute } from '@tanstack/react-router';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Badge } from '@/components/ui/badge';
 import { Plus, Package, Box } from 'lucide-react';

 export const Route = createFileRoute('/_authenticated/(saas)/admin/catalog/modules')({
   component: CatalogModulesPage,
 });

 function CatalogModulesPage() {
   return (
     <div className="space-y-6 p-6">
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-2xl font-bold tracking-tight">Catálogo de Módulos e Blocos</h1>
           <p className="text-muted-foreground">Gerencie a hierarquia funcional dos produtos NAVOR.</p>
         </div>
         <Button size="sm">
           <Plus className="mr-2 h-4 w-4" /> Novo Módulo
         </Button>
       </div>

       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Package className="h-5 w-5" /> System Modules
           </CardTitle>
           <CardDescription>Módulos canônicos disponíveis por produto</CardDescription>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Key</TableHead>
                 <TableHead>Nome</TableHead>
                 <TableHead>Produto</TableHead>
                 <TableHead>Status</TableHead>
                 <TableHead className="text-right">Ações</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               <TableRow>
                 <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                   Carregue os módulos reais conectando ao banco.
                 </TableCell>
               </TableRow>
             </TableBody>
           </Table>
         </CardContent>
       </Card>

       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Box className="h-5 w-5" /> System Blocks
           </CardTitle>
           <CardDescription>Blocos funcionais vinculados a módulos</CardDescription>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Key</TableHead>
                 <TableHead>Nome</TableHead>
                 <TableHead>Módulo Pai</TableHead>
                 <TableHead>Ordem</TableHead>
                 <TableHead className="text-right">Ações</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               <TableRow>
                 <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                   Nenhum bloco registrado.
                 </TableCell>
               </TableRow>
             </TableBody>
           </Table>
         </CardContent>
       </Card>
     </div>
   );
 }
