 import { useState } from 'react';
 import { useTranslation } from 'react-i18next';
 import { Plus, Search, AlertTriangle, Clock, CheckCircle, Circle } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { TasksList } from './TasksList';
 import { TaskDialog } from './TaskDialog';
 import { useTasks } from '@/hooks/useTasks';
 import { useEmployees } from '@/hooks/useEmployees';

 export function TasksManagement() {
   const { t } = useTranslation();
   const [searchTerm, setSearchTerm] = useState('');
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
   const [statusFilter, setStatusFilter] = useState<string>('all');
   const { tasks, isLoading, createTask, updateTask, deleteTask, getTaskStats } = useTasks();
   const { employees } = useEmployees();

   const stats = getTaskStats();

   const handleAddTask = () => { setSelectedTaskId(null); setIsDialogOpen(true); };
   const handleEditTask = (id: string) => { setSelectedTaskId(id); setIsDialogOpen(true); };

   const filteredTasks = tasks.filter(task => {
     const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
       task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       task.employee?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       task.employee?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
     const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
     return matchesSearch && matchesStatus;
   });

   return (
     <div className="space-y-6">
       <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
         <Card className="border-l-4 border-l-slate-400">
           <CardContent className="pt-4">
             <div className="flex items-center justify-between">
               <div><p className="text-sm text-muted-foreground">{t('tasks.stats.pending')}</p><p className="text-2xl font-bold">{stats.pending}</p></div>
               <Circle className="h-8 w-8 text-slate-400" />
             </div>
           </CardContent>
         </Card>
         <Card className="border-l-4 border-l-blue-500">
           <CardContent className="pt-4">
             <div className="flex items-center justify-between">
               <div><p className="text-sm text-muted-foreground">{t('tasks.stats.inProgress')}</p><p className="text-2xl font-bold">{stats.inProgress}</p></div>
               <Clock className="h-8 w-8 text-blue-500" />
             </div>
           </CardContent>
         </Card>
         <Card className="border-l-4 border-l-emerald-500">
           <CardContent className="pt-4">
             <div className="flex items-center justify-between">
               <div><p className="text-sm text-muted-foreground">{t('tasks.stats.completed')}</p><p className="text-2xl font-bold">{stats.completed}</p></div>
               <CheckCircle className="h-8 w-8 text-emerald-500" />
             </div>
           </CardContent>
         </Card>
         <Card className="border-l-4 border-l-orange-500">
           <CardContent className="pt-4">
             <div className="flex items-center justify-between">
               <div><p className="text-sm text-muted-foreground">{t('tasks.stats.urgent')}</p><p className="text-2xl font-bold">{stats.urgent}</p></div>
               <AlertTriangle className="h-8 w-8 text-orange-500" />
             </div>
           </CardContent>
         </Card>
         <Card className="border-l-4 border-l-red-500">
           <CardContent className="pt-4">
             <div className="flex items-center justify-between">
               <div><p className="text-sm text-muted-foreground">{t('tasks.stats.overdue')}</p><p className="text-2xl font-bold">{stats.overdue}</p></div>
               <AlertTriangle className="h-8 w-8 text-red-500" />
             </div>
           </CardContent>
         </Card>
       </div>

       <Card>
         <CardHeader>
           <div className="flex items-center justify-between">
             <div>
               <CardTitle>{t('tasks.management')}</CardTitle>
               <CardDescription>{t('tasks.totalTasks', { count: tasks.length })}</CardDescription>
             </div>
             <Button onClick={handleAddTask} className="bg-emerald-600 hover:bg-emerald-700">
               <Plus className="h-4 w-4 mr-2" />{t('tasks.new')}
             </Button>
           </div>
         </CardHeader>
         <CardContent>
           <div className="flex items-center gap-4 mb-6">
             <div className="relative flex-1">
               <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
               <Input placeholder={t('common.search')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
             </div>
             <Tabs value={statusFilter} onValueChange={setStatusFilter}>
               <TabsList>
                 <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
                 <TabsTrigger value="pending">{t('tasks.stats.pending')}</TabsTrigger>
                 <TabsTrigger value="in_progress">{t('tasks.stats.inProgress')}</TabsTrigger>
                 <TabsTrigger value="completed">{t('tasks.stats.completed')}</TabsTrigger>
               </TabsList>
             </Tabs>
           </div>
           <TasksList tasks={filteredTasks} isLoading={isLoading} onEdit={handleEditTask} onDelete={deleteTask} onStatusChange={(id, status) => updateTask(id, { status })} />
         </CardContent>
       </Card>

       <TaskDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} taskId={selectedTaskId} tasks={tasks} employees={employees} onSave={selectedTaskId ? (data) => updateTask(selectedTaskId, data) : createTask} />
     </div>
   );
 }