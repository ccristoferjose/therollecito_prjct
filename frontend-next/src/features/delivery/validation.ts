import { z } from 'zod';
import type { DeliveryAddressInput } from '@/features/delivery/types';

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

/** Same rules the backend enforces on POST /delivery/quote. */
const addressSchema = z.object({
  streetAddress: z.string().trim().min(3, 'Enter a street address.').max(255, 'Street address is too long.'),
  apartment: z.string().trim().max(100, 'Apartment / unit is too long.'),
  city: z.string().trim().min(2, 'Enter a city.').max(100, 'City is too long.'),
  state: z.enum(US_STATES, { error: 'Choose a state.' }),
  zipCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code.'),
});

export type AddressErrors = Partial<Record<keyof DeliveryAddressInput, string>>;

export function validateAddress(address: DeliveryAddressInput): AddressErrors {
  const result = addressSchema.safeParse(address);
  if (result.success) return {};
  const errors: AddressErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof DeliveryAddressInput;
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** US phone: 10 digits (optionally with +1). The courier calls this number. */
export function isValidDeliveryPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}
