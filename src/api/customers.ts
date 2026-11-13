
import api from './apiInstance';

export interface Customer {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    platform?: string | null;
    whatsappId?: string | null;
    instagramId?: string | null;
    messengerId?: string | null;

    // Instagram profile information
    instagramUsername?: string | null;
    instagramProfileName?: string | null;
    instagramProfilePic?: string | null;

    createdAt: string;
    updatedAt: string;
    lastActivityAt?: string;
    lastMessagePreview?: string | null;
    lastMessageDirection?: 'inbound' | 'outbound' | null;
    lastMessagePlatform?: string | null;
    aiEnabled: boolean;
    notes?: string;
}

export interface Message {
    id: string;
    content: string;
    direction: 'inbound' | 'outbound';
    platform: string;
    timestamp: string;
    createdAt: string;
    customerId: string;
}

export const getCustomers = async (
    params?: { segment?: 'all' | 'online' | 'today' | 'yesterday' }
): Promise<Customer[]> => {
    const response = await api.get('/customers', { params });
    return response.data;
};

export interface CustomerActivitySummary {
    onlineNow: number;
    activeToday: number;
    activeYesterday: number;
    newToday: number;
    pausedAi: number;
    totalCustomers: number;
}

export const getCustomerActivitySummary = async (): Promise<CustomerActivitySummary> => {
    const response = await api.get('/customers/stats/activity-summary');
    return response.data;
};

export const getCustomer = async (id: string): Promise<Customer> => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
};

export const getCustomerMessages = async (customerId: string): Promise<Message[]> => {
    const response = await api.get(`/messages/${customerId}`);
    return response.data;
};

export const updateCustomer = async (
    id: string,
    data: Partial<Customer>
): Promise<Customer> => {
    const response = await api.patch(`/customers/${id}`, data);
    return response.data;
};

export const toggleCustomerAi = async (
    id: string,
    enabled: boolean
): Promise<Customer> => {
    const response = await api.post(`/customers/${id}/toggle-ai`, { enabled });
    return response.data;
};

export const sendPhotoLink = async (customerId: string, link: string): Promise<void> => {
    await api.post(`/customers/${customerId}/send-photo-link`, { link });
};

export interface PhotoLink {
    id: string;
    link: string;
    sentAt: string;
    customerId: string;
}

export const getCustomerPhotoLinks = async (customerId: string): Promise<PhotoLink[]> => {
    const response = await api.get(`/customers/${customerId}/photo-links`);
    return response.data;
};

export interface SessionNote {
    id: string;
    customerId: string;
    type: 'external_people' | 'external_items' | 'special_request' | 'action_request' | 'other';
    category: 'client_wish' | 'operational' | 'addon' | 'accessibility' | 'companion' | 'styling' | 'delivery' | 'other';
    priority: 'normal' | 'high' | 'urgent';
    actionStatus: 'open' | 'acknowledged' | 'ready' | 'completed';
    items: string[];
    description: string | null;
    bookingId: string | null;
    booking?: {
        id: string;
        service: string;
        dateTime: string;
        status: string;
    };
    status: 'pending' | 'reviewed' | 'approved' | 'declined';
    adminNotes: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    sourceMessage: string | null;
    platform: string | null;
    createdAt: string;
    updatedAt: string;
}

export const getCustomerSessionNotes = async (customerId: string): Promise<SessionNote[]> => {
    const response = await api.get(`/customers/${customerId}/session-notes`);
    return response.data;
};

export const updateSessionNote = async (
    noteId: string,
    data: {
        status?: string;
        adminNotes?: string;
        reviewedBy?: string;
        category?: string;
        priority?: string;
        actionStatus?: string;
    }
): Promise<SessionNote> => {
    const response = await api.patch(`/customers/session-notes/${noteId}`, data);
    return response.data;
};

export interface SentimentScoreEntry {
    id: string;
    score: number;
    sentiment: string;
    confidence: number;
    createdAt: string;
}

export const getCustomerSentiment = async (customerId: string): Promise<SentimentScoreEntry[]> => {
    const response = await api.get(`/customers/${customerId}/sentiment`);
    return response.data;
};

export interface AverageActivity {
    avgMessages: number;
    avgBookings: number;
}

export const getAverageActivity = async (): Promise<AverageActivity> => {
    const response = await api.get('/customers/stats/averages');
    return response.data;
};
