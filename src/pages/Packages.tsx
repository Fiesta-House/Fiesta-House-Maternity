import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/api/apiInstance';
import { API_BASE_URL as API_BASE } from '@/config';
import { Plus, Pencil, Trash2, Camera, Clock3, Images, Shirt, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { getPackageColor } from '@/utils/packageColors';

interface Package {
  id: string;
  name: string;
  type: string;
  price: number;
  deposit: number;
  duration: string;
  images: number;
  makeup: boolean;
  outfits: number;
  styling: boolean;
  photobook: boolean;
  photobookSize?: string;
  mount: boolean;
  balloonBackdrop: boolean;
  wig: boolean;
  notes?: string;
}

const emptyPackage: Partial<Package> = {
  name: '',
  type: 'studio',
  price: 0,
  deposit: 2000,
  duration: '',
  images: 0,
  makeup: false,
  outfits: 0,
  styling: false,
  photobook: false,
  photobookSize: '',
  mount: false,
  balloonBackdrop: false,
  wig: false,
  notes: '',
};

const money = (value?: number) =>
  `KSh ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

function inclusionItems(pkg: Package): string[] {
  const items: string[] = [];
  if (pkg.makeup) items.push('Professional makeup');
  if (pkg.styling) items.push('Outfit styling');
  if (pkg.photobook) items.push(`Photobook${pkg.photobookSize ? ` · ${pkg.photobookSize}` : ''}`);
  if (pkg.mount) items.push('Fine-art mount');
  if (pkg.balloonBackdrop) items.push('Balloon + flower backdrop');
  if (pkg.wig) items.push('Styled wig');
  return items;
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [editing, setEditing] = useState<Partial<Package> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await api.get(`${API_BASE}/api/bookings/packages`);
      const data = Array.isArray(res.data) ? res.data : [];
      data.sort((a: Package, b: Package) => Number(a.price || 0) - Number(b.price || 0));
      setPackages(data);
    } catch (error) {
      console.error('Failed to load packages:', error);
      setErrorMessage('Packages could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPackages();
  }, [fetchPackages]);

  const packageStats = useMemo(() => {
    if (packages.length === 0) return { count: 0, lowestPrice: 0, highestPrice: 0 };
    const prices = packages.map((pkg) => Number(pkg.price || 0));
    return {
      count: packages.length,
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
    };
  }, [packages]);

  const handleEdit = (pkg: Package) => {
    setEditing({ ...pkg });
    setIsNew(false);
  };

  const handleAdd = () => {
    setEditing({ ...emptyPackage });
    setIsNew(true);
  };

  const closeEditor = () => {
    if (!saving) setEditing(null);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    const nextValue = type === 'number' ? (value === '' ? '' : Number(value)) : value;
    setEditing((current) => current ? { ...current, [name]: nextValue } : current);
  };

  const setField = (name: keyof Package, value: string | number | boolean) => {
    setEditing((current) => current ? { ...current, [name]: value } : current);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || saving) return;

    const payload = {
      ...editing,
      name: editing.name?.trim() || '',
      price: Number(editing.price || 0),
      deposit: Number(editing.deposit || 0),
      images: Number(editing.images || 0),
      outfits: Number(editing.outfits || 0),
    };

    if (!payload.name) return;
    if ([payload.price, payload.deposit, payload.images, payload.outfits].some((value) => !Number.isFinite(value) || value < 0)) {
      setErrorMessage('Price, deposit, images and outfits must be valid non-negative numbers.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      if (isNew) {
        await api.post(`${API_BASE}/api/bookings/packages`, payload);
      } else if (editing.id) {
        await api.put(`${API_BASE}/api/bookings/packages/${editing.id}`, payload);
      } else {
        throw new Error('Package ID is missing.');
      }
      setEditing(null);
      await fetchPackages();
    } catch (error: any) {
      console.error('Failed to save package:', error);
      setErrorMessage(error?.response?.data?.message || error?.message || 'The package could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setErrorMessage('');
    try {
      await api.delete(`${API_BASE}/api/bookings/packages/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchPackages();
    } catch (error: any) {
      console.error('Failed to delete package:', error);
      setErrorMessage(error?.response?.data?.message || 'The package could not be deleted. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Packages</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Manage session editions, pricing and inclusions.</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="h-9 gap-1.5 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Add package
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-2.5 text-sm">
        <div><span className="text-muted-foreground">Packages</span><span className="ml-2 font-medium tabular-nums">{packageStats.count}</span></div>
        <div><span className="text-muted-foreground">Price range</span><span className="ml-2 font-medium tabular-nums">{packages.length ? `${money(packageStats.lowestPrice)} – ${money(packageStats.highestPrice)}` : '—'}</span></div>
        <div className="ml-auto text-xs text-muted-foreground">Sorted by price</div>
      </div>

      {errorMessage && !editing && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          <span>{errorMessage}</span>
          <Button variant="outline" size="sm" className="h-7" onClick={() => void fetchPackages()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 py-8" aria-label="Loading packages">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-14 animate-pulse rounded-md bg-muted/60" />
          ))}
        </div>
      ) : errorMessage && packages.length === 0 ? null : packages.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-14 text-center">
          <Camera className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">No packages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your first package to get started.</p>
          <Button onClick={handleAdd} size="sm" variant="outline" className="mt-4 h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add package
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/35 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Package</th>
                  <th className="px-3 py-2.5 font-medium">Price / deposit</th>
                  <th className="px-3 py-2.5 font-medium">Session details</th>
                  <th className="px-3 py-2.5 font-medium">Included</th>
                  <th className="w-20 px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => {
                  const color = getPackageColor(pkg.name);
                  const inclusions = inclusionItems(pkg);
                  return (
                    <tr key={pkg.id} className="border-b border-border/70 last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{pkg.name}</p>
                            <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[10px] font-normal capitalize">{pkg.type || 'studio'}</Badge>
                            {pkg.notes?.trim() && <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground" title={pkg.notes}>{pkg.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium tabular-nums text-foreground">{money(pkg.price)}</p>
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">Deposit {money(pkg.deposit)}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground"><Clock3 className="h-3.5 w-3.5 shrink-0" /><span className="text-foreground">{pkg.duration || '—'}</span></span>
                          <span className="flex items-center gap-1.5 text-muted-foreground"><Images className="h-3.5 w-3.5 shrink-0" /><span className="text-foreground">{pkg.images} photos</span></span>
                          <span className="flex items-center gap-1.5 text-muted-foreground"><Shirt className="h-3.5 w-3.5 shrink-0" /><span className="text-foreground">{pkg.outfits} outfits</span></span>
                          <span className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="h-3.5 w-3.5 shrink-0" /><span className="text-foreground">{pkg.wig ? 'Wig included' : 'No wig'}</span></span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {inclusions.length > 0 ? (
                          <div className="flex max-w-[360px] flex-wrap gap-1">
                            {inclusions.map((item) => <span key={item} className="rounded bg-muted px-1.5 py-1 text-[11px] text-muted-foreground">{item}</span>)}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">Core studio session</span>}
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        <div className="inline-flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${pkg.name}`} onClick={() => handleEdit(pkg)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label={`Delete ${pkg.name}`} onClick={() => setDeleteTarget(pkg)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {packages.length} {packages.length === 1 ? 'package' : 'packages'}
          </div>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add package' : 'Edit package'}</DialogTitle>
            <DialogDescription>Set the package price, session details and included services.</DialogDescription>
          </DialogHeader>

          {editing && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="name">Package name</Label>
                  <Input id="name" name="name" value={editing.name || ''} onChange={handleChange} placeholder="e.g. The Bloom" required className="mt-1.5 h-9" />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={editing.type || 'studio'} onValueChange={(value) => setField('type', value)}>
                    <SelectTrigger id="type" className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="studio">Studio</SelectItem>
                      <SelectItem value="outdoor">Outdoor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <Input id="duration" name="duration" value={editing.duration || ''} onChange={handleChange} placeholder="e.g. 2 hrs" required className="mt-1.5 h-9" />
                </div>
                <div>
                  <Label htmlFor="price">Price (KSh)</Label>
                  <Input id="price" name="price" type="number" min="0" step="1" value={editing.price ?? 0} onChange={handleChange} required className="mt-1.5 h-9" />
                </div>
                <div>
                  <Label htmlFor="deposit">Deposit (KSh)</Label>
                  <Input id="deposit" name="deposit" type="number" min="0" step="1" value={editing.deposit ?? 0} onChange={handleChange} required className="mt-1.5 h-9" />
                </div>
                <div>
                  <Label htmlFor="images">Edited photos</Label>
                  <Input id="images" name="images" type="number" min="0" step="1" value={editing.images ?? 0} onChange={handleChange} required className="mt-1.5 h-9" />
                </div>
                <div>
                  <Label htmlFor="outfits">Outfits</Label>
                  <Input id="outfits" name="outfits" type="number" min="0" step="1" value={editing.outfits ?? 0} onChange={handleChange} required className="mt-1.5 h-9" />
                </div>
              </div>

              <div className="space-y-2 border-y border-border py-3">
                <p className="text-xs font-medium text-muted-foreground">Package inclusions</p>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {[
                    { key: 'makeup', label: 'Professional makeup' },
                    { key: 'styling', label: 'Outfit styling' },
                    { key: 'photobook', label: 'Photobook' },
                    { key: 'mount', label: 'Fine-art mount' },
                    { key: 'balloonBackdrop', label: 'Balloon + flower backdrop' },
                    { key: 'wig', label: 'Styled wig' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex min-h-8 items-center justify-between gap-3">
                      <Label htmlFor={key} className="text-sm font-normal">{label}</Label>
                      <Switch id={key} checked={Boolean(editing[key as keyof Package])} onCheckedChange={(checked) => setField(key as keyof Package, checked)} />
                    </div>
                  ))}
                </div>
                {editing.photobook && (
                  <div className="pt-1">
                    <Label htmlFor="photobookSize">Photobook size</Label>
                    <Input id="photobookSize" name="photobookSize" value={editing.photobookSize || ''} onChange={handleChange} placeholder={'e.g. 8x8"'} className="mt-1.5 h-9 sm:max-w-[220px]" />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" value={editing.notes || ''} onChange={handleChange} placeholder="Additional package details…" className="mt-1.5 min-h-[72px] resize-y" />
              </div>

              {errorMessage && (
                <p className="text-sm text-destructive" role="alert">{errorMessage}</p>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving || !editing.name?.trim()}>
                  {saving ? 'Saving…' : isNew ? 'Add package' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This package will be permanently deleted. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {errorMessage && <p className="text-sm text-destructive" role="alert">{errorMessage}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting…' : 'Delete package'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
