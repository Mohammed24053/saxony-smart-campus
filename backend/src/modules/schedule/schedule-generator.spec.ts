import { planSchedule } from './schedule-generator';

describe('planSchedule', () => {
  it('places a single subject for a single section', () => {
    const r = planSchedule({
      subjects: [{ id: 'sub1', hoursPerWeek: 2, defaultDoctorId: 'doc1', type: 'theory' }],
      sections: [{ id: 'sec1', studentCount: 30, subjectIds: ['sub1'] }],
      doctors: [{ id: 'doc1', availability: {} }],
      rooms: [{ id: 'room1', capacity: 60, type: 'lecture' }],
    });
    expect(r.slots).toHaveLength(2);
    expect(r.conflicts).toHaveLength(0);
    expect(r.slots.every((s) => s.doctorId === 'doc1' && s.roomId === 'room1')).toBe(true);
  });

  it('does not double-book a doctor across sections', () => {
    const r = planSchedule({
      subjects: [{ id: 'sub1', hoursPerWeek: 1, defaultDoctorId: 'doc1', type: 'theory' }],
      sections: [
        { id: 'sec1', studentCount: 20, subjectIds: ['sub1'] },
        { id: 'sec2', studentCount: 20, subjectIds: ['sub1'] },
      ],
      doctors: [{ id: 'doc1', availability: {} }],
      rooms: [{ id: 'room1', capacity: 25, type: 'lecture' }],
    });
    const a = r.slots.find((s) => s.sectionId === 'sec1')!;
    const b = r.slots.find((s) => s.sectionId === 'sec2')!;
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a.dayOfWeek === b.dayOfWeek && a.startMin === b.startMin).toBe(false);
  });

  it('does not double-book a room', () => {
    const r = planSchedule({
      subjects: [
        { id: 'sub1', hoursPerWeek: 1, defaultDoctorId: 'doc1', type: 'theory' },
        { id: 'sub2', hoursPerWeek: 1, defaultDoctorId: 'doc2', type: 'theory' },
      ],
      sections: [
        { id: 'sec1', studentCount: 30, subjectIds: ['sub1'] },
        { id: 'sec2', studentCount: 30, subjectIds: ['sub2'] },
      ],
      doctors: [
        { id: 'doc1', availability: {} },
        { id: 'doc2', availability: {} },
      ],
      rooms: [{ id: 'room1', capacity: 60, type: 'lecture' }],
    });
    const slots = r.slots;
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i],
          b = slots[j];
        if (a.roomId === b.roomId && a.dayOfWeek === b.dayOfWeek) {
          expect(a.startMin >= b.endMin || b.startMin >= a.endMin).toBe(true);
        }
      }
    }
  });

  it('reports a conflict when the only room is too small', () => {
    const r = planSchedule({
      subjects: [{ id: 'sub1', hoursPerWeek: 1, defaultDoctorId: 'doc1', type: 'theory' }],
      sections: [{ id: 'sec1', studentCount: 100, subjectIds: ['sub1'] }],
      doctors: [{ id: 'doc1', availability: {} }],
      rooms: [{ id: 'room1', capacity: 30, type: 'lecture' }],
    });
    expect(r.slots).toHaveLength(0);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].reason).toBe('NO_AVAILABLE_SLOT');
  });

  it('respects doctor availability windows', () => {
    const r = planSchedule({
      subjects: [{ id: 'sub1', hoursPerWeek: 1, defaultDoctorId: 'doc1', type: 'theory' }],
      sections: [{ id: 'sec1', studentCount: 10, subjectIds: ['sub1'] }],
      doctors: [{ id: 'doc1', availability: { 1: [{ startMin: 9 * 60, endMin: 11 * 60 }] } }],
      rooms: [{ id: 'room1', capacity: 30, type: 'lecture' }],
    });
    expect(r.slots).toHaveLength(1);
    const s = r.slots[0];
    expect(s.dayOfWeek).toBe(1);
    expect(s.startMin).toBeGreaterThanOrEqual(9 * 60);
    expect(s.endMin).toBeLessThanOrEqual(11 * 60);
  });

  it('marks NO_DOCTOR conflict when subject lacks default doctor', () => {
    const r = planSchedule({
      subjects: [{ id: 'sub1', hoursPerWeek: 1, type: 'theory' }],
      sections: [{ id: 'sec1', studentCount: 10, subjectIds: ['sub1'] }],
      doctors: [],
      rooms: [{ id: 'room1', capacity: 30, type: 'lecture' }],
    });
    expect(r.slots).toHaveLength(0);
    expect(r.conflicts[0].reason).toBe('NO_DOCTOR');
  });
});
