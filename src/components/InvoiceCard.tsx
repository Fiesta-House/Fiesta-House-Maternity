import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    FileText,
    Download,
    Send,
    Calendar,
    DollarSign,
    Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { invoicesApi, Invoice } from '../api/invoices';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface InvoiceCardProps {
    customerId: string;
    invoices: Invoice[];
    isLoading: boolean;
    onRefresh: () => void;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({
    customerId,
    invoices,
    isLoading,
    onRefresh,
}) => {
    const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
    const [invoiceToSend, setInvoiceToSend] = useState<Invoice | null>(null);

    const handleSendInvoice = async (invoice: Invoice) => {
        setSendingInvoiceId(invoice.id);
        try {
            await invoicesApi.sendInvoice(invoice.id);
            toast.success(`Invoice ${invoice.invoiceNumber} sent successfully via WhatsApp!`);
            onRefresh();
        } catch (error) {
            console.error('Error sending invoice:', error);
            toast.error('Failed to send invoice. Please try again.');
        } finally {
            setSendingInvoiceId(null);
            setInvoiceToSend(null);
        }
    };

        const handleDownloadInvoice = async (invoice: Invoice) => {
        try {
            await invoicesApi.downloadInvoice(invoice.id);
            toast.success(`Invoice ${invoice.invoiceNumber} downloaded`);
        } catch (error) {
            console.error('Error downloading invoice:', error);
            toast.error('Failed to download invoice. Please try again.');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid':
                return 'bg-green-500 hover:bg-green-600';
            case 'sent':
                return 'bg-blue-500 hover:bg-blue-600';
            case 'pending':
                return 'bg-orange-500 hover:bg-orange-600';
            default:
                return 'bg-gray-500 hover:bg-gray-600';
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Invoices
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-24">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                    ) : invoices?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                            <FileText className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No invoices yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {invoices?.map((invoice) => (
                                <div
                                    key={invoice.id}
                                    className="p-4 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border border-border hover:shadow-md transition-all duration-200"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-sm text-primary">
                                                    {invoice.invoiceNumber}
                                                </p>
                                                <Badge className={getStatusColor(invoice.status)}>
                                                    {invoice.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {invoice.booking?.service || 'Service'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Total</p>
                                                <p className="text-sm font-semibold">
                                                    KSH {invoice.total.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 p-2 rounded bg-background/50">
                                            <DollarSign className="h-3 w-3 text-orange-500" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Balance</p>
                                                <p className="text-sm font-semibold text-orange-600">
                                                    KSH {invoice.balanceDue.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mb-3">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                        <p className="text-xs text-muted-foreground">
                                            Created {format(new Date(invoice.createdAt), 'MMM d, yyyy')}
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 gap-2"
                                            onClick={() => handleDownloadInvoice(invoice)}
                                        >
                                            <Download className="h-3 w-3" />
                                            Download
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="flex-1 gap-2"
                                            onClick={() => setInvoiceToSend(invoice)}
                                            disabled={sendingInvoiceId === invoice.id}
                                        >
                                            {sendingInvoiceId === invoice.id ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="h-3 w-3" />
                                                    Send via WhatsApp
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Confirmation Dialog */}
            <AlertDialog open={!!invoiceToSend} onOpenChange={() => setInvoiceToSend(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Send Invoice via WhatsApp?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will send invoice <strong>{invoiceToSend?.invoiceNumber}</strong> as a PDF
                            document to the customer's WhatsApp number.
                            <br />
                            <br />
                            <strong>Balance Due:</strong> KSH {invoiceToSend?.balanceDue.toLocaleString()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => invoiceToSend && handleSendInvoice(invoiceToSend)}
                        >
                            Send Invoice
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default InvoiceCard;
