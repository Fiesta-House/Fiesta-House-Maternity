import api from './apiInstance';

import { API_BASE_URL as API_BASE } from '../config';

export interface Invoice {
    id: string;
    invoiceNumber: string;
    bookingId: string;
    customerId: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    depositPaid: number;
    balanceDue: number;
    status: 'pending' | 'sent' | 'paid';
    sentAt?: string;
    paidAt?: string;
    pdfUrl?: string;
    createdAt: string;
    customer: {
        name: string;
        phone: string;
    };
    booking?: {
        id: string;
        service: string;
        dateTime: string;
    };
}

export const invoicesApi = {
    generateInvoice: async (bookingId: string): Promise<Invoice> => {
        const { data } = await api.post(`${API_BASE}/api/invoices/generate/${bookingId}`);
        return data;
    },

    sendInvoice: async (invoiceId: string): Promise<void> => {
        await api.post(`${API_BASE}/api/invoices/send/${invoiceId}`);
    },

    getInvoicesByBooking: async (bookingId: string): Promise<Invoice[]> => {
        const { data } = await api.get(`${API_BASE}/api/invoices/booking/${bookingId}`);
        return data;
    },

    getInvoicesByCustomer: async (customerId: string): Promise<Invoice[]> => {
        const { data } = await api.get(`${API_BASE}/api/invoices/customer/${customerId}`);
        return data;
    },

    getAllInvoices: async (): Promise<Invoice[]> => {
        const { data } = await api.get(`${API_BASE}/api/invoices`);
        return data;
    },

        downloadInvoice: async (invoiceId: string): Promise<void> => {
        const response = await api.get(
            `${API_BASE}/api/invoices/download/${invoiceId}`,
            { responseType: 'blob' }
        );

        const disposition = response.headers['content-disposition'] as string | undefined;
        let filename = `${invoiceId}.pdf`;

        if (disposition) {
            const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i);
            const regularFilename = disposition.match(/filename="?([^";]+)"?/i);

            const suppliedFilename = encodedFilename?.[1]
                ? decodeURIComponent(encodedFilename[1])
                : regularFilename?.[1];

            if (suppliedFilename) {
                filename = suppliedFilename;
            }
        }

        const blobUrl = window.URL.createObjectURL(
            new Blob([response.data], { type: 'application/pdf' })
        );

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
        }, 1000);
    },
};
