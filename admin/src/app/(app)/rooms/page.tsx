'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { api, unwrapPaginated } from '@/lib/api';
import { Button, Input, Label, Select, Td, Th, Toolbar, Tr } from '@/components/ui';
import { PageHeader, TableSkeleton, EmptyState } from '@/components/seu';
import { Modal, ConfirmModal } from '@/components/modal';
import { useToast } from '@/components/seu/toast';
import { useT } from '@/i18n/i18n';

type Room = {
  id: string; name: string; type: string; capacity: number;
  building?: string; floor?: number; gpsEnabled: boolean;
  latitude?: number; longitude?: number; gpsRadius?: number;
};

interface RoomForm {
  name: string;
  type: 'lecture_hall' | 'lab' | 'tutorial_room' | 'auditorium';
  capacity: number;
  building?: string;
  floor?: number;
  latitude?: number;
  longitude?: number;
  gpsRadius?: number;
  gpsEnabled: boolean;
}

const empty: RoomForm = {
  name: '', type: 'lecture_hall', capacity: 30, gpsEnabled: true,
};

export default function RoomsPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<{ open: boolean; editing?: Room }>({ open: false });
  const [form, setForm] = useState<RoomForm>(empty);
  const [confirmDel, setConfirmDel] = useState<Room | null>(null);

  const q = useQuery({
    queryKey: ['rooms'],
    queryFn: () => unwrapPaginated<Room>(api.get('/rooms', { params: { page: 1, pageSize: 100 } })),
  });

  const save = useMutation({
    mutationFn: async (input: RoomForm) => {
      if (modal.editing) {
        return (await api.put(`/rooms/${modal.editing.id}`, input)).data;
      }
      return (await api.post('/rooms', input)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.push({ title: modal.editing ? t('common.saved') : t('rooms.addRoom'), tone: 'success' });
      setModal({ open: false });
    },
    onError: (err: { message?: string }) => toast.push({ title: t('errors.generic'), description: err?.message, tone: 'error' }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/rooms/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.push({ title: t('common.delete'), tone: 'success' });
      setConfirmDel(null);
    },
    onError: (err: { message?: string }) => toast.push({ title: t('errors.generic'), description: err?.message, tone: 'error' }),
  });

  const openCreate = () => { setForm(empty); setModal({ open: true }); };
  const openEdit = (r: Room) => {
    setForm({
      name: r.name, type: r.type as RoomForm['type'], capacity: r.capacity,
      building: r.building, floor: r.floor, latitude: r.latitude, longitude: r.longitude,
      gpsRadius: r.gpsRadius, gpsEnabled: r.gpsEnabled,
    });
    setModal({ open: true, editing: r });
  };

  return (
    <>
      <PageHeader title={t('rooms.title')} description={t('rooms.subtitle')}>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> {t('rooms.addRoom')}
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Toolbar>
          {q.data && (
            <span className="ml-auto text-[11px] tabnum text-muted-foreground">
              {q.data.total.toLocaleString()} {t('common.all').toLowerCase()}
            </span>
          )}
        </Toolbar>
        {q.isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : q.data && q.data.items.length === 0 ? (
          <EmptyState
            title={t('rooms.empty')}
            actionLabel={t('rooms.addRoom')}
            onAction={openCreate}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>{t('common.name')}</Th>
                <Th>{t('rooms.type')}</Th>
                <Th className="text-right">{t('rooms.capacity')}</Th>
                <Th>Building</Th>
                <Th>GPS</Th>
                <Th className="text-right">{t('common.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((r, i) => (
                <Tr key={r.id} index={i}>
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="text-[12.5px] text-muted-foreground">{r.type}</Td>
                  <Td className="tabnum text-right text-[12.5px]">{r.capacity}</Td>
                  <Td className="text-[12.5px] text-muted-foreground">
                    {r.building ? `${r.building}${r.floor != null ? ` / F${r.floor}` : ''}` : '—'}
                  </Td>
                  <Td>
                    {r.gpsEnabled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-status-success">
                        <MapPin className="h-3 w-3" /> On
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" /> Off
                      </span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <button onClick={() => openEdit(r)} aria-label={t('common.edit')} className="mr-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setConfirmDel(r)} aria-label={t('common.delete')} className="rounded p-1 text-muted-foreground hover:bg-seu-red/10 hover:text-seu-red">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modal.open}
        onOpenChange={(o) => setModal({ open: o, editing: o ? modal.editing : undefined })}
        title={modal.editing ? `${t('common.edit')}: ${modal.editing.name}` : t('rooms.addRoom')}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setModal({ open: false })}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="name">{t('common.name')}</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="type">{t('rooms.type')}</Label>
            <Select id="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RoomForm['type'] })}>
              <option value="lecture_hall">Lecture Hall</option>
              <option value="lab">Lab</option>
              <option value="tutorial_room">Tutorial</option>
              <option value="auditorium">Auditorium</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="capacity">{t('rooms.capacity')}</Label>
            <Input id="capacity" type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </div>
          <div>
            <Label htmlFor="building">Building</Label>
            <Input id="building" value={form.building ?? ''} onChange={(e) => setForm({ ...form, building: e.target.value || undefined })} />
          </div>
          <div>
            <Label htmlFor="floor">Floor</Label>
            <Input id="floor" type="number" value={form.floor ?? ''} onChange={(e) => setForm({ ...form, floor: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div>
            <Label htmlFor="lat">{t('rooms.lat')}</Label>
            <Input id="lat" type="number" step="0.0001" value={form.latitude ?? ''} onChange={(e) => setForm({ ...form, latitude: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div>
            <Label htmlFor="lng">{t('rooms.lng')}</Label>
            <Input id="lng" type="number" step="0.0001" value={form.longitude ?? ''} onChange={(e) => setForm({ ...form, longitude: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div>
            <Label htmlFor="rad">{t('rooms.radius')}</Label>
            <Input id="rad" type="number" min={5} value={form.gpsRadius ?? ''} onChange={(e) => setForm({ ...form, gpsRadius: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div className="flex items-end">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <input type="checkbox" checked={form.gpsEnabled} onChange={(e) => setForm({ ...form, gpsEnabled: e.target.checked })} />
              GPS enforced
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={confirmDel ? `${t('common.delete')}: ${confirmDel.name}?` : ''}
        description="This action cannot be undone."
        destructive
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={async () => { if (confirmDel) { await del.mutateAsync(confirmDel.id); } }}
      />
    </>
  );
}
