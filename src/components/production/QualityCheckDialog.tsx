import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddQualityCheck, useQualityChecks } from '@/hooks/useProduction';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface QualityCheckDialogProps { open: boolean; onOpenChange: (open: boolean) => void; stepId: string; stepName: string; }

export const QualityCheckDialog = ({ open, onOpenChange, stepId, stepName }: QualityCheckDialogProps) => {
  const { t } = useTranslation();
  const [checkType, setCheckType] = useState('visual');
  const [parameterName, setParameterName] = useState('');
  const [expectedValue, setExpectedValue] = useState('');
  const [actualValue, setActualValue] = useState('');
  const [isPassed, setIsPassed] = useState<string>('');
  const [checkedBy, setCheckedBy] = useState('');
  const [notes, setNotes] = useState('');

  const addCheck = useAddQualityCheck();
  const { data: existingChecks = [] } = useQualityChecks(stepId);

  const checkTypeKeys = ['visual', 'weight', 'humidity', 'temperature', 'caliber', 'color', 'defects', 'packaging', 'other'] as const;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCheck.mutate({
      production_step_id: stepId, check_type: checkType, parameter_name: parameterName,
      expected_value: expectedValue || undefined, actual_value: actualValue || undefined,
      is_passed: isPassed === '' ? undefined : isPassed === 'true', checked_by: checkedBy || undefined, notes: notes || undefined
    }, { onSuccess: () => { setCheckType('visual'); setParameterName(''); setExpectedValue(''); setActualValue(''); setIsPassed(''); setCheckedBy(''); setNotes(''); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('production.qualityCheck')} - {stepName}</DialogTitle></DialogHeader>
        {existingChecks.length > 0 && (
          <div className="space-y-2 mb-4">
            <h4 className="font-medium text-sm">{t('production.checksPerformed')}:</h4>
            <div className="space-y-2">
              {existingChecks.map((check) => (
                <div key={check.id} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    {check.is_passed === true && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {check.is_passed === false && <XCircle className="h-4 w-4 text-red-500" />}
                    {check.is_passed === null && <Clock className="h-4 w-4 text-gray-400" />}
                    <span className="font-medium">{check.parameter_name}</span>
                    <Badge variant="outline">{check.check_type}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {check.actual_value && <span>{t('production.value')}: {check.actual_value}</span>}
                    {check.checked_by && <span>{t('common.by')}: {check.checked_by}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('production.checkType')} *</Label>
              <Select value={checkType} onValueChange={setCheckType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {checkTypeKeys.map((key) => (<SelectItem key={key} value={key}>{t(`production.checkTypes.${key}`)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('production.parameter')} *</Label><Input value={parameterName} onChange={(e) => setParameterName(e.target.value)} required /></div>
            <div><Label>{t('production.expectedValue')}</Label><Input value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} /></div>
            <div><Label>{t('production.measuredValue')}</Label><Input value={actualValue} onChange={(e) => setActualValue(e.target.value)} /></div>
            <div>
              <Label>{t('production.result')}</Label>
              <Select value={isPassed} onValueChange={setIsPassed}>
                <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{t('production.compliant')}</SelectItem>
                  <SelectItem value="false">{t('production.nonCompliant')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('production.checkedBy')}</Label><Input value={checkedBy} onChange={(e) => setCheckedBy(e.target.value)} placeholder={t('production.controllerName')} /></div>
            <div className="col-span-2"><Label>{t('common.notes')}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('production.remarksObservations')} rows={2} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
            <Button type="submit" disabled={addCheck.isPending}>{addCheck.isPending ? t('common.saving') : t('production.addCheck')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};