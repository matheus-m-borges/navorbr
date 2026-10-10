// Types for WhatsAble / Notifyer Official API

export interface WhatsAbleSendMessagePayload {
  recipient_id?: string;
  phone_number?: string;
  message?: string;
  template_id?: string;
  template_variables?: Record<string, string>;
  schedule_timestamp?: number; // Milliseconds since Unix epoch (0 = immediate)
  global_label?: string[]; // Array of strings (NOT numeric IDs)
  media_url?: string;
}

export interface WhatsAbleSendResponse {
  success: boolean;
  message_id?: string;
  error?: string;
  status_code?: number;
  data?: any;
}

export interface WhatsAbleRecipient {
  id: string;
  phone_number: string;
  name?: string;
  global_label?: string[];
  custom_fields?: Record<string, any>;
  last_inbound_at?: number;
  is_within_24h?: boolean;
}

export interface WhatsAbleWebhookPayload {
  event?: string;
  message_id?: string;
  id?: string;
  from?: string;
  sender_phone?: string;
  phone_number?: string;
  text?: string;
  body?: string;
  message?: {
    id?: string;
    text?: string;
    body?: string;
    from?: string;
  };
  timestamp?: number;
  type?: string;
}
