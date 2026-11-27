import { edgeGeometry } from './geometry';

describe('edgeGeometry', () => {
  it('draws a straight edge as a line with an arrowhead', () => {
    const g = edgeGeometry(
      { points: [{ x: 0, y: 10 }, { x: 100, y: 10 }], sourceSide: 'right', targetSide: 'left' },
      true,
    );
    expect(g.d).toBe('M 0 10 L 93 10');
    expect(g.head.startsWith('M 100 10')).toBeTrue();
    expect(g.mid.y).toBeCloseTo(10);
  });

  it('curves between offset nodes and can omit the arrowhead', () => {
    const g = edgeGeometry(
      { points: [{ x: 0, y: 0 }, { x: 100, y: 80 }], sourceSide: 'right', targetSide: 'left' },
      false,
    );
    expect(g.d).toContain(' C ');
    expect(g.d.endsWith('100 80')).toBeTrue();
    expect(g.head).toBe('');
  });

  it('shifts parallel edges', () => {
    const g = edgeGeometry(
      { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], sourceSide: 'right', targetSide: 'left' },
      false,
      { x: 0, y: 9 },
    );
    expect(g.d).toBe('M 0 9 L 50 9');
  });
});
