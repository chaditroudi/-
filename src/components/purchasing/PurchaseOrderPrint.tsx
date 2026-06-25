import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PurchaseOrder } from '@/types/purchasing';

export const PurchaseOrderPrint = ({ order }: { order: PurchaseOrder }) => {
  return (
    <div className="p-8 text-black bg-white">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">BON DE COMMANDE</h1>
          <p className="text-sm">N°: <span className="font-mono">{order.order_number}</span></p>
          <p className="text-sm">
            Date: {format(new Date(order.order_date), 'dd/MM/yyyy', { locale: fr })}
          </p>
        </div>

        <div className="text-right text-sm">
          <p className="font-semibold">Fournisseur</p>
          <p>{order.supplier?.name || '-'}</p>
          {order.supplier?.address && <p>{order.supplier.address}</p>}
          {order.supplier?.phone && <p>Tél: {order.supplier.phone}</p>}
          {order.supplier?.email && <p>Email: {order.supplier.email}</p>}
        </div>
      </div>

      <hr className="my-6" />

      <div className="text-sm space-y-1">
        {order.expected_delivery_date && (
          <p>
            Livraison prévue:{' '}
            {format(new Date(order.expected_delivery_date), 'dd/MM/yyyy', { locale: fr })}
          </p>
        )}
        {order.payment_terms && <p>Conditions paiement: {order.payment_terms}</p>}
        {order.delivery_site && <p>Site de livraison: {order.delivery_site}</p>}
        {order.delivery_address && <p>Adresse livraison: {order.delivery_address}</p>}
        {order.incoterm && <p>Incoterm: {order.incoterm}</p>}
        {order.supplier_reference && <p>Réf. fournisseur: {order.supplier_reference}</p>}
      </div>

      <hr className="my-6" />

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Description</th>
            <th className="text-right py-2">Qté</th>
            <th className="text-right py-2">PU</th>
            <th className="text-right py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.lines?.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="py-2">
                {l.description}{' '}
                {l.material?.code ? <span className="text-gray-600">({l.material.code})</span> : null}
              </td>
              <td className="py-2 text-right">{l.quantity} {l.unit}</td>
              <td className="py-2 text-right">{l.unit_price.toFixed(3)} TND</td>
              <td className="py-2 text-right">{l.total_price.toFixed(3)} TND</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-72 text-sm">
          <div className="flex justify-between">
            <span>Sous-total</span>
            <span>{order.subtotal.toFixed(3)} TND</span>
          </div>
          {order.tax_amount > 0 && (
            <div className="flex justify-between">
              <span>TVA</span>
              <span>{order.tax_amount.toFixed(3)} TND</span>
            </div>
          )}
          <div className="border-t my-2" />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>{order.total_amount.toFixed(3)} {order.currency}</span>
          </div>
        </div>
      </div>

      {order.notes && (
        <>
          <hr className="my-6" />
          <div className="text-sm">
            <p className="font-semibold">Notes</p>
            <p>{order.notes}</p>
          </div>
        </>
      )}

      <div className="mt-10 text-xs text-gray-700 flex justify-between">
        <p>Créé par: {order.created_by || 'N/A'}</p>
        <p>Généré le: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
      </div>
    </div>
  );
};
