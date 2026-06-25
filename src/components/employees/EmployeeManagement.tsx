import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Filter, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmployeesList } from './EmployeesList';
import { EmployeeDialog } from './EmployeeDialog';
import { useEmployees } from '@/hooks/useEmployees';

export function EmployeeManagement() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const { employees, isLoading, createEmployee, updateEmployee, deleteEmployee } = useEmployees();

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setIsDialogOpen(true);
  };

  const handleEditEmployee = (id: string) => {
    setSelectedEmployee(id);
    setIsDialogOpen(true);
  };

  const filteredEmployees = employees.filter(emp => 
    `${emp.first_name} ${emp.last_name} ${emp.employee_number} ${emp.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {t('employees.management')}
              </CardTitle>
              <CardDescription>
                {employees.length} {t('nav.employees').toLowerCase()} {t('common.registered')}
              </CardDescription>
            </div>
            <Button onClick={handleAddEmployee} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              {t('employees.new')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon"><Download className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon"><Upload className="h-4 w-4" /></Button>
          </div>
          <EmployeesList employees={filteredEmployees} isLoading={isLoading} onEdit={handleEditEmployee} onDelete={deleteEmployee} />
        </CardContent>
      </Card>
      <EmployeeDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} employeeId={selectedEmployee} employees={employees} onSave={selectedEmployee ? updateEmployee : createEmployee} />
    </div>
  );
}