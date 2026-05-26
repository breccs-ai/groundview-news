'use client';

import { useContext } from 'react';
import { SubscriptionContext, type SubscriptionContextValue } from '@/components/SubscriptionProvider';

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}
