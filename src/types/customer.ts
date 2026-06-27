import type { BuyerCountry, ContractLanguage } from './exportOrders';

export interface Customer {
  id: string;
  code: string;
  name: string;
  country: BuyerCountry;
  specific_country?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  preferred_language: ContractLanguage;
  preferred_incoterms?: string | null;
  preferred_currency: string;
  port_of_destination?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CustomerInput = Omit<Customer, 'id' | 'code' | 'created_at' | 'updated_at'>;
