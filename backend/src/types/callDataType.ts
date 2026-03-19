export enum Intents {
  selling = "selling",
  callback = "callback",
  not_interested = "not_interested",
  remove = "remove",
  not_owner = "not_owner",
}

export interface callData {
  id: string;
  intent: Intents;
  price_range?: string;
  timing?: string;
  condition?: string;
  notes?: string;
  updatedAt: string;
  address: string;
  name: string;
  duration: string;
}

export interface callMetaData {
  callId: string;
  phone: string;
  name: string;
  status: string;
  duration: string;
}
