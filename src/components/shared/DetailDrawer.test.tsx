import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailDrawer, DetailSection, DetailField } from './DetailDrawer';

describe('DetailDrawer', () => {
  it('renders header, body and footer when open', () => {
    render(
      <DetailDrawer
        open
        onOpenChange={() => {}}
        eyebrow="Lot de stock"
        title="LOT-001"
        subtitle="Dattes Deglet Nour"
        footer={<button>Transférer</button>}
      >
        <DetailSection title="Détails">
          <DetailField label="Quantité">120 kg</DetailField>
        </DetailSection>
      </DetailDrawer>,
    );

    expect(screen.getByText('Lot de stock')).toBeInTheDocument();
    expect(screen.getByText('LOT-001')).toBeInTheDocument();
    expect(screen.getByText('Dattes Deglet Nour')).toBeInTheDocument();
    expect(screen.getByText('Quantité')).toBeInTheDocument();
    expect(screen.getByText('120 kg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transférer' })).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <DetailDrawer open={false} onOpenChange={() => {}} title="Hidden">
        <p>secret body</p>
      </DetailDrawer>,
    );
    expect(screen.queryByText('secret body')).toBeNull();
  });

  it('calls onOpenChange(false) when the built-in close is used', () => {
    const onOpenChange = vi.fn();
    render(
      <DetailDrawer open onOpenChange={onOpenChange} title="LOT-001">
        <p>body</p>
      </DetailDrawer>,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
